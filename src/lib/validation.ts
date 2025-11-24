import { z } from "zod";

// Enums for categories
export const RECEIPT_CATEGORIES = ["Meals", "Travel", "Supplies", "Other"] as const;
export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "incomplete"] as const;

// Receipt schemas
export const receiptCreateSchema = z.object({
  file_url: z.string().url("File URL must be a valid URL"),
  merchant_name: z.string().min(1, "Merchant name is required").max(255, "Merchant name too long"),
  receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum(RECEIPT_CATEGORIES, { message: `Category must be one of: ${RECEIPT_CATEGORIES.join(", ")}` }),
  note: z.string().optional(),
  currency: z.string().default("USD"),
});

export const receiptUpdateSchema = z.object({
  merchant_name: z.string().min(1, "Merchant name is required").max(255, "Merchant name too long").optional(),
  receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  amount: z.number().positive("Amount must be positive").optional(),
  category: z.enum(RECEIPT_CATEGORIES, { message: `Category must be one of: ${RECEIPT_CATEGORIES.join(", ")}` }).optional(),
  note: z.string().optional(),
  currency: z.string().optional(),
});

// Report schemas
export const reportCreateSchema = z.object({
  receipt_ids: z.array(z.number().int().positive()).min(1, "At least one receipt must be selected"),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  title: z.string().optional(),
  include_items: z.boolean().default(true),
  format: z.enum(["pdf", "csv"]).default("pdf"),
  company_setting_id: z.number().int().positive().optional(),
}).refine((data) => {
  const start = new Date(data.period_start);
  const end = new Date(data.period_end);
  return start <= end;
}, {
  message: "Start date must be before or equal to end date",
  path: ["period_end"],
});

// OCR request schema
export const ocrRequestSchema = z.object({
  file_url: z.string().url("File URL must be a valid URL"),
  filename: z.string().optional(),
});

// Account deletion schema
export const accountDeleteSchema = z.object({
  confirm: z.literal("DELETE", { message: "Confirmation must be exactly 'DELETE'" }),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format").optional(),
  category: z.enum(RECEIPT_CATEGORIES).optional(),
}).refine((data) => {
  if (data.from && data.to) {
    const from = new Date(data.from);
    const to = new Date(data.to);
    return from <= to;
  }
  return true;
}, {
  message: "From date must be before or equal to to date",
  path: ["to"],
});

// Stripe webhook event schema
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.any(),
  }),
  created: z.number(),
});

// Admin metrics schema
export const adminMetricsSchema = z.object({
  period_days: z.number().int().min(1).max(365).default(30),
  include_anomalies: z.boolean().default(true),
});
