import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logActivity, EVENTS } from "@/app/api/utils/audit";
import { receiptCreateSchema, paginationSchema } from "@/lib/validation";
import { badRequest, unauthorized, internalServerError, handleValidationError, handleDatabaseError, paymentRequired } from "@/lib/errors";
import { limitByUser, RATE_LIMITS } from "@/lib/rateLimit";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const queryParams = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      category: searchParams.get("category"),
    };

    const validation = paginationSchema.safeParse(queryParams);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { page, limit, from, to, category } = validation.data;
    const offset = (page - 1) * limit;

    // Rate limiting
    const rateLimit = await limitByUser(userId, "receipts:read", RATE_LIMITS.RECEIPTS_READ.windowMs, RATE_LIMITS.RECEIPTS_READ.max);
    if (!rateLimit.ok) {
      return Response.json({ error: "Rate limit exceeded", reset: rateLimit.reset }, { status: 429 });
    }

    // Build query with proper user scoping
    let query = `SELECT * FROM receipts WHERE user_id = $1`;
    let params = [userId];
    let paramCount = 1;

    if (from) {
      paramCount++;
      query += ` AND receipt_date >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      query += ` AND receipt_date <= $${paramCount}`;
      params.push(to);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    query += ` ORDER BY receipt_date DESC, created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const receipts = await sql(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM receipts WHERE user_id = $1`;
    let countParams = [userId];
    let countParamCount = 1;

    if (from) {
      countParamCount++;
      countQuery += ` AND receipt_date >= $${countParamCount}`;
      countParams.push(from);
    }

    if (to) {
      countParamCount++;
      countQuery += ` AND receipt_date <= $${countParamCount}`;
      countParams.push(to);
    }

    if (category) {
      countParamCount++;
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
    }

    const countResult = await sql(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || "0");

    return Response.json({ 
      receipts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error("GET /api/receipts error:", error);
    return handleDatabaseError(error);
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const body = await request.json();

    // Check subscription limits for receipt uploads
    const subscriptionCheck = await checkSubscriptionLimit(userId, 'receipt_uploads');
    if (!subscriptionCheck.allowed) {
      return paymentRequired(subscriptionCheck.reason, {
        upgradeRequired: subscriptionCheck.upgradeRequired,
        currentTier: 'free', // This would be fetched from subscription info
      });
    }

    // Rate limiting
    const rateLimit = await limitByUser(userId, "receipts:create", RATE_LIMITS.RECEIPTS_CREATE.windowMs, RATE_LIMITS.RECEIPTS_CREATE.max);
    if (!rateLimit.ok) {
      return Response.json({ error: "Rate limit exceeded", reset: rateLimit.reset }, { status: 429 });
    }

    // Validate input with Zod
    const validation = receiptCreateSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { file_url, merchant_name, receipt_date, amount, category, note, currency } = validation.data;

    // Check for duplicate receipts (same merchant, amount, date within 90 days)
    const duplicateCheck = await sql`
      SELECT id FROM receipts 
      WHERE user_id = ${userId} 
        AND merchant_name = ${merchant_name}
        AND amount = ${amount}
        AND receipt_date = ${receipt_date}
        AND created_at > NOW() - INTERVAL '90 days'
      LIMIT 1
    `;

    if (duplicateCheck.length > 0) {
      return Response.json({ 
        error: "Duplicate receipt detected",
        fieldErrors: { 
          general: "A receipt with the same merchant, amount, and date already exists within the last 90 days" 
        }
      }, { status: 409 });
    }

    const receipt = await sql`
      INSERT INTO receipts (user_id, file_url, merchant_name, receipt_date, amount, category, note, currency)
      VALUES (${userId}, ${file_url}, ${merchant_name}, ${receipt_date}, ${amount}, ${category}, ${note || null}, ${currency})
      RETURNING *
    `;

    // Increment usage counter
    await incrementUsage(userId, 'receipt_uploads');

    // Log the activity for admin tracking
    await logActivity(userId, EVENTS.RECEIPT_UPLOADED, {
      receipt_id: receipt[0].id,
      merchant_name,
      amount,
      category,
    });

    return Response.json({ receipt: receipt[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/receipts error:", error);
    return handleDatabaseError(error);
  }
}
