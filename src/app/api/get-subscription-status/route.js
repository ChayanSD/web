import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export const POST = async (request) => {
  try {
    const session = await auth();

    if (!session?.user?.email || !session?.user?.id) {
      return Response.json(
        {
          status: "unauthenticated",
          message: "User not logged in",
        },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const email = session.user.email;

    const users = await sql`
      SELECT subscription_status, subscription_tier, stripe_customer_id, last_check_subscription_status_at
      FROM auth_users 
      WHERE id = ${userId}
    `;

    if (!users.length) {
      return Response.json(
        {
          status: "not_found",
          message: "User not found",
        },
        { status: 404 },
      );
    }

    const {
      subscription_status,
      subscription_tier,
      stripe_customer_id,
      last_check_subscription_status_at,
    } = users[0];

    // Check if Stripe is configured (support both old and new format)
    const isLive = process.env.STRIPE_MODE === 'live';
    const hasStripeConfig = (isLive ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST) ||
                            process.env.STRIPE_SECRET_KEY;

    // If we have a stripe customer ID, Stripe is configured, and status needs updating, check with Stripe
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isStatusStale =
      !last_check_subscription_status_at ||
      new Date(last_check_subscription_status_at) < oneHourAgo;

    if (
      hasStripeConfig &&
      stripe_customer_id &&
      (!subscription_status || isStatusStale)
    ) {
      try {
        // Initialize Stripe with environment-based key
        const Stripe = (await import("stripe")).default;
        const secretKey = isLive ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;
        const finalKey = secretKey || process.env.STRIPE_SECRET_KEY;
        
        if (!finalKey) {
          throw new Error("Stripe secret key not configured");
        }
        
        const stripe = new Stripe(finalKey, { apiVersion: "2024-06-20" });

        const customer = await stripe.customers.retrieve(stripe_customer_id, {
          expand: ["subscriptions"],
        });

        let newStatus = "none";
        let newTier = "free";

        if (customer?.subscriptions?.data?.length > 0) {
          const activeSubscription = customer.subscriptions.data.find(
            (sub) => sub.status === "active",
          );

          if (activeSubscription) {
            newStatus = "active";

            // Determine tier based on price
            const amount = activeSubscription.items.data[0]?.price?.unit_amount;
            if (amount === 900) {
              newTier = "pro";
            } else if (amount === 1500) {
              newTier = "premium";
            }
          } else {
            // Check for other statuses
            const latestSubscription = customer.subscriptions.data[0];
            newStatus = latestSubscription.status;
          }
        }

        // Update our database with latest status from Stripe
        await sql`
          UPDATE auth_users 
          SET subscription_status = ${newStatus}, 
              subscription_tier = ${newTier},
              last_check_subscription_status_at = NOW()
          WHERE id = ${userId}
        `;

        return Response.json({
          status: newStatus,
          subscription_tier: newTier,
          stripe_customer_id: stripe_customer_id,
          last_updated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error fetching from Stripe:", error);
        // Fall back to cached status if Stripe call fails
      }
    }

    // Return cached status (or defaults if no Stripe config)
    return Response.json({
      status: subscription_status || "none",
      subscription_tier: subscription_tier || "free",
      stripe_customer_id: stripe_customer_id,
      cached: true,
      stripe_configured: !!hasStripeConfig,
    });
  } catch (error) {
    console.error("Subscription status check error:", error);
    return Response.json(
      {
        error: "Failed to check subscription status",
        details: error.message,
      },
      { status: 500 },
    );
  }
};
