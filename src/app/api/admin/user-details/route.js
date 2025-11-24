import sql from "@/app/api/utils/sql.js";
import { auth } from "@/auth";

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
    const { user_id, timeframe = "30d" } = body;

    if (!user_id) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    // Get user basic info
    const [userInfo] = await sql`
      SELECT 
        id, email, name, first_name, last_name, 
        subscription_tier, is_admin, created_at,
        last_check_subscription_status_at
      FROM auth_users 
      WHERE id = ${user_id}
    `;

    if (!userInfo) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Get user statistics
    const userStats = await sql`
      SELECT 
        COUNT(*) as total_receipts,
        COALESCE(SUM(amount), 0) as total_amount
      FROM receipts 
      WHERE user_id = ${user_id}
    `;

    // Get period-specific statistics
    let periodStats = [{ receipts_this_period: 0, amount_this_period: 0 }];
    if (timeframe !== "all") {
      const days = { "7d": 7, "30d": 30, "90d": 90 }[timeframe] || 30;
      periodStats = await sql`
        SELECT 
          COUNT(*) as receipts_this_period,
          COALESCE(SUM(amount), 0) as amount_this_period
        FROM receipts 
        WHERE user_id = ${user_id}
        AND created_at >= NOW() - INTERVAL ${days} DAY
      `;
    }

    // Get reports count
    const reportsStats = await sql`
      SELECT COUNT(*) as total_reports
      FROM reports 
      WHERE user_id = ${user_id}
    `;

    let reportsThisPeriod = [{ reports_this_period: 0 }];
    if (timeframe !== "all") {
      const days = { "7d": 7, "30d": 30, "90d": 90 }[timeframe] || 30;
      reportsThisPeriod = await sql`
        SELECT COUNT(*) as reports_this_period
        FROM reports 
        WHERE user_id = ${user_id}
        AND created_at >= NOW() - INTERVAL ${days} DAY
      `;
    }

    // Get recent activity
    const recentActivity = await sql`
      SELECT event, created_at, meta
      FROM audit_log 
      WHERE user_id = ${user_id}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Get category breakdown
    const categoryBreakdown = await sql`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM receipts 
      WHERE user_id = ${user_id}
      GROUP BY category
      ORDER BY total DESC
    `;

    // Get user receipts (limited to recent ones)
    let receipts;
    if (timeframe === "all") {
      receipts = await sql`
        SELECT 
          id, merchant_name, amount, category, 
          receipt_date, created_at, file_url
        FROM receipts 
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC 
        LIMIT 50
      `;
    } else {
      const days = { "7d": 7, "30d": 30, "90d": 90 }[timeframe] || 30;
      receipts = await sql`
        SELECT 
          id, merchant_name, amount, category, 
          receipt_date, created_at, file_url
        FROM receipts 
        WHERE user_id = ${user_id}
        AND created_at >= NOW() - INTERVAL ${days} DAY
        ORDER BY created_at DESC 
        LIMIT 50
      `;
    }

    // Get last activity
    const lastActivityQuery = await sql`
      SELECT MAX(created_at) as last_activity
      FROM audit_log 
      WHERE user_id = ${user_id}
    `;

    const response = {
      user: userInfo,
      stats: {
        totalReceipts: parseInt(userStats[0]?.total_receipts || 0),
        totalAmount: parseFloat(userStats[0]?.total_amount || 0),
        receiptsThisPeriod: parseInt(periodStats[0]?.receipts_this_period || 0),
        amountThisPeriod: parseFloat(periodStats[0]?.amount_this_period || 0),
        totalReports: parseInt(reportsStats[0]?.total_reports || 0),
        reportsThisPeriod: parseInt(
          reportsThisPeriod[0]?.reports_this_period || 0,
        ),
        lastActivity: lastActivityQuery[0]?.last_activity,
      },
      recentActivity: recentActivity || [],
      categoryBreakdown: categoryBreakdown || [],
      receipts: receipts || [],
    };

    return Response.json(response);
  } catch (error) {
    console.error("Admin user details error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
