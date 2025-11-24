import { auth } from "@/auth";
import { unauthorized, internalServerError } from "@/lib/errors";
import { getUserSubscriptionInfo } from "@/lib/subscriptionGuard";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return unauthorized();
    }

    const userId = session.user.id;
    const subscription = await getUserSubscriptionInfo(userId);

    if (!subscription) {
      return internalServerError("Failed to get subscription information");
    }

    return Response.json({
      success: true,
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        trialEnd: subscription.trialEnd,
        subscriptionEnd: subscription.subscriptionEnd,
        earlyAdopter: subscription.earlyAdopter,
        lifetimeDiscount: subscription.lifetimeDiscount,
        features: subscription.features,
        usage: {
          receipts: subscription.usageReceipts,
          reports: subscription.usageReports,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/user/subscription error:", error);
    return internalServerError("Failed to get subscription information", error.message);
  }
}
