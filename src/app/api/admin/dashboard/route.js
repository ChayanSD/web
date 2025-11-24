import sql from "@/app/api/utils/sql";
import { withAdmin } from "@/lib/auth";
import { handleDatabaseError } from "@/lib/errors";

// Check if user is admin
async function isAdmin(userId) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
  
  if (adminEmails.length === 0) {
    return false;
  }

  const users = await sql`
    SELECT email FROM auth_users 
    WHERE id = ${userId}
  `;

  if (users.length === 0) {
    return false;
  }

  return adminEmails.includes(users[0].email);
}

// Get metrics for the last 30 days
async function getMetrics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Receipts today
  const receiptsToday = await sql`
    SELECT COUNT(*) as count FROM receipts 
    WHERE created_at >= ${today.toISOString()} 
    AND created_at < ${tomorrow.toISOString()}
  `;

  // Receipts yesterday for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const receiptsYesterday = await sql`
    SELECT COUNT(*) as count FROM receipts 
    WHERE created_at >= ${yesterday.toISOString()} 
    AND created_at < ${today.toISOString()}
  `;

  // Reports today
  const reportsToday = await sql`
    SELECT COUNT(*) as count FROM reports 
    WHERE created_at >= ${today.toISOString()} 
    AND created_at < ${tomorrow.toISOString()}
  `;

  // Reports yesterday for comparison
  const reportsYesterday = await sql`
    SELECT COUNT(*) as count FROM reports 
    WHERE created_at >= ${yesterday.toISOString()} 
    AND created_at < ${today.toISOString()}
  `;

  // OCR success rate (assuming we track this in audit_log)
  const ocrAttempts = await sql`
    SELECT COUNT(*) as count FROM audit_log 
    WHERE event_type = 'OCR_PROCESSED' 
    AND created_at >= ${thirtyDaysAgo.toISOString()}
  `;

  const ocrFailures = await sql`
    SELECT COUNT(*) as count FROM audit_log 
    WHERE event_type = 'OCR_FAILED' 
    AND created_at >= ${thirtyDaysAgo.toISOString()}
  `;

  // Active subscriptions
  const activeSubscriptions = await sql`
    SELECT COUNT(*) as count FROM auth_users 
    WHERE subscription_status = 'active'
  `;

  // Receipts over last 30 days
  const receipts30Days = await sql`
    SELECT COUNT(*) as count FROM receipts 
    WHERE created_at >= ${thirtyDaysAgo.toISOString()}
  `;

  // Calculate changes
  const receiptsChange = receiptsYesterday[0]?.count > 0 
    ? Math.round(((receiptsToday[0]?.count - receiptsYesterday[0]?.count) / receiptsYesterday[0]?.count) * 100)
    : 0;

  const reportsChange = reportsYesterday[0]?.count > 0 
    ? Math.round(((reportsToday[0]?.count - reportsYesterday[0]?.count) / reportsYesterday[0]?.count) * 100)
    : 0;

  const totalOcrAttempts = (ocrAttempts[0]?.count || 0) + (ocrFailures[0]?.count || 0);
  const ocrSuccessRate = totalOcrAttempts > 0 
    ? (ocrAttempts[0]?.count || 0) / totalOcrAttempts 
    : 0;

  return {
    receipts_today: receiptsToday[0]?.count || 0,
    receipts_change: receiptsChange,
    reports_today: reportsToday[0]?.count || 0,
    reports_change: reportsChange,
    ocr_success_rate: ocrSuccessRate,
    ocr_change: 0, // Would need historical data to calculate
    active_subscriptions: activeSubscriptions[0]?.count || 0,
    subscription_change: 0, // Would need historical data to calculate
    receipts_30_days: receipts30Days[0]?.count || 0,
  };
}

// Detect anomalies
async function detectAnomalies() {
  const anomalies = [];

  // Check for large amounts
  const largeAmounts = await sql`
    SELECT id, merchant_name, amount, receipt_date, user_id
    FROM receipts 
    WHERE amount > 1000 
    AND created_at >= NOW() - INTERVAL '7 days'
    ORDER BY amount DESC
    LIMIT 10
  `;

  if (largeAmounts.length > 0) {
    anomalies.push({
      type: "Large Amounts",
      description: `${largeAmounts.length} receipts over $1,000 in the last 7 days`,
      detected_at: new Date().toISOString(),
      severity: "medium",
      data: largeAmounts
    });
  }

  // Check for duplicate candidates
  const duplicates = await sql`
    SELECT merchant_name, amount, receipt_date, COUNT(*) as count
    FROM receipts 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY merchant_name, amount, receipt_date
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 5
  `;

  if (duplicates.length > 0) {
    anomalies.push({
      type: "Potential Duplicates",
      description: `${duplicates.length} sets of receipts with identical merchant, amount, and date`,
      detected_at: new Date().toISOString(),
      severity: "low",
      data: duplicates
    });
  }

  // Check for future dates
  const futureDates = await sql`
    SELECT id, merchant_name, receipt_date, user_id
    FROM receipts 
    WHERE receipt_date > CURRENT_DATE
    AND created_at >= NOW() - INTERVAL '7 days'
    LIMIT 10
  `;

  if (futureDates.length > 0) {
    anomalies.push({
      type: "Future Dates",
      description: `${futureDates.length} receipts with future dates`,
      detected_at: new Date().toISOString(),
      severity: "high",
      data: futureDates
    });
  }

  // Check for high OCR failure rate
  const recentOcrAttempts = await sql`
    SELECT COUNT(*) as count FROM audit_log 
    WHERE event_type = 'OCR_PROCESSED' 
    AND created_at >= NOW() - INTERVAL '24 hours'
  `;

  const recentOcrFailures = await sql`
    SELECT COUNT(*) as count FROM audit_log 
    WHERE event_type = 'OCR_FAILED' 
    AND created_at >= NOW() - INTERVAL '24 hours'
  `;

  const totalRecentOcr = (recentOcrAttempts[0]?.count || 0) + (recentOcrFailures[0]?.count || 0);
  const failureRate = totalRecentOcr > 0 ? (recentOcrFailures[0]?.count || 0) / totalRecentOcr : 0;

  if (failureRate > 0.3 && totalRecentOcr > 5) {
    anomalies.push({
      type: "High OCR Failure Rate",
      description: `${Math.round(failureRate * 100)}% OCR failure rate in the last 24 hours`,
      detected_at: new Date().toISOString(),
      severity: "high",
      data: { failureRate, totalAttempts: totalRecentOcr }
    });
  }

  return anomalies;
}

export const GET = withAdmin(async (request, auth) => {
  try {
    // Get metrics and anomalies
    const [metrics, anomalies] = await Promise.all([
      getMetrics(),
      detectAnomalies()
    ]);

    return Response.json({
      success: true,
      metrics,
      anomalies,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return handleDatabaseError(error);
  }
});