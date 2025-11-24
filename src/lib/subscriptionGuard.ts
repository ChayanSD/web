import { getAuthUser } from './auth';
import { unauthorized, forbidden, paymentRequired, internalServerError } from './errors';
import sql from '../app/api/utils/sql.js';

export interface SubscriptionInfo {
  tier: string;
  status: string;
  trialEnd?: Date;
  subscriptionEnd?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  earlyAdopter: boolean;
  lifetimeDiscount: number;
  features: string[];
  usageReceipts: number;
  usageReports: number;
}

export interface SubscriptionLimits {
  maxReceipts: number;
  maxReports: number;
  hasEmailIngestion: boolean;
  hasTeamCollaboration: boolean;
  hasAnalytics: boolean;
  hasCustomBranding: boolean;
  hasCSVExport: boolean;
  hasPriorityProcessing: boolean;
}

// Get user subscription information
export async function getUserSubscriptionInfo(userId: number): Promise<SubscriptionInfo | null> {
  try {
    const result = await sql`
      SELECT * FROM get_user_subscription_info(${userId})
    `;
    
    if (result.length === 0) return null;
    
    const sub = result[0];
    return {
      tier: sub.tier,
      status: sub.status,
      trialEnd: sub.trial_end ? new Date(sub.trial_end) : undefined,
      subscriptionEnd: sub.subscription_end ? new Date(sub.subscription_end) : undefined,
      stripeCustomerId: sub.stripe_customer_id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      earlyAdopter: sub.early_adopter,
      lifetimeDiscount: sub.lifetime_discount,
      features: sub.features || [],
      usageReceipts: sub.usage_receipts,
      usageReports: sub.usage_reports,
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return null;
  }
}

// Get subscription limits based on tier
export function getSubscriptionLimits(tier: string): SubscriptionLimits {
  const limits: Record<string, SubscriptionLimits> = {
    free: {
      maxReceipts: 10,
      maxReports: 1,
      hasEmailIngestion: false,
      hasTeamCollaboration: false,
      hasAnalytics: false,
      hasCustomBranding: false,
      hasCSVExport: false,
      hasPriorityProcessing: false,
    },
    pro: {
      maxReceipts: -1, // Unlimited
      maxReports: -1, // Unlimited
      hasEmailIngestion: false,
      hasTeamCollaboration: false,
      hasAnalytics: false,
      hasCustomBranding: true,
      hasCSVExport: true,
      hasPriorityProcessing: true,
    },
    premium: {
      maxReceipts: -1, // Unlimited
      maxReports: -1, // Unlimited
      hasEmailIngestion: true,
      hasTeamCollaboration: true,
      hasAnalytics: true,
      hasCustomBranding: true,
      hasCSVExport: true,
      hasPriorityProcessing: true,
    },
  };
  
  return limits[tier] || limits.free;
}

// Check if user can perform an action
export async function checkSubscriptionLimit(
  userId: number, 
  feature: 'receipt_uploads' | 'report_exports' | 'email_ingestion' | 'team_collaboration' | 'analytics' | 'custom_branding' | 'csv_export' | 'priority_processing'
): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: string }> {
  try {
    const subscription = await getUserSubscriptionInfo(userId);
    if (!subscription) {
      return { allowed: false, reason: 'User not found' };
    }

    // Check if trial has expired
    if (subscription.status === 'trial' && subscription.trialEnd && subscription.trialEnd < new Date()) {
      // Auto-downgrade expired trial
      await sql`
        UPDATE auth_users 
        SET subscription_status = 'canceled', subscription_tier = 'free'
        WHERE id = ${userId}
      `;
      subscription.status = 'canceled';
      subscription.tier = 'free';
    }

    const limits = getSubscriptionLimits(subscription.tier);

    // Check feature-specific limits
    switch (feature) {
      case 'receipt_uploads':
        if (limits.maxReceipts === -1) return { allowed: true };
        if (subscription.usageReceipts >= limits.maxReceipts) {
          return { 
            allowed: false, 
            reason: `Upload limit reached (${limits.maxReceipts}). Upgrade to Pro for unlimited uploads.`,
            upgradeRequired: 'pro'
          };
        }
        return { allowed: true };

      case 'report_exports':
        if (limits.maxReports === -1) return { allowed: true };
        if (subscription.usageReports >= limits.maxReports) {
          return { 
            allowed: false, 
            reason: `Report limit reached (${limits.maxReports}). Upgrade to Pro for unlimited reports.`,
            upgradeRequired: 'pro'
          };
        }
        return { allowed: true };

      case 'email_ingestion':
        if (!limits.hasEmailIngestion) {
          return { 
            allowed: false, 
            reason: 'Email receipt ingestion requires Premium subscription.',
            upgradeRequired: 'premium'
          };
        }
        return { allowed: true };

      case 'team_collaboration':
        if (!limits.hasTeamCollaboration) {
          return { 
            allowed: false, 
            reason: 'Team collaboration requires Premium subscription.',
            upgradeRequired: 'premium'
          };
        }
        return { allowed: true };

      case 'analytics':
        if (!limits.hasAnalytics) {
          return { 
            allowed: false, 
            reason: 'Analytics dashboard requires Premium subscription.',
            upgradeRequired: 'premium'
          };
        }
        return { allowed: true };

      case 'custom_branding':
        if (!limits.hasCustomBranding) {
          return { 
            allowed: false, 
            reason: 'Custom branding requires Pro subscription.',
            upgradeRequired: 'pro'
          };
        }
        return { allowed: true };

      case 'csv_export':
        if (!limits.hasCSVExport) {
          return { 
            allowed: false, 
            reason: 'CSV export requires Pro subscription.',
            upgradeRequired: 'pro'
          };
        }
        return { allowed: true };

      case 'priority_processing':
        if (!limits.hasPriorityProcessing) {
          return { 
            allowed: false, 
            reason: 'Priority processing requires Pro subscription.',
            upgradeRequired: 'pro'
          };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Unknown feature' };
    }
  } catch (error) {
    console.error('Error checking subscription limit:', error);
    return { allowed: false, reason: 'Internal error' };
  }
}

// Increment usage counter
export async function incrementUsage(userId: number, feature: 'receipt_uploads' | 'report_exports'): Promise<void> {
  try {
    await sql`
      SELECT increment_subscription_usage(${userId}, ${feature})
    `;
  } catch (error) {
    console.error('Error incrementing usage:', error);
  }
}

// Middleware function for API routes
export function withSubscriptionCheck(
  feature: 'receipt_uploads' | 'report_exports' | 'email_ingestion' | 'team_collaboration' | 'analytics' | 'custom_branding' | 'csv_export' | 'priority_processing'
) {
  return function(handler: (request: Request, auth: { userId: number, email: string, name?: string }, subscription: SubscriptionInfo) => Promise<Response>) {
    return async (request: Request) => {
      try {
        // Get authenticated user
        const user = await getAuthUser(request);
        if (!user) {
          return unauthorized();
        }

        // Check subscription limits
        const limitCheck = await checkSubscriptionLimit(user.id, feature);
        if (!limitCheck.allowed) {
          return paymentRequired(limitCheck.reason || 'Subscription limit reached', {
            upgradeRequired: limitCheck.upgradeRequired,
            currentTier: 'free', // This would be fetched from subscription info
          });
        }

        // Get full subscription info
        const subscription = await getUserSubscriptionInfo(user.id);
        if (!subscription) {
          return internalServerError('Failed to get subscription information');
        }

        // Call the original handler
        return handler(request, { userId: user.id, email: user.email ?? '', name: user.name ?? undefined }, subscription);
      } catch (error) {
        console.error('Subscription check error:', error);
        return internalServerError('Subscription check failed');
      }
    };
  };
}

// Helper to get pricing information
export async function getPricingInfo() {
  try {
    const tiers = await sql`
      SELECT 
        tier_name,
        display_name,
        monthly_price_cents,
        yearly_price_cents,
        trial_days,
        features,
        stripe_price_id_monthly,
        stripe_price_id_yearly
      FROM subscription_tiers
      ORDER BY monthly_price_cents ASC
    `;
    
    return tiers.map(tier => ({
      id: tier.tier_name,
      name: tier.display_name,
      monthlyPrice: tier.monthly_price_cents / 100,
      yearlyPrice: tier.yearly_price_cents / 100,
      trialDays: tier.trial_days,
      features: tier.features || [],
      stripePriceIdMonthly: tier.stripe_price_id_monthly,
      stripePriceIdYearly: tier.stripe_price_id_yearly,
    }));
  } catch (error) {
    console.error('Error getting pricing info:', error);
    return [];
  }
}
