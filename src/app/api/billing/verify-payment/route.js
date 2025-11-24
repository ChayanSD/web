import sql from "@/app/api/utils/sql.js";
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
  const stripe = getStripeInstance();

  try {
    const session = await auth();
    const { session_id } = await request.json();

    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!session_id) {
      return Response.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    try {
      // Retrieve the checkout session from Stripe
      const checkoutSession =
        await stripe.checkout.sessions.retrieve(session_id);

      if (!checkoutSession) {
        return Response.json({ error: "Invalid session ID" }, { status: 404 });
      }

      // Verify the session belongs to the current user
      if (checkoutSession.metadata.user_id !== userId.toString()) {
        return Response.json(
          { error: "Session does not belong to current user" },
          { status: 403 },
        );
      }

      if (checkoutSession.payment_status !== "paid") {
        return Response.json({
          status: "processing",
          message: "Payment is still being processed",
        });
      }

      // Get subscription details
      let subscriptionData = {};
      let planTier = "free";

      if (checkoutSession.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(
            checkoutSession.subscription,
          );

          if (subscription && subscription.status === "active") {
            const priceAmount = subscription.items.data[0]?.price?.unit_amount;
            const interval =
              subscription.items.data[0]?.price?.recurring?.interval;

            // Determine plan tier based on price
            if (priceAmount === 900 || priceAmount === 9000) {
              planTier = "pro";
            } else if (priceAmount === 1500 || priceAmount === 15000) {
              planTier = "premium";
            }

            subscriptionData = {
              subscription_id: subscription.id,
              status: subscription.status,
              amount: priceAmount,
              interval: interval,
              next_billing: subscription.current_period_end,
              plan_name: checkoutSession.metadata.plan || planTier,
            };

            // Update user's subscription in database
            await sql`
              UPDATE auth_users 
              SET subscription_tier = ${planTier},
                  subscription_status = ${subscription.status}
              WHERE id = ${userId}
            `;

            // Log successful activation
            await logAuditEvent(userId, "subscription_activated", {
              plan: planTier,
              subscription_id: subscription.id,
              session_id: session_id,
            });
          }
        } catch (subError) {
          console.error("Error retrieving subscription:", subError);
          // Continue even if subscription retrieval fails
        }
      }

      return Response.json({
        status: "completed",
        payment_status: checkoutSession.payment_status,
        ...subscriptionData,
      });
    } catch (stripeError) {
      console.error("Stripe API error:", stripeError);

      if (stripeError.type === "StripeInvalidRequestError") {
        return Response.json({ error: "Invalid session ID" }, { status: 404 });
      }

      return Response.json(
        { error: "Failed to verify payment with Stripe" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return Response.json(
      { error: "An error occurred while verifying payment" },
      { status: 500 },
    );
  }
};
