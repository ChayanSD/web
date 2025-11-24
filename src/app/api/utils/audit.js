import sql from "./sql";

export const logActivity = async (userId, event, meta = {}) => {
  try {
    await sql`
      INSERT INTO audit_log (user_id, event, meta)
      VALUES (${userId}, ${event}, ${JSON.stringify(meta)})
    `;
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw error to avoid breaking main functionality
  }
};

// Common activity events
export const EVENTS = {
  USER_SIGNUP: "User signed up",
  USER_SIGNIN: "User signed in",
  USER_SIGNOUT: "User signed out",
  RECEIPT_UPLOADED: "Receipt uploaded",
  RECEIPT_DELETED: "Receipt deleted",
  REPORT_GENERATED: "Report generated",
  COMPANY_SETTINGS_CREATED: "Company settings created",
  COMPANY_SETTINGS_UPDATED: "Company settings updated",
  SUBSCRIPTION_CHANGED: "Subscription changed",
  PAYMENT_PROCESSED: "Payment processed",
};
