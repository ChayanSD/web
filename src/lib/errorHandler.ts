import { serializeError } from 'serialize-error';

// Production error handler
export function handleProductionError(error: any, context?: string) {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(2, 15);
  
  // Log error details
  console.error(`[${timestamp}] Error ID: ${errorId}`, {
    context,
    error: serializeError(error),
    stack: error.stack,
  });
  
  // Return safe error response
  if (process.env.NODE_ENV === 'production') {
    return {
      error: 'Internal Server Error',
      errorId,
      timestamp,
    };
  } else {
    return {
      error: error.message || 'Internal Server Error',
      errorId,
      timestamp,
      details: error.stack,
    };
  }
}

// Global error handler for unhandled rejections
export function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you'd send this to your error tracking service
  });
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // In production, you'd send this to your error tracking service
    process.exit(1);
  });
}
