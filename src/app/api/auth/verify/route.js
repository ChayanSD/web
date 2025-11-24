import sql from "@/app/api/utils/sql";

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
    const { token, email, code } = await request.json();

    if (token) {
      // Verify using magic link token
      const users = await sql`
        SELECT id, email, first_name, verification_code_expires_at, email_verified_at
        FROM auth_users 
        WHERE verification_token = ${token}
        AND verification_code_expires_at > NOW()
      `;

      if (users.length === 0) {
        // Check if token exists but expired
        const expiredUsers = await sql`
          SELECT id FROM auth_users 
          WHERE verification_token = ${token}
        `;

        if (expiredUsers.length > 0) {
          return Response.json(
            {
              error: "Verification link has expired. Please request a new one.",
            },
            { status: 410 },
          );
        }

        return Response.json(
          { error: "Invalid or expired verification link." },
          { status: 400 },
        );
      }

      const user = users[0];

      // Check if already verified
      if (user.email_verified_at) {
        await logAuditEvent(user.id, "email_verification_attempt", {
          method: "token",
          result: "already_verified",
        });
        return Response.json({
          verified: true,
          message: "Email already verified",
        });
      }

      // Mark as verified
      await sql`
        UPDATE auth_users 
        SET email_verified_at = NOW(),
            verification_token = NULL,
            verification_code = NULL,
            verification_code_expires_at = NULL
        WHERE id = ${user.id}
      `;

      await logAuditEvent(user.id, "email_verified", { method: "token" });

      return Response.json({ verified: true });
    } else if (email && code) {
      // Verify using 6-digit code
      if (!/^\d{6}$/.test(code)) {
        return Response.json(
          { error: "Please enter a valid 6-digit code." },
          { status: 400 },
        );
      }

      const users = await sql`
        SELECT id, first_name, verification_attempts, verification_code_expires_at, email_verified_at
        FROM auth_users 
        WHERE email = ${email.toLowerCase()}
        AND verification_code = ${code}
        AND verification_code_expires_at > NOW()
      `;

      if (users.length === 0) {
        // Check if code exists but expired
        const expiredUsers = await sql`
          SELECT id, verification_attempts FROM auth_users 
          WHERE email = ${email.toLowerCase()}
          AND verification_code = ${code}
        `;

        if (expiredUsers.length > 0) {
          return Response.json(
            {
              error: "Verification code has expired. Please request a new one.",
            },
            { status: 410 },
          );
        }

        // Increment failed attempts
        await sql`
          UPDATE auth_users 
          SET verification_attempts = verification_attempts + 1
          WHERE email = ${email.toLowerCase()}
        `;

        return Response.json(
          {
            error:
              "Invalid verification code. Please check your email and try again.",
          },
          { status: 400 },
        );
      }

      const user = users[0];

      // Check if already verified
      if (user.email_verified_at) {
        await logAuditEvent(user.id, "email_verification_attempt", {
          method: "code",
          result: "already_verified",
        });
        return Response.json({
          verified: true,
          message: "Email already verified",
        });
      }

      // Check attempt limits (max 5 attempts)
      if (user.verification_attempts >= 5) {
        return Response.json(
          {
            error: "Too many verification attempts. Please request a new code.",
          },
          { status: 429 },
        );
      }

      // Mark as verified
      await sql`
        UPDATE auth_users 
        SET email_verified_at = NOW(),
            verification_token = NULL,
            verification_code = NULL,
            verification_code_expires_at = NULL,
            verification_attempts = 0
        WHERE id = ${user.id}
      `;

      await logAuditEvent(user.id, "email_verified", { method: "code" });

      return Response.json({ verified: true });
    } else {
      return Response.json(
        { error: "Either token or email and code must be provided." },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Email verification error:", error);
    return Response.json(
      { error: "An error occurred during verification. Please try again." },
      { status: 500 },
    );
  }
}
