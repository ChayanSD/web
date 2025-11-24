import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { hash } from "argon2";
import crypto from "crypto";

// Rate limiting store (in production, use Redis)
const signupAttempts = new Map();

// Clean up old attempts every 10 minutes
setInterval(
  () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, attempts] of signupAttempts.entries()) {
      const validAttempts = attempts.filter((time) => time > tenMinutesAgo);
      if (validAttempts.length === 0) {
        signupAttempts.delete(key);
      } else {
        signupAttempts.set(key, validAttempts);
      }
    }
  },
  10 * 60 * 1000,
);

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateName(name) {
  return /^[a-zA-Z\s\-']{1,60}$/.test(name);
}

function validatePassword(password) {
  const rules = {
    length: /.{8,72}/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    symbol: /[!@#$%^&*]/,
  };

  return Object.values(rules).every((rule) => rule.test(password));
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function logAuditEvent(userId, event, meta = {}) {
  try {
    await sql`
      INSERT INTO audit_log (user_id, event, meta)
      VALUES (${userId}, ${event}, ${JSON.stringify(meta)})
    `;
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export async function POST(request) {
  try {
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";

    // Rate limiting - 5 attempts per 10 minutes per IP
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const attempts = signupAttempts.get(clientIP) || [];
    const recentAttempts = attempts.filter((time) => time > tenMinutesAgo);

    if (recentAttempts.length >= 5) {
      return Response.json(
        { error: "Too many signup attempts. Please try again in 10 minutes." },
        { status: 429 },
      );
    }

    // Parse request body
    const {
      first_name,
      last_name,
      email,
      password,
      confirm_password,
      accept_terms,
    } = await request.json();

    // Server-side validation
    const errors = [];

    if (!first_name?.trim()) {
      errors.push("First name is required");
    } else if (!validateName(first_name)) {
      errors.push("First name contains invalid characters");
    }

    if (!last_name?.trim()) {
      errors.push("Last name is required");
    } else if (!validateName(last_name)) {
      errors.push("Last name contains invalid characters");
    }

    if (!email?.trim()) {
      errors.push("Email is required");
    } else if (!validateEmail(email)) {
      errors.push("Invalid email format");
    }

    if (!password) {
      errors.push("Password is required");
    } else if (!validatePassword(password)) {
      errors.push("Password does not meet security requirements");
    }

    if (password !== confirm_password) {
      errors.push("Passwords do not match");
    }

    if (!accept_terms) {
      errors.push("You must accept the terms and privacy policy");
    }

    if (errors.length > 0) {
      return Response.json({ error: errors.join(", ") }, { status: 400 });
    }

    // Record this attempt
    recentAttempts.push(now);
    signupAttempts.set(clientIP, recentAttempts);

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id, email_verified_at FROM auth_users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      if (user.email_verified_at) {
        // Generic error to prevent email enumeration
        return Response.json(
          {
            error:
              "An account with this email may already exist. Please try signing in instead.",
          },
          { status: 409 },
        );
      } else {
        // User exists but not verified - resend verification
        const verificationToken = generateVerificationToken();
        const verificationCode = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await sql`
          UPDATE auth_users 
          SET verification_token = ${verificationToken},
              verification_code = ${verificationCode},
              verification_code_expires_at = ${expiresAt}
          WHERE id = ${user.id}
        `;

        // Send verification email
        try {
          const verifyUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;

          await sendEmail({
            to: email,
            from: process.env.FROM_EMAIL || "onboarding@resend.dev",
            subject: "Verify your email for ReimburseMe",
            html: `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <div style="background: linear-gradient(135deg, #2E86DE 0%, #54a0ff 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: white; font-size: 28px; margin: 0; font-weight: 600;">ReimburseMe</h1>
                </div>
                
                <div style="padding: 40px 20px;">
                  <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Hi ${first_name}, welcome to ReimburseMe!</h2>
                  
                  <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Thanks for signing up! To get started with managing your expenses, please verify your email address by clicking the button below:
                  </p>
                  
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${verifyUrl}" 
                       style="background-color: #2E86DE; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                      Verify Email
                    </a>
                  </div>
                  
                  <p style="color: #777; font-size: 14px; margin-top: 30px;">
                    Or use this 6-digit code: <strong style="font-size: 18px; color: #2E86DE; font-family: monospace;">${verificationCode}</strong>
                  </p>
                  
                  <p style="color: #777; font-size: 14px; margin-top: 20px;">
                    This link and code will expire in 24 hours for security.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                  
                  <p style="color: #888; font-size: 12px;">
                    Didn't create this account? You can safely ignore this email.
                  </p>
                </div>
              </div>
            `,
            text: `Hi ${first_name}, welcome to ReimburseMe!\n\nPlease verify your email by visiting: ${verifyUrl}\n\nOr use this 6-digit code: ${verificationCode}\n\nThis link will expire in 24 hours.\n\nDidn't create this account? You can safely ignore this email.`,
          });

          await logAuditEvent(user.id, "email_sent", {
            type: "verification_resent",
          });
        } catch (emailError) {
          console.error("Failed to send verification email:", emailError);
          // Don't fail the request if email fails
        }

        return Response.json({
          ok: true,
          message:
            "Account exists but not verified. Verification email resent.",
        });
      }
    }

    // Hash password
    const hashedPassword = await hash(password);

    // Generate verification tokens
    const verificationToken = generateVerificationToken();
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user account
    const [newUser] = await sql`
      INSERT INTO auth_users (
        first_name, 
        last_name, 
        email, 
        verification_token,
        verification_code,
        verification_code_expires_at,
        accept_terms,
        subscription_tier
      ) VALUES (
        ${first_name.trim()},
        ${last_name.trim()},
        ${email.toLowerCase()},
        ${verificationToken},
        ${verificationCode},
        ${expiresAt},
        ${accept_terms},
        'free'
      )
      RETURNING id, email
    `;

    // Create auth account record for password login
    await sql`
      INSERT INTO auth_accounts (
        "userId",
        type,
        provider,
        "providerAccountId",
        password
      ) VALUES (
        ${newUser.id},
        'credentials',
        'credentials',
        ${newUser.email},
        ${hashedPassword}
      )
    `;

    // Log audit event
    await logAuditEvent(newUser.id, "signup", {
      method: "email",
      first_name,
      last_name,
    });

    // Send verification email
    try {
      const verifyUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;

      await sendEmail({
        to: email,
        from: process.env.FROM_EMAIL || "onboarding@resend.dev",
        subject: "Verify your email for ReimburseMe",
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #2E86DE 0%, #54a0ff 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; font-size: 28px; margin: 0; font-weight: 600;">ReimburseMe</h1>
            </div>
            
            <div style="padding: 40px 20px;">
              <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Hi ${first_name}, welcome to ReimburseMe!</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Thanks for signing up! To get started with managing your expenses, please verify your email address by clicking the button below:
              </p>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${verifyUrl}" 
                   style="background-color: #2E86DE; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Verify Email
                </a>
              </div>
              
              <p style="color: #777; font-size: 14px; margin-top: 30px;">
                Or use this 6-digit code: <strong style="font-size: 18px; color: #2E86DE; font-family: monospace;">${verificationCode}</strong>
              </p>
              
              <p style="color: #777; font-size: 14px; margin-top: 20px;">
                This link and code will expire in 24 hours for security.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
              
              <p style="color: #888; font-size: 12px;">
                Didn't create this account? You can safely ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Hi ${first_name}, welcome to ReimburseMe!\n\nPlease verify your email by visiting: ${verifyUrl}\n\nOr use this 6-digit code: ${verificationCode}\n\nThis link will expire in 24 hours.\n\nDidn't create this account? You can safely ignore this email.`,
      });

      await logAuditEvent(newUser.id, "email_sent", { type: "verification" });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail the request if email fails, but log it
      await logAuditEvent(newUser.id, "email_failed", {
        error: emailError.message,
        type: "verification",
      });
    }

    return Response.json({
      ok: true,
      message:
        "Account created successfully. Please check your email for verification.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return Response.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
