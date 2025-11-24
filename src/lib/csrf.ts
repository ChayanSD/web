import { createHash, randomBytes } from 'crypto';

// CSRF token generation
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

// CSRF token validation
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) {
    return false;
  }
  
  // In production, you'd store tokens in Redis/session and compare
  // For now, we'll use a simple comparison
  return token === sessionToken;
}

// CSRF middleware for API routes
export function withCSRF(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    // Skip CSRF for GET requests and webhooks
    if (request.method === 'GET' || request.url.includes('/webhook')) {
      return handler(request);
    }
    
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionToken = request.headers.get('x-session-token');
    
    if (!csrfToken || !sessionToken) {
      return Response.json(
        { error: 'CSRF token required' },
        { status: 403 }
      );
    }
    
    if (!validateCSRFToken(csrfToken, sessionToken)) {
      return Response.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
    
    return handler(request);
  };
}
