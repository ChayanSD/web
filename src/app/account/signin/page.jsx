import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { Check, Mail } from "lucide-react";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  const { signInWithCredentials } = useAuth();

  const checkIfUserNeedsVerification = async (email) => {
    try {
      const response = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return data.needsVerification || false;
    } catch (err) {
      return false;
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        // Redirect to verification page
        window.location.href = `/verify?email=${encodeURIComponent(email)}`;
      }
    } catch (err) {
      console.error("Failed to resend verification:", err);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(false);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      await signInWithCredentials({
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: true,
      });
    } catch (err) {
      if (err.message === "CredentialsSignin") {
        // Check if this might be due to unverified email
        const needsVerification = await checkIfUserNeedsVerification(email);
        if (needsVerification) {
          setNeedsVerification(true);
          setError(null);
        } else {
          setError(
            "Incorrect email or password. Please check your credentials and try again.",
          );
        }
      } else {
        const errorMessages = {
          OAuthSignin:
            "Couldn't start sign-in. Please try again or use a different method.",
          OAuthCallback: "Sign-in failed after redirecting. Please try again.",
          OAuthCreateAccount:
            "Couldn't create an account with this sign-in method. Try another option.",
          EmailCreateAccount:
            "This email can't be used to create an account. It may already exist.",
          Callback: "Something went wrong during sign-in. Please try again.",
          OAuthAccountNotLinked:
            "This account is linked to a different sign-in method. Try using that instead.",
          CredentialsSignin:
            "Incorrect email or password. Try again or reset your password.",
          AccessDenied: "You don't have permission to sign in.",
          Configuration:
            "Sign-in isn't working right now. Please try again later.",
          Verification: "Your sign-in link has expired. Request a new one.",
        };

        setError(
          errorMessages[err.message] ||
            "Something went wrong. Please try again.",
        );
      }
      setLoading(false);
    }
  };

  // Show verification needed state
  if (needsVerification) {
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
            {/* Logo and Brand */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <img
                  src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                  alt="ReimburseMe Logo"
                  className="w-16 h-16"
                />
              </div>
              <h1
                className="text-3xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
              >
                Email Verification Required
              </h1>
            </div>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FEF3C7] rounded-full mb-4">
                <Mail size={32} className="text-[#F59E0B]" />
              </div>
              <p className="text-gray-600 mb-4">
                We found your account, but you need to verify your email address
                before signing in.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Check your email for a verification link, or we can send a new
                one to:{" "}
                <span className="font-semibold text-[#2E86DE]">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() =>
                  (window.location.href = `/verify?email=${encodeURIComponent(email)}`)
                }
                className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2"
              >
                Verify Email Now
              </button>

              <button
                onClick={handleResendVerification}
                className="w-full border border-[#2E86DE] text-[#2E86DE] hover:bg-[#2E86DE] hover:text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2"
              >
                Resend Verification Email
              </button>

              <button
                onClick={() => setNeedsVerification(false)}
                className="w-full text-gray-600 hover:text-gray-800 font-medium py-2"
              >
                ← Back to Sign In
              </button>
            </div>
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
          {/* Logo and Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img
                src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                alt="ReimburseMe Logo"
                className="w-16 h-16"
              />
            </div>
            <h1
              className="text-3xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: "Poppins, system-ui, sans-serif" }}
            >
              ReimburseMe
            </h1>
            <p className="text-gray-600">Welcome back</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-semibold py-3 px-4 rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <a
                href={`/account/signup${typeof window !== "undefined" ? window.location.search : ""}`}
                className="text-[#2E86DE] hover:text-[#2574C7] font-medium"
              >
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
