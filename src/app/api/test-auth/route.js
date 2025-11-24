import { verify } from "argon2";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    console.log("Test auth attempt for:", email);

    // Check if user exists and get their data
    const users = await sql`
      SELECT id, email, first_name, last_name, email_verified_at
      FROM auth_users 
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (users.length === 0) {
      console.log("User not found:", email);
      return Response.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 401 },
      );
    }

    const user = users[0];
    console.log("Found user:", {
      id: user.id,
      email: user.email,
      verified: !!user.email_verified_at,
    });

    // Check if email is verified
    if (!user.email_verified_at) {
      console.log("Email not verified for:", email);
      return Response.json(
        {
          success: false,
          error: "Email not verified",
          needsVerification: true,
        },
        { status: 401 },
      );
    }

    // Get the password from auth_accounts
    const accounts = await sql`
      SELECT password
      FROM auth_accounts 
      WHERE "userId" = ${user.id} AND provider = 'credentials'
      LIMIT 1
    `;

    if (accounts.length === 0) {
      console.log("No credentials account found for user:", user.id);
      return Response.json(
        {
          success: false,
          error: "No credentials found",
        },
        { status: 401 },
      );
    }

    const account = accounts[0];

    if (!account.password) {
      console.log("No password found for user:", user.id);
      return Response.json(
        {
          success: false,
          error: "No password found",
        },
        { status: 401 },
      );
    }

    // Verify password
    const isValid = await verify(account.password, password);
    console.log("Password valid:", isValid);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Invalid password",
        },
        { status: 401 },
      );
    }

    // Success!
    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        name:
          user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || null,
      },
    });
  } catch (error) {
    console.error("Test auth error:", error);
    return Response.json(
      {
        success: false,
        error: "Server error: " + error.message,
      },
      { status: 500 },
    );
  }
}
