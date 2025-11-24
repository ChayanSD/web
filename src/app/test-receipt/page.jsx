import { useState } from "react";
import useUser from "@/utils/useUser";

export default function TestReceiptPage() {
  const { data: user, loading: userLoading } = useUser();
  const [testResult, setTestResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testReceiptSave = async () => {
    setLoading(true);
    setTestResult("Testing receipt save...\n");

    try {
      // Test data
      const testData = {
        file_url: "https://example.com/test-receipt.jpg",
        merchant_name: "Test Merchant",
        receipt_date: "2024-10-28",
        amount: 25.99,
        category: "Meals",
      };

      console.log("Sending test receipt data:", testData);
      setTestResult(
        (prev) =>
          prev + `Sending data: ${JSON.stringify(testData, null, 2)}\n\n`,
      );

      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      });

      console.log("Response status:", response.status);
      setTestResult((prev) => prev + `Response status: ${response.status}\n`);

      const responseData = await response.json();
      console.log("Response data:", responseData);
      setTestResult(
        (prev) =>
          prev + `Response data: ${JSON.stringify(responseData, null, 2)}\n\n`,
      );

      if (response.ok) {
        setTestResult(
          (prev) => prev + "✅ SUCCESS: Receipt saved successfully!\n",
        );
      } else {
        setTestResult(
          (prev) =>
            prev + `❌ FAILED: ${responseData.error || "Unknown error"}\n`,
        );
      }
    } catch (error) {
      console.error("Test error:", error);
      setTestResult((prev) => prev + `❌ ERROR: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  const testUserAuth = async () => {
    setLoading(true);
    setTestResult("Testing user authentication...\n");

    try {
      // Test user endpoint
      const response = await fetch("/api/auth/token", {
        method: "GET",
      });

      console.log("Auth response status:", response.status);
      setTestResult(
        (prev) => prev + `Auth response status: ${response.status}\n`,
      );

      const responseData = await response.json();
      console.log("Auth response data:", responseData);
      setTestResult(
        (prev) =>
          prev + `Auth data: ${JSON.stringify(responseData, null, 2)}\n\n`,
      );

      if (response.ok) {
        setTestResult((prev) => prev + "✅ SUCCESS: User is authenticated!\n");
      } else {
        setTestResult((prev) => prev + `❌ FAILED: Authentication issue\n`);
      }
    } catch (error) {
      console.error("Auth test error:", error);
      setTestResult((prev) => prev + `❌ ERROR: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to test receipt saving
          </p>
          <a
            href="/account/signin"
            className="text-blue-600 hover:text-blue-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Receipt Save Test
            </h1>
            <div className="space-x-4">
              <a
                href="/debug"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Debug Page
              </a>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Dashboard
              </a>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">User Info</h2>
            <p>
              <strong>ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <button
              onClick={testUserAuth}
              disabled={loading}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "Testing..." : "🔐 Test User Authentication"}
            </button>

            <button
              onClick={testReceiptSave}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Testing..." : "💾 Test Receipt Save"}
            </button>
          </div>

          {testResult && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Test Results:</h3>
              <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                {testResult}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>
                First test user authentication to make sure you're logged in
              </li>
              <li>Then test receipt saving to see if the API is working</li>
              <li>
                Check the browser console (F12) for additional error details
              </li>
              <li>
                After testing, go to the{" "}
                <a href="/debug" className="text-blue-600">
                  debug page
                </a>{" "}
                to see if receipts were saved
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
