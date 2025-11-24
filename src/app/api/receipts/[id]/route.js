import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logActivity, EVENTS } from "@/app/api/utils/audit";
import { receiptUpdateSchema } from "@/lib/validation";
import { unauthorized, notFound, handleValidationError, handleDatabaseError } from "@/lib/errors";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const receiptId = parseInt(params.id);

    if (isNaN(receiptId)) {
      return Response.json({ error: "Invalid receipt ID" }, { status: 400 });
    }

    const receipts = await sql`
      SELECT * FROM receipts 
      WHERE id = ${receiptId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (receipts.length === 0) {
      return notFound("Receipt not found");
    }

    return Response.json({ receipt: receipts[0] });
  } catch (error) {
    console.error("GET /api/receipts/[id] error:", error);
    return handleDatabaseError(error);
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const receiptId = parseInt(params.id);

    if (isNaN(receiptId)) {
      return Response.json({ error: "Invalid receipt ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = receiptUpdateSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const updateData = validation.data;

    // Check if receipt exists and belongs to user
    const existingReceipt = await sql`
      SELECT id FROM receipts 
      WHERE id = ${receiptId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existingReceipt.length === 0) {
      return notFound("Receipt not found");
    }

    // Build dynamic update query
    const setClauses = [];
    const values = [];
    let paramCount = 0;

    if (updateData.merchant_name !== undefined) {
      paramCount++;
      setClauses.push(`merchant_name = $${paramCount}`);
      values.push(updateData.merchant_name);
    }

    if (updateData.receipt_date !== undefined) {
      paramCount++;
      setClauses.push(`receipt_date = $${paramCount}`);
      values.push(updateData.receipt_date);
    }

    if (updateData.amount !== undefined) {
      paramCount++;
      setClauses.push(`amount = $${paramCount}`);
      values.push(updateData.amount);
    }

    if (updateData.category !== undefined) {
      paramCount++;
      setClauses.push(`category = $${paramCount}`);
      values.push(updateData.category);
    }

    if (updateData.note !== undefined) {
      paramCount++;
      setClauses.push(`note = $${paramCount}`);
      values.push(updateData.note);
    }

    if (updateData.currency !== undefined) {
      paramCount++;
      setClauses.push(`currency = $${paramCount}`);
      values.push(updateData.currency);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    // Add updated_at timestamp
    paramCount++;
    setClauses.push(`updated_at = NOW()`);

    const query = `
      UPDATE receipts 
      SET ${setClauses.join(", ")}
      WHERE id = $${paramCount + 1} AND user_id = $${paramCount + 2}
      RETURNING *
    `;

    const updatedReceipts = await sql(query, [...values, receiptId, userId]);

    if (updatedReceipts.length === 0) {
      return notFound("Receipt not found");
    }

    return Response.json({ receipt: updatedReceipts[0] });
  } catch (error) {
    console.error("PUT /api/receipts/[id] error:", error);
    return handleDatabaseError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const receiptId = parseInt(params.id);

    if (isNaN(receiptId)) {
      return Response.json({ error: "Invalid receipt ID" }, { status: 400 });
    }

    const deletedReceipts = await sql`
      DELETE FROM receipts 
      WHERE id = ${receiptId} AND user_id = ${userId}
      RETURNING id
    `;

    if (deletedReceipts.length === 0) {
      return notFound("Receipt not found");
    }

    // Log the activity for admin tracking
    await logActivity(userId, EVENTS.RECEIPT_DELETED, {
      receipt_id: receiptId,
    });

    return Response.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/receipts/[id] error:", error);
    return handleDatabaseError(error);
  }
}
