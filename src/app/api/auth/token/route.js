import { getToken } from "@auth/core/jwt";
import sql from "@/app/api/utils/sql.js";

export async function GET(request) {
  const [token, jwt] = await Promise.all([
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
      raw: true,
    }),
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
    }),
  ]);

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Fetch full user data from database including first_name and last_name
  let userData = {
    id: jwt.sub,
    email: jwt.email,
    name: jwt.name,
  };

  try {
    const users = await sql`
			SELECT id, email, first_name, last_name, subscription_tier, created_at
			FROM auth_users 
			WHERE id = ${parseInt(jwt.sub)}
		`;

    if (users.length > 0) {
      const user = users[0];
      userData = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        subscription_tier: user.subscription_tier,
        created_at: user.created_at,
        // Keep the original name field for backwards compatibility
        name: jwt.name,
      };
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    // Fallback to JWT data if database query fails
  }

  return new Response(
    JSON.stringify({
      jwt: token,
      user: userData,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
