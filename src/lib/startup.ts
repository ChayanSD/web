import { env } from './env';
import { setupGlobalErrorHandlers } from './errorHandler';

// Production startup validation
export function validateProductionSetup() {
  console.log('🚀 Starting ReimburseMe in production mode...');
  
  // Validate environment
  console.log('✅ Environment variables validated');
  
  // Check critical services
  // Get Stripe key (support both old and new format)
  const isLive = env.STRIPE_MODE === 'live';
  const stripeKey = isLive ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST;
  const finalStripeKey = stripeKey || env.STRIPE_SECRET_KEY;
  
  const checks = [
    { name: 'Database', url: env.DATABASE_URL },
    { name: 'OpenAI', key: env.OPENAI_API_KEY },
    { name: 'Stripe', key: finalStripeKey },
    { name: 'Admin Emails', emails: env.ADMIN_EMAILS },
  ];
  
  checks.forEach(check => {
    if (check.url) {
      console.log(`✅ ${check.name}: Configured`);
    } else if (check.key) {
      console.log(`✅ ${check.name}: Configured`);
    } else if (check.emails) {
      console.log(`✅ ${check.name}: ${check.emails.split(',').length} configured`);
    }
  });
  
  // Setup error handlers
  setupGlobalErrorHandlers();
  console.log('✅ Global error handlers configured');
  
  console.log('🎉 Production setup complete!');
}

// Health check for startup
export async function startupHealthCheck() {
  try {
    const { default: sql } = await import('../app/api/utils/sql');
    await sql`SELECT 1 as health_check`;
    console.log('✅ Database connection verified');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}
