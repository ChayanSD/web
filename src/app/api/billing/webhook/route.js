import sql from "@/app/api/utils/sql.js";
import Stripe from "stripe";

// Initialize Stripe with environment-based key
const getStripeInstance = () => {
  const isLive = process.env.STRIPE_MODE === 'live';
  const secretKey = isLive ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;

  // Fallback to old format for backward compatibility
  if (!secretKey && process.env.STRIPE_SECRET_KEY) {
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }

  if (!secretKey) {
    throw new Error(`Stripe ${isLive ? 'live' : 'test'} secret key not configured`);
  }

  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
};

// Get webhook secret based on environment
const getWebhookSecret = () => {
  const isLive = process.env.STRIPE_MODE === 'live';
  const webhookSecret = isLive ? process.env.STRIPE_WEBHOOK_SECRET_LIVE : process.env.STRIPE_WEBHOOK_SECRET_TEST;

  // Fallback to old format for backward compatibility
  if (!webhookSecret && process.env.STRIPE_WEBHOOK_SECRET) {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }

  if (!webhookSecret) {
    throw new Error(`Stripe ${isLive ? 'live' : 'test'} webhook secret not configured`);
  }

  return webhookSecret;
};

async function logAuditEvent(userId, event, meta = {}) {
  try {
    if (userId) {
      await sql`
        INSERT INTO audit_log (user_id, event, meta)
        VALUES (${userId}, ${event}, ${JSON.stringify(meta)})
      `;
    }
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

async function handleSubscriptionEvent(subscription, eventType) {
  try {
    const customerId = subscription.customer;

    // Find user by Stripe customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (!users.length) {
      console.log(`No user found for customer ${customerId}`);
      return;
    }

    const userId = users[0].id;
    const priceAmount = subscription.items.data[0]?.price?.unit_amount;

    // Determine plan tier based on price
    let planTier = "free";
    if (priceAmount === 900 || priceAmount === 9000) {
      planTier = "pro";
    } else if (priceAmount === 1500 || priceAmount === 15000) {
      planTier = "premium";
    }

    // Update user's subscription status
    await sql`
      UPDATE auth_users 
      SET subscription_tier = ${planTier},
          subscription_status = ${subscription.status}
      WHERE id = ${userId}
    `;

    // Log the event
    await logAuditEvent(userId, `subscription_${eventType.split(".")[1]}`, {
      subscription_id: subscription.id,
      status: subscription.status,
      plan: planTier,
    });

    console.log(
      `Updated user ${userId} subscription: ${subscription.status} (${planTier})`,
    );
  } catch (error) {
    console.error("Error handling subscription event:", error);
  }
}

async function handleCustomerSubscriptionDeleted(subscription) {
  try {
    const customerId = subscription.customer;

    // Find user by Stripe customer ID
    const users = await sql`
      SELECT id FROM auth_users 
      WHERE stripe_customer_id = ${customerId}
    `;

    if (!users.length) {
      console.log(`No user found for customer ${customerId}`);
      return;
    }

    const userId = users[0].id;

    // Reset user to free tier
    await sql`
      UPDATE auth_users 
      SET subscription_tier = 'free',
          subscription_status = 'canceled'
      WHERE id = ${userId}
    `;

    // Log the cancellation
    await logAuditEvent(userId, "subscription_canceled", {
      subscription_id: subscription.id,
      canceled_at: subscription.canceled_at,
    });

    console.log(`User ${userId} subscription canceled`);
  } catch (error) {
    console.error("Error handling subscription deletion:", error);
  }
}

export const POST = async (request) => {
  const sig = request.headers.get("stripe-signature");

  try {
    const stripe = getStripeInstance();
    const webhookSecret = getWebhookSecret();

    if (!webhookSecret) {
      console.log(
        "Stripe webhook secret not configured, skipping webhook verification",
      );
      return Response.json({ received: true });
    }

    const body = await request.text();

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        webhookSecret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object, event.type);
        break;

      case "customer.subscription.deleted":
        await handleCustomerSubscriptionDeleted(event.data.object);
        break;

      case "checkout.session.completed":
        const session = event.data.object;
        console.log(
          `Checkout session completed: ${session.id} for customer ${session.customer}`,
        );

        // If this has a subscription, we'll handle it via subscription events
        if (session.subscription) {
          console.log(`Session has subscription: ${session.subscription}`);
        }
        break;

      case "invoice.payment_succeeded":
        const invoice = event.data.object;
        console.log(
          `Invoice payment succeeded: ${invoice.id} for customer ${invoice.customer}`,
        );
        break;

      case "invoice.payment_failed":
        const failedInvoice = event.data.object;
        console.log(
          `Invoice payment failed: ${failedInvoice.id} for customer ${failedInvoice.customer}`,
        );

        // Could implement logic to notify user or handle failed payments
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
};
