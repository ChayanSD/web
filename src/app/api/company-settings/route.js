import sql from "@/app/api/utils/sql";
import { getToken } from "@auth/core/jwt";

export async function GET(request) {
  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith("https") ?? false,
    });

    if (!jwt || !jwt.sub) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(jwt.sub);

    // Get all company settings for the user
    const settings = await sql`
      SELECT * FROM company_settings 
      WHERE user_id = ${userId}
      ORDER BY is_default DESC, setting_name ASC
    `;

    return Response.json({ settings });
  } catch (error) {
    console.error("GET /api/company-settings error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith("https") ?? false,
    });

    if (!jwt || !jwt.sub) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(jwt.sub);
    const body = await request.json();

    const {
      setting_name = "default",
      company_name,
      approver_name,
      approver_email,
      address_line_1,
      address_line_2,
      city,
      state,
      zip_code,
      country = "United States",
      department,
      cost_center,
      notes,
      is_default = false,
    } = body;

    // Basic validation
    if (!company_name || !approver_name || !approver_email) {
      return Response.json(
        {
          error: "Company name, approver name, and approver email are required",
        },
        { status: 400 },
      );
    }

    // If this is set as default, remove default from other settings
    if (is_default) {
      await sql`
        UPDATE company_settings 
        SET is_default = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId}
      `;
    }

    // Check if setting with this name already exists
    const existingSetting = await sql`
      SELECT id FROM company_settings 
      WHERE user_id = ${userId} AND setting_name = ${setting_name}
    `;

    let result;
    if (existingSetting.length > 0) {
      // Update existing setting
      result = await sql`
        UPDATE company_settings SET
          company_name = ${company_name},
          approver_name = ${approver_name},
          approver_email = ${approver_email},
          address_line_1 = ${address_line_1},
          address_line_2 = ${address_line_2},
          city = ${city},
          state = ${state},
          zip_code = ${zip_code},
          country = ${country},
          department = ${department},
          cost_center = ${cost_center},
          notes = ${notes},
          is_default = ${is_default},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND setting_name = ${setting_name}
        RETURNING *
      `;
    } else {
      // Create new setting
      result = await sql`
        INSERT INTO company_settings (
          user_id, setting_name, company_name, approver_name, approver_email,
          address_line_1, address_line_2, city, state, zip_code, country,
          department, cost_center, notes, is_default
        ) VALUES (
          ${userId}, ${setting_name}, ${company_name}, ${approver_name}, ${approver_email},
          ${address_line_1}, ${address_line_2}, ${city}, ${state}, ${zip_code}, ${country},
          ${department}, ${cost_center}, ${notes}, ${is_default}
        ) RETURNING *
      `;
    }

    return Response.json({
      success: true,
      setting: result[0],
      message:
        existingSetting.length > 0
          ? "Setting updated successfully"
          : "Setting created successfully",
    });
  } catch (error) {
    console.error("POST /api/company-settings error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith("https") ?? false,
    });

    if (!jwt || !jwt.sub) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(jwt.sub);
    const { searchParams } = new URL(request.url);
    const settingId = searchParams.get("id");

    if (!settingId) {
      return Response.json(
        { error: "Setting ID is required" },
        { status: 400 },
      );
    }

    // Check if this is the only setting or if it's the default
    const setting = await sql`
      SELECT * FROM company_settings 
      WHERE id = ${settingId} AND user_id = ${userId}
    `;

    if (setting.length === 0) {
      return Response.json({ error: "Setting not found" }, { status: 404 });
    }

    // Count total settings for this user
    const totalSettings = await sql`
      SELECT COUNT(*) as count FROM company_settings 
      WHERE user_id = ${userId}
    `;

    if (parseInt(totalSettings[0].count) <= 1) {
      return Response.json(
        { error: "Cannot delete the only company setting" },
        { status: 400 },
      );
    }

    // If deleting the default, make another one default
    if (setting[0].is_default) {
      await sql`
        UPDATE company_settings SET is_default = true, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND id != ${settingId}
        LIMIT 1
      `;
    }

    // Delete the setting
    await sql`
      DELETE FROM company_settings 
      WHERE id = ${settingId} AND user_id = ${userId}
    `;

    return Response.json({
      success: true,
      message: "Setting deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/company-settings error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
