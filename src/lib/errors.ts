// Standardized error response helpers
export interface ErrorResponse {
  error: string;
  fieldErrors?: Record<string, string>;
}

export function badRequest(message: string, fieldErrors?: Record<string, string>): Response {
  return Response.json({ error: message, fieldErrors }, { status: 400 });
}

export function unauthorized(message: string = "Unauthorized"): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message: string = "Forbidden"): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function notFound(message: string = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}

export function rateLimited(message: string = "Rate limit exceeded", reset?: number): Response {
  const response = Response.json({ 
    error: message,
    ...(reset && { reset })
  }, { status: 429 });
  
  if (reset) {
    response.headers.set("Retry-After", Math.ceil((reset - Date.now()) / 1000).toString());
  }
  
  return response;
}

export function paymentRequired(message: string, metadata?: { upgradeRequired?: string; currentTier?: string }): Response {
  return Response.json(
    { 
      error: message,
      code: "SUBSCRIPTION_LIMIT_REACHED",
      metadata: metadata || undefined,
      timestamp: new Date().toISOString()
    },
    { status: 402 }
  );
}

export function internalServerError(message: string = "Internal Server Error"): Response {
  return Response.json({ error: message }, { status: 500 });
}

export function conflict(message: string = "Conflict"): Response {
  return Response.json({ error: message }, { status: 409 });
}

// Helper to handle Zod validation errors
export function handleValidationError(error: any): Response {
  if (error.issues) {
    const fieldErrors: Record<string, string> = {};
    error.issues.forEach((issue: any) => {
      const path = issue.path.join(".");
      fieldErrors[path] = issue.message;
    });
    return badRequest("Validation failed", fieldErrors);
  }
  return badRequest("Invalid input");
}

// Helper to handle database errors
export function handleDatabaseError(error: any): Response {
  console.error("Database error:", error);
  
  if (error.message?.includes("duplicate key")) {
    return conflict("Resource already exists");
  }
  
  if (error.message?.includes("foreign key")) {
    return badRequest("Invalid reference");
  }
  
  if (error.message?.includes("invalid input syntax")) {
    return badRequest("Invalid data format");
  }
  
  return internalServerError("Database operation failed");
}

// Helper to handle Stripe errors
export function handleStripeError(error: any): Response {
  console.error("Stripe error:", error);
  
  if (error.type === "StripeCardError") {
    return badRequest("Payment method declined");
  }
  
  if (error.type === "StripeRateLimitError") {
    return rateLimited("Payment service rate limited");
  }
  
  return internalServerError("Payment processing failed");
}
