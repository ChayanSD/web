import { env } from './env';

// Key rotation and validation
export class KeySecurityManager {
  private static instance: KeySecurityManager;
  private keyRotationLog: Map<string, { lastRotated: Date; rotationCount: number }> = new Map();

  static getInstance(): KeySecurityManager {
    if (!KeySecurityManager.instance) {
      KeySecurityManager.instance = new KeySecurityManager();
    }
    return KeySecurityManager.instance;
  }

  // Validate API keys format and strength
  validateKeys() {
    const issues: string[] = [];

    // OpenAI API Key validation
    if (!env.OPENAI_API_KEY.startsWith('sk-')) {
      issues.push('Invalid OpenAI API key format');
    }

    // Stripe Key validation (support both old and new format)
    const isLive = env.STRIPE_MODE === 'live';
    const stripeKey = isLive ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST;
    const finalStripeKey = stripeKey || env.STRIPE_SECRET_KEY;
    
    if (finalStripeKey && !finalStripeKey.startsWith('sk_')) {
      issues.push('Invalid Stripe secret key format');
    }

    // Webhook secret validation (support both old and new format)
    const webhookSecret = isLive ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST;
    const finalWebhookSecret = webhookSecret || env.STRIPE_WEBHOOK_SECRET;
    
    if (finalWebhookSecret && !finalWebhookSecret.startsWith('whsec_')) {
      issues.push('Invalid Stripe webhook secret format');
    }

    // AUTH_SECRET strength check
    if (env.AUTH_SECRET.length < 32) {
      issues.push('AUTH_SECRET must be at least 32 characters');
    }

    if (issues.length > 0) {
      throw new Error(`Security validation failed: ${issues.join(', ')}`);
    }

    return true;
  }

  // Log key usage for monitoring
  logKeyUsage(keyType: string, operation: string, success: boolean) {
    const timestamp = new Date().toISOString();
    console.log(`[KEY_USAGE] ${timestamp} - ${keyType} - ${operation} - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to your monitoring service (e.g., Sentry, DataDog)
      this.sendToMonitoring({
        type: 'key_usage',
        keyType,
        operation,
        success,
        timestamp,
      });
    }
  }

  // Detect suspicious key usage patterns
  detectAnomalies(keyType: string, operation: string) {
    // Implement rate limiting per key type
    const key = `${keyType}_${operation}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 100; // Max requests per minute

    // This would integrate with your rate limiting system
    return {
      isAnomalous: false, // Implement actual anomaly detection
      riskScore: 0,
      recommendations: []
    };
  }

  private sendToMonitoring(data: any) {
    // Implement monitoring service integration
    console.log('[MONITORING]', data);
  }
}

// Key access wrapper with logging
export function withKeyProtection<T>(
  keyType: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const securityManager = KeySecurityManager.getInstance();
  
  return fn()
    .then(result => {
      securityManager.logKeyUsage(keyType, operation, true);
      return result;
    })
    .catch(error => {
      securityManager.logKeyUsage(keyType, operation, false);
      throw error;
    });
}

// Secure key storage for runtime
export class SecureKeyStore {
  private static keys: Map<string, string> = new Map();
  private static encryptionKey: string;

  static initialize() {
    // Initialize with environment variables (support both old and new Stripe key format)
    this.keys.set('openai', env.OPENAI_API_KEY);
    
    // Get Stripe key (prefer new format, fallback to old format)
    const isLive = env.STRIPE_MODE === 'live';
    const stripeKey = isLive ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST;
    const finalStripeKey = stripeKey || env.STRIPE_SECRET_KEY;
    if (finalStripeKey) {
      this.keys.set('stripe', finalStripeKey);
    }
    
    // Get webhook secret (prefer new format, fallback to old format)
    const webhookSecret = isLive ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST;
    const finalWebhookSecret = webhookSecret || env.STRIPE_WEBHOOK_SECRET;
    if (finalWebhookSecret) {
      this.keys.set('webhook', finalWebhookSecret);
    }
    
    this.keys.set('auth', env.AUTH_SECRET);
  }

  static getKey(keyName: string): string {
    const key = this.keys.get(keyName);
    if (!key) {
      throw new Error(`Key ${keyName} not found`);
    }
    return key;
  }

  // Rotate keys at runtime (for production key rotation)
  static rotateKey(keyName: string, newKey: string) {
    this.keys.set(keyName, newKey);
    console.log(`[SECURITY] Key ${keyName} rotated successfully`);
  }

  // Clear sensitive data from memory
  static clearKeys() {
    this.keys.clear();
    console.log('[SECURITY] All keys cleared from memory');
  }
}

// Initialize secure key store
SecureKeyStore.initialize();
