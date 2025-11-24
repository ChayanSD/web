import sql from "@/app/api/utils/sql";
import { getToken } from "@auth/core/jwt";
import { accountDeleteSchema } from "@/lib/validation";
import { unauthorized, badRequest, handleValidationError, handleDatabaseError } from "@/lib/errors";

export async function POST(request) {
  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith("https") ?? false,
    });

    if (!jwt || !jwt.sub) {
      return unauthorized();
    }

    const userId = parseInt(jwt.sub);
    const body = await request.json();

    // Validate confirmation
    const validation = accountDeleteSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    // Verify user exists
    const users = await sql`
      SELECT id, email FROM auth_users 
      WHERE id = ${userId}
    `;

    if (users.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = users[0];

    // Hard delete all user data in correct order to respect foreign key constraints
    try {
      // Start transaction
      await sql.begin(async (sql) => {
        // Delete receipts_items first (if table exists)
        await sql`DELETE FROM receipts_items WHERE receipt_id IN (SELECT id FROM receipts WHERE user_id = ${userId})`;
        
        // Delete receipts
        await sql`DELETE FROM receipts WHERE user_id = ${userId}`;
        
        // Delete reports
        await sql`DELETE FROM reports WHERE user_id = ${userId}`;
        
        // Delete company_settings
        await sql`DELETE FROM company_settings WHERE user_id = ${userId}`;
        
        // Delete audit_log entries
        await sql`DELETE FROM audit_log WHERE user_id = ${userId}`;
        
        // Delete user
        await sql`DELETE FROM auth_users WHERE id = ${userId}`;
      });

      console.log(`User ${user.email} (ID: ${userId}) and all associated data deleted successfully`);

      return Response.json({ 
        success: true, 
        message: "Account and all associated data have been permanently deleted" 
      });

    } catch (error) {
      console.error("Error during account deletion:", error);
      return Response.json({ 
        error: "Failed to delete account. Please contact support if this issue persists." 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("POST /api/account/delete error:", error);
    return handleDatabaseError(error);
  }
}
