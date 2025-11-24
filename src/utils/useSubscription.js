import { useCallback, useEffect } from "react";
import { create } from "zustand";

const useSubscriptionStore = create((set, get) => ({
  status: null,
  subscription_tier: "free",
  loading: true,
  error: null,
  setStatus: (status) => set({ status }),
  setTier: (tier) => set({ subscription_tier: tier }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  checkSubscription: async () => {
    const currentState = get();
    if (currentState.loading === false && currentState.status !== null) {
      return; // Don't re-fetch if we already have data
    }

    try {
      set({ error: null });
      const response = await fetch("/api/get-subscription-status", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to check subscription status");
      }

      const data = await response.json();
      const isActive = data.status === "active";

      set({
        status: isActive,
        subscription_tier: data.subscription_tier || "free",
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      set({
        loading: false,
        error: error.message,
        status: false,
        subscription_tier: "free",
      });
    }
  },
  refetchSubscription: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/get-subscription-status", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to check subscription status");
      }

      const data = await response.json();
      const isActive = data.status === "active";

      set({
        status: isActive,
        subscription_tier: data.subscription_tier || "free",
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error refetching subscription:", error);
      set({
        loading: false,
        error: error.message,
        status: false,
        subscription_tier: "free",
      });
    }
  },
}));

export function useSubscription() {
  const {
    status,
    subscription_tier,
    loading,
    error,
    checkSubscription,
    refetchSubscription,
  } = useSubscriptionStore();

  const initiateSubscription = useCallback(
    async (product = "pro") => {
      try {
        const response = await fetch("/api/stripe-checkout-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product,
            billing_cycle: "monthly",
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));

          if (response.status === 401) {
            throw new Error("Please sign in to upgrade your plan");
          } else if (response.status === 403) {
            throw new Error(
              errorData.error ||
                "Please verify your email before selecting a plan",
            );
          } else {
            throw new Error(errorData.error || "Failed to get checkout link");
          }
        }

        const { url } = await response.json();
        if (url) {
          // Open Stripe checkout in a popup window
          const popup = window.open(
            url,
            "_blank",
            "popup,width=800,height=600",
          );

          // Monitor popup for completion
          const checkClosed = setInterval(() => {
            try {
              if (
                popup.closed ||
                popup.location.href.includes(window.location.origin)
              ) {
                clearInterval(checkClosed);
                popup.close();
                // Refetch subscription status after checkout
                refetchSubscription();
              }
            } catch (e) {
              // Cross-origin error when popup navigates to Stripe
              // This is expected and normal
            }
          }, 1000);

          // Also listen for successful payment via URL params
          const checkForSuccess = setInterval(() => {
            try {
              if (popup.location.href.includes("upgrade=success")) {
                clearInterval(checkForSuccess);
                clearInterval(checkClosed);
                popup.close();
                refetchSubscription();
              }
            } catch (e) {
              // Cross-origin error - expected
            }
          }, 1000);
        } else {
          throw new Error("No checkout URL received");
        }
      } catch (error) {
        console.error("Error:", error);
        throw error; // Re-throw to maintain the original error message
      }
    },
    [refetchSubscription],
  );

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Check for successful payment on page load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("upgrade") === "success") {
        // Clear the URL params and refetch subscription
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        refetchSubscription();
      }
    }
  }, [refetchSubscription]);

  return {
    isSubscribed: status,
    subscriptionTier: subscription_tier,
    data: status,
    loading,
    error,
    initiateSubscription,
    refetchSubscription,
  };
}

export default useSubscription;
