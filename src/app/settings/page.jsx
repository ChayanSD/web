import { useState, useEffect } from "react";
import { useAuth } from "@/utils/useAuth";
import { Button } from "@/components/ui/button";
import { Check, Star, Crown, Zap } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch("/api/user/subscription");
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = "/pricing";
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'free':
        return <Zap className="w-5 h-5 text-gray-400" />;
      case 'pro':
        return <Star className="w-5 h-5 text-blue-400" />;
      case 'premium':
        return <Crown className="w-5 h-5 text-yellow-400" />;
      default:
        return <Zap className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'free':
        return 'text-gray-400';
      case 'pro':
        return 'text-blue-400';
      case 'premium':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'trial':
        return 'text-blue-400';
      case 'canceled':
        return 'text-red-400';
      case 'past_due':
        return 'text-orange-400';
      default:
        return 'text-gray-400';
    }
  };

  const handleDownloadData = async () => {
    try {
      setMessage({ type: "info", text: "Preparing your data download..." });
      
      const response = await fetch("/api/exports/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "csv",
          include_all: true
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate data export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reimburseme-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: "success", text: "Data download started successfully!" });
    } catch (error) {
      console.error("Download error:", error);
      setMessage({ type: "error", text: "Failed to download data. Please try again." });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      setMessage({ type: "error", text: "Please type 'DELETE' to confirm account deletion." });
      return;
    }

    try {
      setIsDeleting(true);
      setMessage({ type: "info", text: "Deleting account and all data..." });

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm: "DELETE"
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      setMessage({ type: "success", text: "Account deleted successfully. Redirecting..." });
      
      // Redirect to home page after successful deletion
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (error) {
      console.error("Delete error:", error);
      setMessage({ type: "error", text: error.message || "Failed to delete account. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account and data</p>
        </div>

        {/* Message Display */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" :
            message.type === "error" ? "bg-red-50 text-red-800 border border-red-200" :
            "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-8">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Subscription Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>
            {subscriptionLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading subscription...</span>
              </div>
            ) : subscription ? (
              <div className="space-y-6">
                {/* Current Plan */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getTierIcon(subscription.tier)}
                    <div>
                      <h3 className={`text-lg font-semibold capitalize ${getTierColor(subscription.tier)}`}>
                        {subscription.tier} Plan
                      </h3>
                      <p className={`text-sm ${getStatusColor(subscription.status)}`}>
                        {subscription.status === 'trial' ? 'Trial' : 
                         subscription.status === 'active' ? 'Active' :
                         subscription.status === 'canceled' ? 'Canceled' :
                         subscription.status === 'past_due' ? 'Past Due' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  {subscription.tier === 'free' && (
                    <Button onClick={handleUpgrade} className="bg-blue-600 hover:bg-blue-700">
                      Upgrade Plan
                    </Button>
                  )}
                </div>

                {/* Trial Information */}
                {subscription.status === 'trial' && subscription.trialEnd && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Free Trial Active</p>
                        <p className="text-sm text-blue-700">
                          Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Early Adopter Badge */}
                {subscription.earlyAdopter && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-900">Early Adopter</p>
                        <p className="text-sm text-yellow-700">
                          You get {subscription.lifetimeDiscount}% off forever!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700">Receipts This Month</h4>
                    <p className="text-2xl font-bold text-gray-900">{subscription.usage.receipts}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700">Reports This Month</h4>
                    <p className="text-2xl font-bold text-gray-900">{subscription.usage.reports}</p>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Current Features</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {subscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600 capitalize">
                          {feature.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <Button onClick={handleUpgrade} className="bg-blue-600 hover:bg-blue-700">
                    {subscription.tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                  </Button>
                  {subscription.status === 'active' && (
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('https://billing.stripe.com/p/login/test_customer_portal', '_blank')}
                    >
                      Manage Billing
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Failed to load subscription information</p>
                <Button onClick={fetchSubscription} className="mt-4">
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* Data Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Management</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Download Your Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all your receipts and reports in CSV format.
                </p>
                <button
                  onClick={handleDownloadData}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  📥 Download Data (CSV)
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-lg shadow border border-red-200 p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Danger Zone</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-700 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                >
                  🗑️ Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div className="mt-2 text-center">
                <h3 className="text-lg font-medium text-gray-900">Delete Account</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    This will permanently delete your account and all data. Type <strong>DELETE</strong> to confirm.
                  </p>
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="mt-6 flex justify-center space-x-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirm("");
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirm !== "DELETE"}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
