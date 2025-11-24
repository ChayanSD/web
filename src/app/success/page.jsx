"use client";

import { useState, useEffect } from "react";
import { Check, ArrowRight, Loader2 } from "lucide-react";

export default function SuccessPage() {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const session_id = urlParams.get("session_id");

      if (session_id) {
        setSessionId(session_id);
        verifyPayment(session_id);
      } else {
        setStatus("error");
        setError(
          "No session ID found. Please contact support if you completed a payment.",
        );
      }
    }
  }, []);

  // Countdown timer for auto-redirect
  useEffect(() => {
    if (status === "success" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (status === "success" && countdown === 0) {
      window.location.href = "/dashboard";
    }
  }, [status, countdown]);

  const verifyPayment = async (session_id) => {
    let attempts = 0;
    const maxAttempts = 10; // Poll for 10 seconds

    const pollPaymentStatus = async () => {
      try {
        attempts++;

        const response = await fetch("/api/billing/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id }),
        });

        const data = await response.json();

        if (response.ok && data.status === "completed") {
          setSubscriptionData(data);
          setStatus("success");
          return;
        }

        if (
          response.ok &&
          data.status === "processing" &&
          attempts < maxAttempts
        ) {
          // Continue polling
          setTimeout(pollPaymentStatus, 1000);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed");
        }

        // If we get here, payment is still processing but we've hit max attempts
        setSubscriptionData(data);
        setStatus("success");
      } catch (error) {
        console.error("Payment verification error:", error);
        setError(error.message);
        setStatus("error");
      }
    };

    pollPaymentStatus();
  };

  const handleGoToDashboard = () => {
    window.location.href = "/dashboard";
  };

  if (status === "loading") {
    return (
      <>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <div
          className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#2E86DE] bg-opacity-10 rounded-full mb-6">
              <Loader2 className="w-10 h-10 text-[#2E86DE] animate-spin" />
            </div>

            <h1
              className="text-3xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
            >
              Processing Payment...
            </h1>

            <p className="text-gray-600 text-lg mb-6">
              Please wait while we confirm your subscription.
            </p>

            <div className="flex justify-center">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-[#2E86DE] rounded-full animate-bounce"></div>
                <div
                  className="w-3 h-3 bg-[#2E86DE] rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-3 h-3 bg-[#2E86DE] rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <div
          className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <svg
                className="w-10 h-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <h1
              className="text-3xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
            >
              Payment Issue
            </h1>

            <p className="text-gray-600 text-lg mb-6">{error}</p>

            <div className="space-y-3">
              <button
                onClick={handleGoToDashboard}
                className="w-full py-3 px-6 bg-[#2E86DE] text-white rounded-2xl font-semibold hover:bg-[#2574C7] transition-colors"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => (window.location.href = "/plans")}
                className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Back to Plans
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Success state
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div
        className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-8 text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#10B981] rounded-full mb-6">
            <Check className="w-12 h-12 text-white" />
          </div>

          <h1
            className="text-4xl font-bold text-gray-900 mb-4"
            style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
          >
            You're All Set!
          </h1>

          <p className="text-gray-600 text-lg mb-8">
            Welcome to ReimburseMe! Your subscription is now active and you're
            ready to start managing your expenses like a pro.
          </p>

          {/* Subscription Details */}
          {subscriptionData && (
            <div className="bg-[#F3F4F6] rounded-2xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">
                Subscription Details
              </h3>
              <div className="space-y-3 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan:</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {subscriptionData.plan_name || "Pro"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Billing:</span>
                  <span className="font-semibold text-gray-900">
                    ${subscriptionData.amount / 100} /{" "}
                    {subscriptionData.interval}
                  </span>
                </div>
                {subscriptionData.next_billing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next billing:</span>
                    <span className="font-semibold text-gray-900">
                      {new Date(
                        subscriptionData.next_billing * 1000,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">What's next?</h3>
            <ul className="text-left space-y-3 text-gray-700">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                <span>Upload your first receipt</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                <span>Set up expense categories</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                <span>Generate your first report</span>
              </li>
            </ul>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGoToDashboard}
            className="w-full py-4 px-6 bg-[#2E86DE] text-white rounded-2xl font-semibold hover:bg-[#2574C7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 mb-4 flex items-center justify-center"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>

          {/* Auto-redirect notice */}
          <p className="text-sm text-gray-500">
            Redirecting automatically in {countdown} second
            {countdown !== 1 ? "s" : ""}...
          </p>
        </div>
      </div>
    </>
  );
}
