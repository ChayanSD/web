import sql from "@/app/api/utils/sql.js";
import { getToken } from "@auth/core/jwt";
import { generatePDF } from "../exports/pdf/utils/pdfGenerator";
import { reportCreateSchema } from "@/lib/validation";
import { unauthorized, notFound, badRequest, handleValidationError, handleDatabaseError, paymentRequired } from "@/lib/errors";
import { limitByUser, RATE_LIMITS } from "@/lib/rateLimit";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";

// Enhanced CSV generation with stable headers and ISO dates
function generateCSV(receipts, periodStart, periodEnd) {
  const headers = ["id", "date", "merchant", "category", "amount", "currency", "note", "file_url"];
  const rows = receipts.map((receipt) => [
    receipt.id || "",
    receipt.receipt_date || "N/A",
    receipt.merchant_name || "Unknown",
    receipt.category || "Other",
    receipt.amount || "0.00",
    receipt.currency || "USD",
    receipt.note || "",
    receipt.file_url || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}

// Convert receipts data to PDF export format
function convertToPDFFormat(
  receipts,
  periodStart,
  totalAmount,
  user,
  companySetting = null,
  periodEnd = null,
  title = null,
) {
  // Use provided period or generate from month
  const startDate = periodStart || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = periodEnd || new Date(
    new Date(startDate).getFullYear(),
    new Date(startDate).getMonth() + 1,
    0,
  ).toISOString().split("T")[0];

  const categoryTotals = receipts.reduce((acc, receipt) => {
    const category = receipt.category || "Other";
    acc[category] = (acc[category] || 0) + (parseFloat(receipt.amount) || 0);
    return acc;
  }, {});

  // Build address lines from company setting
  let address_lines = ["123 Business St", "City, State 12345"]; // fallback
  if (companySetting) {
    address_lines = [];
    if (companySetting.address_line_1)
      address_lines.push(companySetting.address_line_1);
    if (companySetting.address_line_2)
      address_lines.push(companySetting.address_line_2);

    // Build city, state, zip line
    const locationParts = [];
    if (companySetting.city) locationParts.push(companySetting.city);
    if (companySetting.state) locationParts.push(companySetting.state);
    if (companySetting.zip_code) locationParts.push(companySetting.zip_code);
    if (locationParts.length > 0) {
      address_lines.push(locationParts.join(", "));
    }

    // Add country if not US
    if (companySetting.country && companySetting.country !== "United States") {
      address_lines.push(companySetting.country);
    }

    // Ensure we have at least one address line
    if (address_lines.length === 0) {
      address_lines.push("Address not provided");
    }
  }

  // Construct full name from first_name and last_name
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.email ||
    "User";

  // Generate report ID with proper format
  const reportId = `RPT-${startDate.replace(/-/g, "").substring(0, 6)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

  return {
    reportMeta: {
      period_start: startDate,
      period_end: endDate,
      generated_at: new Date().toISOString(),
      report_id: reportId,
      timezone: "America/Chicago",
      locale: "en-US",
      currency: "USD",
    },
    submitter: {
      name: fullName,
      email: user.email,
      title: "Employee",
      department: companySetting?.department || "General",
      employee_id: `EMP-${user.id}`,
    },
    recipient: {
      company_name: companySetting?.company_name || "Company Name",
      approver_name: companySetting?.approver_name || "Manager",
      approver_email: companySetting?.approver_email || "manager@company.com",
      address_lines: address_lines,
    },
    branding: {
      primary_color: "#2E86DE",
      accent_color: "#10B981",
      neutral_bg: "#F7F8FA",
      font_heading: "Poppins",
      font_body: "Inter",
      template: "Classic",
    },
    policy: {
      title: "Expense Reimbursement Policy",
      notes: companySetting?.notes
        ? [companySetting.notes]
        : [
          "Submit receipts within 30 days",
          "Business expenses only",
          "Approval required for amounts over $100",
        ],
      violations: [],
    },
    summary: {
      totals_by_category: Object.entries(categoryTotals).map(
        ([category, amount]) => ({
          category,
          amount: parseFloat(amount),
        }),
      ),
      total_reimbursable: totalAmount,
      non_reimbursable: 0.0,
      per_diem_days: 0,
      per_diem_rate: 0.0,
      tax: 0.0,
    },
    line_items: receipts.map((receipt) => ({
      receipt_id: receipt.id,
      date: receipt.receipt_date,
      merchant: receipt.merchant_name || "Unknown",
      category: receipt.category || "Other",
      amount: parseFloat(receipt.amount) || 0,
      currency: receipt.currency || "USD",
      converted_amount: parseFloat(receipt.amount) || 0,
      project_code: companySetting?.cost_center || null,
      notes: receipt.note || `Receipt from ${receipt.receipt_date || "unknown date"}`,
      policy_flag: false,
      file_url: receipt.file_url, // Add receipt file URL for linking
    })),
    appendix: {
      include_receipt_gallery: false,
      receipt_images: [],
    },
    signoff: {
      submitter_signature_text: "I certify that these expenses are accurate and incurred for work-related purposes. I understand that any false or misleading information may result in disciplinary action.",
      approver_signature_placeholder: true,
    },
    title: title || `Expense Report - ${startDate} to ${endDate}`,
  };
}

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

    // Check subscription limits for report exports
    const subscriptionCheck = await checkSubscriptionLimit(userId, 'report_exports');
    if (!subscriptionCheck.allowed) {
      return paymentRequired(subscriptionCheck.reason, {
        upgradeRequired: subscriptionCheck.upgradeRequired,
        currentTier: 'free', // This would be fetched from subscription info
      });
    }

    // Rate limiting
    const rateLimit = await limitByUser(userId, "reports:create", RATE_LIMITS.REPORTS_CREATE.windowMs, RATE_LIMITS.REPORTS_CREATE.max);
    if (!rateLimit.ok) {
      return Response.json({ error: "Rate limit exceeded", reset: rateLimit.reset }, { status: 429 });
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = reportCreateSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { receipt_ids, period_start, period_end, title, include_items, format, company_setting_id } = validation.data;

    // Fetch user data with first_name and last_name
    const users = await sql`
      SELECT id, email, first_name, last_name 
      FROM auth_users 
      WHERE id = ${userId}
    `;

    if (users.length === 0) {
      return notFound("User not found");
    }

    const user = users[0];

    // Get receipts by IDs with proper user scoping
    const receipts = await sql`
      SELECT * FROM receipts 
      WHERE user_id = ${userId} 
      AND id = ANY(${receipt_ids})
      AND receipt_date >= ${period_start}
      AND receipt_date <= ${period_end}
      ORDER BY receipt_date DESC
    `;

    if (receipts.length === 0) {
      return badRequest("No receipts found for the selected period");
    }

    // Get company settings if specified
    let companySetting = null;
    if (company_setting_id) {
      const companySettings = await sql`
        SELECT * FROM company_settings 
        WHERE user_id = ${userId} AND id = ${company_setting_id}
      `;
      companySetting = companySettings[0];
    }

    // If no specific company setting, try to get the default
    if (!companySetting) {
      const defaultSettings = await sql`
        SELECT * FROM company_settings 
        WHERE user_id = ${userId} AND is_default = true
      `;
      companySetting = defaultSettings[0];
    }

    // If still no company setting, get any company setting or use fallback
    if (!companySetting) {
      const anySettings = await sql`
        SELECT * FROM company_settings 
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      companySetting = anySettings[0];
    }

    const totalAmount = receipts.reduce(
      (sum, receipt) => sum + (parseFloat(receipt.amount) || 0),
      0,
    );

    let reportData;
    let mimeType;
    let filename;
    let reportUrl;

    if (format === "csv") {
      reportData = generateCSV(receipts, period_start, period_end);
      mimeType = "text/csv";
      filename = `expense-report-${period_start}-to-${period_end}.csv`;

      const blob = Buffer.from(reportData).toString("base64");
      reportUrl = `data:${mimeType};base64,${blob}`;
    } else {
      // Use new professional PDF export with company settings and proper user name
      const pdfData = convertToPDFFormat(
        receipts,
        period_start,
        totalAmount,
        user,
        companySetting,
        period_end,
        title
      );
      const pdfResult = await generatePDF(pdfData, { userId });

      reportData = pdfResult;
      mimeType = "application/pdf";
      filename = pdfResult.filename;
      reportUrl = pdfResult.pdf_url;
    }

    // Save report record to database
    const report = await sql`
      INSERT INTO reports (user_id, period_start, period_end, title, total_amount, csv_url, pdf_url, receipt_count)
      VALUES (
        ${userId}, 
        ${period_start},
        ${period_end},
        ${title || null},
        ${totalAmount},
        ${format === "csv" ? reportUrl : null},
        ${format === "pdf" ? reportUrl : null},
        ${receipts.length}
      )
      RETURNING *
    `;

    // Increment usage counter
    await incrementUsage(userId, 'report_exports');

    if (format === "pdf") {
      return Response.json({
        success: true,
        report: report[0],
        download_url: reportUrl,
        filename,
        total_amount: totalAmount,
        receipt_count: receipts.length,
        pages: reportData.pages,
        template_used: reportData.template_used,
      });
    }

    return Response.json({
      success: true,
      report: report[0],
      download_url: reportUrl,
      filename,
      total_amount: totalAmount,
      receipt_count: receipts.length,
    });
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return handleDatabaseError(error);
  }
}

export async function GET(request) {
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

    const reports = await sql`
      SELECT * FROM reports 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return Response.json({ reports });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return handleDatabaseError(error);
  }
}
