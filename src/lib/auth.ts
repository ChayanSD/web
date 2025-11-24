import { getToken } from "@auth/core/jwt";
import { unauthorized, forbidden } from "./errors";

// Standardized auth helper
export async function requireAuth(request: Request) {
  const jwt = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.AUTH_URL?.startsWith("https") ?? false,
  });

  if (!jwt || !jwt.sub) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId: parseInt(jwt.sub),
    email: jwt.email,
    name: jwt.name,
  };
}

// Admin check helper
export async function requireAdmin(userId: number) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
  
  if (adminEmails.length === 0) {
    throw new Error("ADMIN_NOT_CONFIGURED");
  }

  // Import sql here to avoid circular dependency
  const { default: sql } = await import("../app/api/utils/sql");
  
  const users = await sql`
    SELECT email FROM auth_users 
    WHERE id = ${userId}
  `;

  if (users.length === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const isAdmin = adminEmails.includes(users[0].email);
  if (!isAdmin) {
    throw new Error("FORBIDDEN");
  }

  return true;
}

// Auth wrapper for API routes
export function withAuth(handler: (request: Request, auth: any) => Promise<Response>) {
  return async (request: Request) => {
    try {
      const auth = await requireAuth(request);
      return await handler(request, auth);
    } catch (error) {
      if (error.message === "UNAUTHORIZED") {
        return unauthorized();
      }
      throw error;
    }
  };
}

// Admin wrapper for API routes
export function withAdmin(handler: (request: Request, auth: any) => Promise<Response>) {
  return async (request: Request) => {
    try {
      const auth = await requireAuth(request);
      await requireAdmin(auth.userId);
      return await handler(request, auth);
    } catch (error) {
      if (error.message === "UNAUTHORIZED") {
        return unauthorized();
      }
      if (error.message === "FORBIDDEN") {
        return forbidden("Admin privileges required");
      }
      throw error;
    }
  };
}

// Non-throwing helper to fetch auth context
export async function getAuthUser(request: Request) {
  try {
    const auth = await requireAuth(request);
    return {
      id: auth.userId,
      email: auth.email,
      name: auth.name,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return null;
    }
    throw error;
  }
}
