import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import Stripe from "stripe";
import { badRequest, unauthorized, internalServerError } from "@/lib/errors";
import { getUserSubscriptionInfo } from "@/lib/subscriptionGuard";

// Initialize Stripe with environment-based key
const getStripeInstance = () => {
  const isLive = process.env.STRIPE_MODE === 'live';
  const secretKey = isLive ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;
  
  if (!secretKey) {
    throw new Error(`Stripe ${isLive ? 'live' : 'test'} secret key not configured`);
  }
  
  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
};

const getPriceData = (product, billingCycle = "monthly") => {
  const prices = {
    free: null, // Free trial doesn't require payment
    pro: {
      monthly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Pro Plan - Monthly" },
        recurring: { interval: "month" },
        unit_amount: 999, // $9.99
      },
      yearly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Pro Plan - Yearly" },
        recurring: { interval: "year" },
        unit_amount: 9999, // $99.99 (2 months free)
      },
    },
    premium: {
      monthly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Premium Plan - Monthly" },
        recurring: { interval: "month" },
        unit_amount: 1499, // $14.99
      },
      yearly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Premium Plan - Yearly" },
        recurring: { interval: "year" },
        unit_amount: 14999, // $149.99 (3 months free)
      },
    },
  };

  if (!prices[product]) {
    return null;
  }

  return prices[product][billingCycle] || prices[product].monthly;
};

async function logAuditEvent(userId, event, meta = {}) {
  try {
    await sql`
      INSERT INTO audit_log (user_id, event, meta)
      VALUES (${userId}, ${event}, ${JSON.stringify(meta)})
    `;
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export const POST = async (request) => {
  try {
    console.log("Starting checkout session creation");

    const session = await auth();
    console.log("Auth session:", session?.user ? "User found" : "No user");

    const { product = "pro", billing_cycle = "monthly", referralCode } = await request.json();
    console.log("Request data:", { product, billing_cycle, referralCode });

    if (!session?.user?.email || !session?.user?.id) {
      console.log("Authentication failed - no session or user");
      return unauthorized("Authentication required");
    }

    // Check if user's email is verified
    const users = await sql`
      SELECT email_verified_at FROM auth_users 
      WHERE id = ${session.user.id}
    `;

    console.log(
      "User verification check:",
      users.length > 0 ? "User found" : "No user found",
      users[0]?.email_verified_at ? "Verified" : "Not verified",
    );

    if (!users.length || !users[0].email_verified_at) {
      console.log("Email verification failed");
      return badRequest("Please verify your email before selecting a plan");
    }

    const email = session.user.email;
    const userId = session.user.id;

    // Get current subscription info
    const currentSubscription = await getUserSubscriptionInfo(userId);
    if (!currentSubscription) {
      return internalServerError("Failed to get subscription information");
    }

    // Check if user already has an active subscription
    if (currentSubscription.status === 'active' && currentSubscription.tier !== 'free') {
      return badRequest("You already have an active subscription");
    }

    const priceData = getPriceData(product, billing_cycle);
    if (!priceData) {
      console.log("Invalid price data for product:", product);
      return badRequest("Invalid plan selected");
    }

    console.log("Price data:", priceData);

    // Initialize Stripe
    const stripe = getStripeInstance();

    // Get current user's stripe_id
    const userRows = await sql`
      SELECT stripe_customer_id FROM auth_users 
      WHERE id = ${userId}
    `;

    let stripeCustomerId = userRows[0]?.stripe_customer_id;
    console.log("Existing Stripe customer ID:", stripeCustomerId || "None");

    if (!stripeCustomerId) {
      try {
        console.log("Creating new Stripe customer");
        // Create new customer in Stripe
        const customer = await stripe.customers.create({
          email,
          metadata: {
            user_id: userId.toString(),
          },
        });
        stripeCustomerId = customer.id;
        console.log("Created Stripe customer:", stripeCustomerId);

        // Update user with stripe_customer_id
        await sql`
          UPDATE auth_users 
          SET stripe_customer_id = ${stripeCustomerId}
          WHERE id = ${userId}
        `;
      } catch (stripeError) {
        console.error("Stripe customer creation failed:", stripeError);
        return internalServerError("Failed to set up payment processing. Please try again.");
      }
    }

    const successUrl = `${process.env.APP_URL}/dashboard?sub=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.APP_URL}/pricing?sub=cancelled`;

    console.log("Creating checkout session with URLs:", {
      successUrl,
      cancelUrl,
    });

    // Apply early adopter discount if applicable
    let discount = null;
    if (currentSubscription.earlyAdopter && currentSubscription.lifetimeDiscount > 0) {
      discount = {
        coupon: `early_adopter_${Math.round(currentSubscription.lifetimeDiscount)}`,
      };
    }

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: priceData,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: userId.toString(),
          plan: product,
          billing_cycle: billing_cycle,
          referral_code: referralCode || '',
        },
        discounts: discount ? [discount] : undefined,
        allow_promotion_codes: true,
        billing_address_collection: "required",
        tax_id_collection: {
          enabled: true,
        },
      });
    } catch (stripeError) {
      console.error("Stripe checkout session creation failed:", stripeError);
      return internalServerError("Failed to create payment session. Please try again.");
    }

    console.log("Checkout session created successfully:", checkoutSession.id);

    // Log subscription attempt
    await sql`
      INSERT INTO subscription_events (user_id, event_type, new_tier, metadata)
      VALUES (${userId}, 'checkout_started', ${product}, ${JSON.stringify({
        billing_cycle: billing_cycle,
        referralCode,
        sessionId: checkoutSession.id,
      })})
    `;

    return Response.json({ 
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    console.error("Error details:", {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    return internalServerError("Failed to create checkout session", error.message);
  }
};
