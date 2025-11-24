"use client";

import { useState, useEffect } from "react";
import { Check, Mail, RefreshCw } from "lucide-react";

export default function VerifyPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("pending"); // pending, verified, expired, error
  const [resendCount, setResendCount] = useState(0);

  // Extract URL parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get("email");
      const tokenParam = urlParams.get("token");

      if (emailParam) setEmail(emailParam);
      if (tokenParam) {
        setToken(tokenParam);
        handleTokenVerification(tokenParam);
      }
    }
  }, []);

  const handleTokenVerification = async (verificationToken) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setVerificationStatus("expired");
          setError(data.error || "Verification link expired");
        } else {
          setError(data.error || "Verification failed");
        }
        return;
      }

      setVerificationStatus("verified");
      setMessage("Email verified successfully! Redirecting...");

      // Redirect to plans page
      setTimeout(() => {
        window.location.href = "/plans";
      }, 2000);
    } catch (err) {
      console.error("Verification error:", err);
      setError("Failed to verify email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeVerification = async (e) => {
    e.preventDefault();

    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setVerificationStatus("expired");
        }
        setError(data.error || "Verification failed");
        return;
      }

      setVerificationStatus("verified");
      setMessage("Email verified successfully! Redirecting...");

      // Redirect to plans page
      setTimeout(() => {
        window.location.href = "/plans";
      }, 2000);
    } catch (err) {
      console.error("Code verification error:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCount >= 3) {
      setError("Maximum resend attempts reached. Please try again in an hour.");
      return;
    }

    if (!email) {
      setError("Email address not found. Please try signing up again.");
      return;
    }

    setResendLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to resend email");
        return;
      }

      setResendCount((prev) => prev + 1);
      setMessage("Verification email resent! Please check your inbox.");
    } catch (err) {
      console.error("Resend error:", err);
      setError("Failed to resend email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const openEmailApp = (provider) => {
    const urls = {
      gmail: "https://mail.google.com/mail/",
      outlook: "https://outlook.live.com/mail/",
      yahoo: "https://mail.yahoo.com/",
      apple: "mailto:",
    };

    if (urls[provider]) {
      window.open(urls[provider], "_blank");
    }
  };

  // Success state
  if (verificationStatus === "verified") {
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
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#10B981] rounded-full mb-6">
              <Check size={40} className="text-white" />
            </div>

            <h1
              className="text-3xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
            >
              Email Verified!
            </h1>

            <p className="text-gray-600 text-lg mb-6">
              Great! Your email has been verified successfully.
            </p>

            <p className="text-gray-500 text-sm">
              Redirecting you to plan selection...
            </p>

            {message && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-600">
                {message}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

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
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#2E86DE] rounded-2xl mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h1
              className="text-3xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
            >
              Check Your Email
            </h1>
            <p className="text-gray-600">
              We sent a verification link to{" "}
              <span className="font-semibold text-[#2E86DE]">
                {email || "your email"}
              </span>
            </p>
          </div>

          {/* Email App Links */}
          <div className="mb-8">
            <p className="text-sm text-gray-600 mb-4">
              Quick access to your email:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openEmailApp("gmail")}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium">Gmail</span>
              </button>
              <button
                onClick={() => openEmailApp("outlook")}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium">Outlook</span>
              </button>
            </div>
          </div>

          {/* Manual Code Entry */}
          <div className="border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600 mb-4">
              Or enter the 6-digit code from your email:
            </p>

            <form onSubmit={handleCodeVerification} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCode(value);
                  }}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className={`w-full py-3 px-4 rounded-2xl font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 ${
                  !loading && verificationCode.length === 6
                    ? "bg-[#2E86DE] hover:bg-[#2574C7]"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          </div>

          {/* Resend Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Didn't receive the email? Check your spam folder or:
            </p>

            <button
              onClick={handleResendEmail}
              disabled={resendLoading || resendCount >= 3}
              className={`flex items-center justify-center w-full py-2 px-4 rounded-2xl font-medium transition-colors ${
                !resendLoading && resendCount < 3
                  ? "text-[#2E86DE] hover:bg-blue-50 border border-[#2E86DE]"
                  : "text-gray-400 border border-gray-200 cursor-not-allowed"
              }`}
            >
              {resendLoading ? (
                <RefreshCw size={16} className="animate-spin mr-2" />
              ) : (
                <Mail size={16} className="mr-2" />
              )}
              {resendLoading
                ? "Sending..."
                : `Resend Email ${resendCount > 0 ? `(${3 - resendCount} left)` : ""}`}
            </button>
          </div>

          {/* Messages */}
          {message && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-600">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
              {error}
              {verificationStatus === "expired" && (
                <div className="mt-2">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendLoading || resendCount >= 3}
                    className="text-[#2E86DE] hover:underline font-medium"
                  >
                    Send new verification email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Back to Login */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Need help?{" "}
              <a
                href="/account/signin"
                className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
              >
                Back to sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
