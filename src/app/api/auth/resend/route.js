import sql from "@/app/api/utils/sql.js";
import { sendEmail } from "@/app/api/utils/send-email.js";
import crypto from "crypto";

// Rate limiting for resend attempts
const resendAttempts = new Map();

// Clean up old attempts every hour
setInterval(
  () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [email, attempts] of resendAttempts.entries()) {
      const validAttempts = attempts.filter((time) => time > oneHourAgo);
      if (validAttempts.length === 0) {
        resendAttempts.delete(email);
      } else {
        resendAttempts.set(email, validAttempts);
      }
    }
  },
  60 * 60 * 1000,
);

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
    const { email } = await request.json();

    if (!email) {
      return Response.json(
        { error: "Email address is required." },
        { status: 400 },
      );
    }

    // Rate limiting - 3 attempts per hour per email
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const attempts = resendAttempts.get(email.toLowerCase()) || [];
    const recentAttempts = attempts.filter((time) => time > oneHourAgo);

    if (recentAttempts.length >= 3) {
      return Response.json(
        { error: "Too many resend attempts. Please try again in an hour." },
        { status: 429 },
      );
    }

    // Find user
    const users = await sql`
      SELECT id, first_name, last_name, email, email_verified_at
      FROM auth_users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      // Don't reveal if user doesn't exist for security
      return Response.json(
        {
          error:
            "If an account with this email exists, a verification email will be sent.",
        },
        { status: 200 },
      );
    }

    const user = users[0];

    // Check if already verified
    if (user.email_verified_at) {
      return Response.json(
        { error: "This email address is already verified." },
        { status: 400 },
      );
    }

    // Record this attempt
    recentAttempts.push(now);
    resendAttempts.set(email.toLowerCase(), recentAttempts);

    // Generate new verification tokens
    const verificationToken = generateVerificationToken();
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new tokens
    await sql`
      UPDATE auth_users 
      SET verification_token = ${verificationToken},
          verification_code = ${verificationCode},
          verification_code_expires_at = ${expiresAt},
          verification_attempts = 0
      WHERE id = ${user.id}
    `;

    // Send verification email
    try {
      const verifyUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;

      await sendEmail({
        to: email,
        from: process.env.FROM_EMAIL || "noreply@reimburseme.com",
        subject: "Verify your email for ReimburseMe",
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #2E86DE 0%, #54a0ff 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; font-size: 28px; margin: 0; font-weight: 600;">ReimburseMe</h1>
            </div>
            
            <div style="padding: 40px 20px;">
              <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Hi ${user.first_name}, verify your email!</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                You requested a new verification email. Please verify your email address by clicking the button below:
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
                Didn't request this? You can safely ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Hi ${user.first_name}, verify your email!\n\nYou requested a new verification email. Please verify your email by visiting: ${verifyUrl}\n\nOr use this 6-digit code: ${verificationCode}\n\nThis link will expire in 24 hours.\n\nDidn't request this? You can safely ignore this email.`,
      });

      await logAuditEvent(user.id, "email_sent", {
        type: "verification_resend",
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);

      await logAuditEvent(user.id, "email_failed", {
        error: emailError.message,
        type: "verification_resend",
      });

      return Response.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      message: "Verification email sent successfully.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return Response.json(
      {
        error:
          "An error occurred while sending the verification email. Please try again.",
      },
      { status: 500 },
    );
  }
}
