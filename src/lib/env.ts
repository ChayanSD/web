import { z } from "zod";

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  
  // Authentication
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  
  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-", "OPENAI_API_KEY must start with 'sk-'"),
  
  // Stripe (support both old and new format for backward compatibility)
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "STRIPE_SECRET_KEY must start with 'sk_'").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with 'whsec_'").optional(),
  STRIPE_SECRET_KEY_LIVE: z.string().startsWith("sk_", "STRIPE_SECRET_KEY_LIVE must start with 'sk_'").optional(),
  STRIPE_SECRET_KEY_TEST: z.string().startsWith("sk_", "STRIPE_SECRET_KEY_TEST must start with 'sk_'").optional(),
  STRIPE_WEBHOOK_SECRET_LIVE: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET_LIVE must start with 'whsec_'").optional(),
  STRIPE_WEBHOOK_SECRET_TEST: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET_TEST must start with 'whsec_'").optional(),
  STRIPE_MODE: z.enum(["live", "test"]).default("test"),
  
  // Admin
  ADMIN_EMAILS: z.string().min(1, "ADMIN_EMAILS is required"),
  
  // Optional
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const placeholderEnv: z.infer<typeof envSchema> = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder",
  AUTH_SECRET:
    process.env.AUTH_SECRET ??
    "placeholder_auth_secret_placeholder_auth",
  AUTH_URL: process.env.AUTH_URL ?? "https://example.com",
  APP_URL: process.env.APP_URL ?? "https://example.com",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "sk-placeholder",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_placeholder",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder",
  STRIPE_SECRET_KEY_LIVE: process.env.STRIPE_SECRET_KEY_LIVE ?? "sk_placeholder_live",
  STRIPE_SECRET_KEY_TEST: process.env.STRIPE_SECRET_KEY_TEST ?? "sk_placeholder_test",
  STRIPE_WEBHOOK_SECRET_LIVE: process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? "whsec_placeholder_live",
  STRIPE_WEBHOOK_SECRET_TEST: process.env.STRIPE_WEBHOOK_SECRET_TEST ?? "whsec_placeholder_test",
  STRIPE_MODE: (process.env.STRIPE_MODE as "live" | "test") ?? "test",
  ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "admin@example.com",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") ?? "development",
};

// Validate environment variables
function validateEnv() {
  // Skip validation during build (Vite/React Router build process)
  // Environment variables are not available during build, only at runtime
  // Check if we're in build mode by looking for build-related process args or missing critical env vars
  const isBuildTime = process.argv.some(arg => 
    arg.includes('build') || 
    arg.includes('vite') ||
    arg.includes('react-router')
  ) || (!process.env.DATABASE_URL && !process.env.VERCEL);
  
  if (process.env.SKIP_ENV_VALIDATION === "true" || isBuildTime) {
    return placeholderEnv;
  }

  try {
    const env = envSchema.parse(process.env);
    
    // Validate Stripe configuration (must have either old format or new format)
    const hasOldFormat = env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET;
    const hasNewFormat = env.STRIPE_MODE === 'live' 
      ? (env.STRIPE_SECRET_KEY_LIVE && env.STRIPE_WEBHOOK_SECRET_LIVE)
      : (env.STRIPE_SECRET_KEY_TEST && env.STRIPE_WEBHOOK_SECRET_TEST);
    
    if (!hasOldFormat && !hasNewFormat) {
      console.error("❌ Stripe configuration error:");
      console.error("  - Must provide either:");
      console.error("    • STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (legacy), or");
      console.error("    • STRIPE_SECRET_KEY_LIVE/TEST + STRIPE_WEBHOOK_SECRET_LIVE/TEST based on STRIPE_MODE");
      process.exit(1);
    }
    
    return env;
  } catch (error) {
    console.error("❌ Environment validation failed:");
    if (error instanceof z.ZodError && error.errors) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
    console.error("\nPlease check your environment variables and try again.");
    process.exit(1);
  }
}

export const env = validateEnv();

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>;
