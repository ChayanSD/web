import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
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

const getPriceData = (product, billingCycle = "monthly") => {
  const prices = {
    free: null, // Free trial doesn't require payment
    pro: {
      monthly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Pro Plan - Monthly" },
        recurring: { interval: "month" },
        unit_amount: 900, // $9.00
      },
      yearly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Pro Plan - Yearly" },
        recurring: { interval: "year" },
        unit_amount: 9000, // $90.00 (2 months free)
      },
    },
    premium: {
      monthly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Premium Plan - Monthly" },
        recurring: { interval: "month" },
        unit_amount: 1500, // $15.00
      },
      yearly: {
        currency: "usd",
        product_data: { name: "ReimburseMe Premium Plan - Yearly" },
        recurring: { interval: "year" },
        unit_amount: 15000, // $150.00 (2 months free)
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

    // Initialize Stripe with environment-based key
    const stripe = getStripeInstance();

    const session = await auth();
    console.log("Auth session:", session?.user ? "User found" : "No user");

    const { plan = "pro", billing_cycle = "monthly" } = await request.json();
    console.log("Request data:", { plan, billing_cycle });

    if (!session?.user?.email || !session?.user?.id) {
      console.log("Authentication failed - no session or user");
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
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
      return Response.json(
        {
          error: "Please verify your email before selecting a plan",
        },
        { status: 403 },
      );
    }

    const email = session.user.email;
    const userId = session.user.id;

    const priceData = getPriceData(plan, billing_cycle);
    if (!priceData) {
      console.log("Invalid price data for plan:", plan);
      return Response.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    console.log("Price data:", priceData);

    // Get current user's stripe_customer_id
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
        const updateResult = await sql`
          UPDATE auth_users 
          SET stripe_customer_id = ${stripeCustomerId}
          WHERE id = ${userId}
          RETURNING stripe_customer_id
        `;
        console.log(
          "Database update result:",
          updateResult[0]?.stripe_customer_id ? "Success" : "Failed",
        );

        if (!updateResult.length || !updateResult[0].stripe_customer_id) {
          throw new Error("Failed to save Stripe customer ID to database");
        }
      } catch (stripeError) {
        console.error("Stripe customer creation failed:", stripeError);
        return Response.json(
          { error: "Failed to set up payment processing. Please try again." },
          { status: 500 },
        );
      }
    }

    const successUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.APP_URL}/plans`;

    console.log("Creating checkout session with URLs:", {
      successUrl,
      cancelUrl,
    });

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
          plan: plan,
          billing_cycle: billing_cycle,
        },
        allow_promotion_codes: true,
        billing_address_collection: "required",
      });
    } catch (stripeError) {
      console.error("Stripe checkout session creation failed:", stripeError);
      return Response.json(
        { error: "Failed to create payment session. Please try again." },
        { status: 500 },
      );
    }

    console.log("Checkout session created successfully:", checkoutSession.id);

    // Log audit event
    await logAuditEvent(userId, "checkout_created", {
      plan,
      billing_cycle,
      session_id: checkoutSession.id,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    console.error("Error details:", {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
};
