import { auth } from "@/auth";
import { generatePDF } from "./utils/pdfGenerator";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.reportMeta || !body.submitter || !body.recipient) {
      return Response.json(
        {
          error: "Missing required fields: reportMeta, submitter, recipient",
        },
        { status: 400 },
      );
    }

    // Validate summary totals
    const lineItemsTotal = (body.line_items || []).reduce(
      (sum, item) => sum + (parseFloat(item.converted_amount) || 0),
      0,
    );
    const expectedTotal =
      (body.summary?.total_reimbursable || 0) +
      (body.summary?.non_reimbursable || 0);

    if (Math.abs(lineItemsTotal - expectedTotal) > 0.01) {
      return Response.json(
        {
          error: "Summary totals don't match line items total",
          details: { lineItemsTotal, expectedTotal },
        },
        { status: 400 },
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const paperSize = url.searchParams.get("paper") || "letter";

    // Generate PDF
    const result = await generatePDF(body, {
      paperSize,
      userId: session.user.id,
    });

    // Return both the PDF stream and metadata
    if (url.searchParams.get("metadata") === "true") {
      return Response.json({
        pdf_url: result.pdf_url,
        pages: result.pages,
        template_used: result.template_used,
        total_reimbursable: body.summary?.total_reimbursable || 0,
        filename: result.filename,
      });
    }

    // Return PDF stream
    return new Response(result.pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return Response.json(
      {
        error: "PDF generation failed",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
