import Stripe from "stripe";
import sql from "@/app/api/utils/sql.js";
import { internalServerError } from "@/lib/errors";

// Initialize Stripe with environment-based key
const getStripeInstance = () => {
  const isLive = process.env.STRIPE_MODE === 'live';
  const secretKey = isLive ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;

  if (!secretKey) {
    throw new Error(`Stripe ${isLive ? 'live' : 'test'} secret key not configured`);
  }

  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
};

// Get webhook secret based on environment
const getWebhookSecret = () => {
  const isLive = process.env.STRIPE_MODE === 'live';
  const webhookSecret = isLive ? process.env.STRIPE_WEBHOOK_SECRET_LIVE : process.env.STRIPE_WEBHOOK_SECRET_TEST;

  if (!webhookSecret) {
    throw new Error(`Stripe ${isLive ? 'live' : 'test'} webhook secret not configured`);
  }

  return webhookSecret;
};

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("Missing Stripe signature");
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    const stripe = getStripeInstance();
    const webhookSecret = getWebhookSecret();

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("Received Stripe webhook event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return internalServerError("Webhook processing failed", error.message);
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log("Processing checkout session completed:", session.id);

  const userId = parseInt(session.metadata.user_id);
  const plan = session.metadata.plan;
  const billingCycle = session.metadata.billing_cycle;
  const referralCode = session.metadata.referral_code;

  if (!userId || !plan) {
    console.error("Missing required metadata in checkout session");
    return;
  }

  try {
    // Update user subscription
    await sql`
      UPDATE auth_users 
      SET 
        subscription_tier = ${plan},
        subscription_status = 'active',
        stripe_customer_id = ${session.customer},
        subscription_ends_at = NOW() + INTERVAL '1 ${billingCycle}'
      WHERE id = ${userId}
    `;

    // Log subscription event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, new_tier, new_status, stripe_event_id, metadata)
      VALUES (${userId}, 'subscription_created', ${plan}, 'active', ${session.id}, ${JSON.stringify({
      billingCycle,
      referralCode,
      sessionId: session.id,
      customerId: session.customer,
    })})
    `;

    // Handle referral bonus if applicable
    if (referralCode) {
      await handleReferralBonus(userId, referralCode);
    }

    console.log(`User ${userId} successfully subscribed to ${plan} plan`);
  } catch (error) {
    console.error("Error processing checkout session completed:", error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log("Processing subscription created:", subscription.id);

  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  try {
    // Find user by Stripe customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (users.length === 0) {
      console.error("User not found for customer ID:", customerId);
      return;
    }

    const userId = users[0].id;

    // Determine tier from subscription items
    const tier = determineTierFromSubscription(subscription);

    // Update user subscription
    await sql`
      UPDATE auth_users 
      SET 
        subscription_tier = ${tier},
        subscription_status = ${status},
        stripe_subscription_id = ${subscriptionId},
        subscription_ends_at = ${currentPeriodEnd.toISOString()}
      WHERE id = ${userId}
    `;

    // Log subscription event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, new_tier, new_status, stripe_event_id, metadata)
      VALUES (${userId}, 'subscription_created', ${tier}, ${status}, ${subscription.id}, ${JSON.stringify({
      subscriptionId,
      customerId,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    })})
    `;

    console.log(`User ${userId} subscription created: ${tier} - ${status}`);
  } catch (error) {
    console.error("Error processing subscription created:", error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log("Processing subscription updated:", subscription.id);

  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  try {
    // Find user by subscription ID
    const users = await sql`
      SELECT id, subscription_tier FROM auth_users 
      WHERE stripe_subscription_id = ${subscriptionId}
    `;

    if (users.length === 0) {
      console.error("User not found for subscription ID:", subscriptionId);
      return;
    }

    const userId = users[0].id;
    const oldTier = users[0].subscription_tier;
    const tier = determineTierFromSubscription(subscription);

    // Update user subscription
    await sql`
      UPDATE auth_users 
      SET 
        subscription_tier = ${tier},
        subscription_status = ${status},
        subscription_ends_at = ${currentPeriodEnd.toISOString()}
      WHERE id = ${userId}
    `;

    // Log subscription event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, old_tier, new_tier, old_status, new_status, stripe_event_id, metadata)
      VALUES (${userId}, 'subscription_updated', ${oldTier}, ${tier}, 'active', ${status}, ${subscription.id}, ${JSON.stringify({
      subscriptionId,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    })})
    `;

    console.log(`User ${userId} subscription updated: ${oldTier} -> ${tier} - ${status}`);
  } catch (error) {
    console.error("Error processing subscription updated:", error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log("Processing subscription deleted:", subscription.id);

  const subscriptionId = subscription.id;

  try {
    // Find user by subscription ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_subscription_id = ${subscriptionId}
    `;

    if (users.length === 0) {
      console.error("User not found for subscription ID:", subscriptionId);
      return;
    }

    const userId = users[0].id;

    // Downgrade user to free tier
    await sql`
      UPDATE auth_users 
      SET 
        subscription_tier = 'free',
        subscription_status = 'canceled',
        subscription_ends_at = NULL,
        stripe_subscription_id = NULL
      WHERE id = ${userId}
    `;

    // Log subscription event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, new_tier, new_status, stripe_event_id, metadata)
      VALUES (${userId}, 'subscription_canceled', 'free', 'canceled', ${subscription.id}, ${JSON.stringify({
      subscriptionId,
      canceledAt: new Date().toISOString(),
    })})
    `;

    console.log(`User ${userId} subscription canceled and downgraded to free`);
  } catch (error) {
    console.error("Error processing subscription deleted:", error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log("Processing invoice payment succeeded:", invoice.id);

  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  try {
    // Find user by customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (users.length === 0) {
      console.error("User not found for customer ID:", customerId);
      return;
    }

    const userId = users[0].id;

    // Update subscription status to active
    await sql`
      UPDATE auth_users 
      SET subscription_status = 'active'
      WHERE id = ${userId}
    `;

    // Log payment event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, stripe_event_id, metadata)
      VALUES (${userId}, 'payment_succeeded', ${invoice.id}, ${JSON.stringify({
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      subscriptionId,
    })})
    `;

    console.log(`User ${userId} payment succeeded for invoice ${invoice.id}`);
  } catch (error) {
    console.error("Error processing invoice payment succeeded:", error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice) {
  console.log("Processing invoice payment failed:", invoice.id);

  const customerId = invoice.customer;

  try {
    // Find user by customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (users.length === 0) {
      console.error("User not found for customer ID:", customerId);
      return;
    }

    const userId = users[0].id;

    // Update subscription status to past_due
    await sql`
      UPDATE auth_users 
      SET subscription_status = 'past_due'
      WHERE id = ${userId}
    `;

    // Log payment event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, stripe_event_id, metadata)
      VALUES (${userId}, 'payment_failed', ${invoice.id}, ${JSON.stringify({
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      nextPaymentAttempt: invoice.next_payment_attempt,
    })})
    `;

    console.log(`User ${userId} payment failed for invoice ${invoice.id}`);
  } catch (error) {
    console.error("Error processing invoice payment failed:", error);
    throw error;
  }
}

async function handleTrialWillEnd(subscription) {
  console.log("Processing trial will end:", subscription.id);

  const customerId = subscription.customer;
  const trialEnd = new Date(subscription.trial_end * 1000);

  try {
    // Find user by customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (users.length === 0) {
      console.error("User not found for customer ID:", customerId);
      return;
    }

    const userId = users[0].id;

    // Log trial ending event
    await sql`
      INSERT INTO subscription_events (user_id, event_type, stripe_event_id, metadata)
      VALUES (${userId}, 'trial_ending', ${subscription.id}, ${JSON.stringify({
      trialEnd: trialEnd.toISOString(),
      subscriptionId: subscription.id,
    })})
    `;

    console.log(`User ${userId} trial ending on ${trialEnd.toISOString()}`);
  } catch (error) {
    console.error("Error processing trial will end:", error);
    throw error;
  }
}

function determineTierFromSubscription(subscription) {
  // Determine tier based on subscription items
  const items = subscription.items.data;

  for (const item of items) {
    const priceId = item.price.id;

    // Check against configured price IDs
    if (priceId === process.env.PRICE_PRO_MONTHLY || priceId === process.env.PRICE_PRO_YEARLY) {
      return 'pro';
    }
    if (priceId === process.env.PRICE_PREMIUM_MONTHLY || priceId === process.env.PRICE_PREMIUM_YEARLY) {
      return 'premium';
    }
  }

  // Fallback to pro if we can't determine
  return 'pro';
}

async function handleReferralBonus(userId, referralCode) {
  try {
    // Find referrer by referral code
    const referrers = await sql`
      SELECT id FROM auth_users 
      WHERE referral_code = ${referralCode}
    `;

    if (referrers.length === 0) {
      console.log("Referrer not found for code:", referralCode);
      return;
    }

    const referrerId = referrers[0].id;

    // Check if this referral is already processed
    const existingReferral = await sql`
      SELECT id FROM referral_tracking 
      WHERE referred_id = ${userId}
    `;

    if (existingReferral.length > 0) {
      console.log("Referral already processed for user:", userId);
      return;
    }

    // Create referral tracking record
    await sql`
      INSERT INTO referral_tracking (referrer_id, referred_id, referral_code, status, reward_type, reward_value)
      VALUES (${referrerId}, ${userId}, ${referralCode}, 'completed', 'free_month', 9.99)
    `;

    // Check if referrer qualifies for free month (3 referrals)
    const referralCount = await sql`
      SELECT COUNT(*) as count FROM referral_tracking 
      WHERE referrer_id = ${referrerId} AND status = 'completed'
    `;

    if (referralCount[0].count >= 3) {
      // Grant free month to referrer
      await sql`
        UPDATE auth_users 
        SET subscription_ends_at = subscription_ends_at + INTERVAL '1 month'
        WHERE id = ${referrerId}
      `;

      console.log(`Referrer ${referrerId} earned free month for 3 referrals`);
    }

    console.log(`Referral bonus processed: ${referrerId} -> ${userId}`);
  } catch (error) {
    console.error("Error processing referral bonus:", error);
  }
}