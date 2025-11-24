import sql from "@/app/api/utils/sql";
import { env } from "@/lib/env";
import { KeySecurityManager, SecureKeyStore } from "@/lib/security";

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    const dbStart = Date.now();
    await sql`SELECT 1 as health_check`;
    const dbTime = Date.now() - dbStart;
    
    // Check OpenAI API (if key is provided)
    let openaiStatus = "not_configured";
    if (env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "User-Agent": "ReimburseMe-HealthCheck/1.0",
          },
        });
        openaiStatus = response.ok ? "healthy" : "unhealthy";
      } catch (error) {
        openaiStatus = "error";
      }
    }

    // Validate all keys
    let keyValidationStatus = "unknown";
    try {
      const securityManager = KeySecurityManager.getInstance();
      securityManager.validateKeys();
      keyValidationStatus = "valid";
    } catch (error) {
      keyValidationStatus = "invalid";
      console.error("Key validation failed:", error.message);
    }
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      response_time_ms: responseTime,
      services: {
        database: {
          status: "healthy",
          response_time_ms: dbTime,
        },
        openai: {
          status: openaiStatus,
        },
        redis: {
          status: env.UPSTASH_REDIS_REST_URL ? "configured" : "not_configured",
        },
        key_validation: {
          status: keyValidationStatus,
        },
      },
    };
    
    return Response.json(health, { 
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
    
  } catch (error) {
    console.error("Health check failed:", error);
    
    const health = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: {
          status: "unhealthy",
          error: error.message,
        },
      },
    };
    
    return Response.json(health, { 
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }
}
