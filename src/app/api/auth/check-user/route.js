import sql from "@/app/api/utils/sql.js";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists and their verification status
    const users = await sql`
      SELECT id, email, email_verified_at, verification_code_expires_at
      FROM auth_users 
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (users.length === 0) {
      // User doesn't exist
      return Response.json({
        userExists: false,
        needsVerification: false,
      });
    }

    const user = users[0];

    // Check if user needs verification
    const needsVerification = !user.email_verified_at;

    // Check if verification code is still valid (if they need verification)
    let verificationExpired = false;
    if (needsVerification && user.verification_code_expires_at) {
      verificationExpired =
        new Date() > new Date(user.verification_code_expires_at);
    }

    return Response.json({
      userExists: true,
      needsVerification,
      verificationExpired,
    });
  } catch (error) {
    console.error("Check user error:", error);
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
