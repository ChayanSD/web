import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logActivity, EVENTS } from "@/app/api/utils/audit";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const currentUser = await sql`
      SELECT is_admin FROM auth_users WHERE id = ${session.user.id}
    `;

    if (!currentUser[0]?.is_admin && session.user.id !== 1) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { receipt_id } = body;

    if (!receipt_id) {
      return Response.json(
        { error: "Receipt ID is required" },
        { status: 400 },
      );
    }

    // Get receipt info before deletion for logging
    const receiptInfo = await sql`
      SELECT id, user_id, merchant_name, amount, category
      FROM receipts 
      WHERE id = ${receipt_id}
    `;

    if (receiptInfo.length === 0) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const receipt = receiptInfo[0];

    // Delete the receipt
    const deletedReceipts = await sql`
      DELETE FROM receipts 
      WHERE id = ${receipt_id}
      RETURNING id
    `;

    if (deletedReceipts.length === 0) {
      return Response.json(
        { error: "Failed to delete receipt" },
        { status: 500 },
      );
    }

    // Log the admin action
    await logActivity(session.user.id, "Admin deleted receipt", {
      deleted_receipt_id: receipt_id,
      receipt_owner: receipt.user_id,
      merchant: receipt.merchant_name,
      amount: receipt.amount,
      admin_action: true,
    });

    // Log for the receipt owner as well
    if (receipt.user_id !== session.user.id) {
      await logActivity(receipt.user_id, "Receipt deleted by admin", {
        receipt_id: receipt_id,
        deleted_by_admin: session.user.id,
        merchant: receipt.merchant_name,
        amount: receipt.amount,
      });
    }

    return Response.json({
      message: "Receipt deleted successfully",
      receipt_id: receipt_id,
    });
  } catch (error) {
    console.error("Admin delete receipt error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
