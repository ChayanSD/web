import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Users,
  Receipt,
  FileText,
  Activity,
  TrendingUp,
  Eye,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Mail,
  Crown,
  Trash2,
} from "lucide-react";

export default function AdminUserDetailPage({ params }) {
  const { data: currentUser, loading: userLoading } = useUser();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");

  useEffect(() => {
    if (currentUser && params.id) {
      fetchUserData();
    }
  }, [currentUser, params.id, selectedTimeframe]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/user-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: params.id,
          timeframe: selectedTimeframe,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch user data");
      }

      const data = await response.json();
      setUserData(data);
    } catch (err) {
      console.error("User data fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (
      !confirm(
        "Are you sure you want to delete this receipt? This action cannot be undone.",
      )
    )
      return;

    try {
      const response = await fetch("/api/admin/delete-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_id: receiptId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete receipt");
      }

      // Refresh user data
      fetchUserData();
    } catch (err) {
      console.error("Error deleting receipt:", err);
      alert("Failed to delete receipt");
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to access admin dashboard
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/admin" className="text-blue-600 hover:text-blue-700">
            Back to Admin Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div
        className="min-h-screen bg-[#F3F4F6]"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                alt="ReimburseMe Logo"
                className="w-10 h-10"
              />
              <div>
                <h1
                  className="text-xl font-bold text-gray-900"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  ReimburseMe
                </h1>
                <p className="text-sm text-gray-600">
                  Admin Dashboard - User Details
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <button
                onClick={fetchUserData}
                className="flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
              <a
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-2xl transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Admin
              </a>
              <a
                href="/account/logout"
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Sign Out
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading user data...</div>
            </div>
          ) : !userData ? (
            <div className="text-center py-12">
              <div className="text-gray-600">User not found</div>
            </div>
          ) : (
            <>
              {/* User Info Header */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200 mb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-[#2E86DE] bg-opacity-10 rounded-full flex items-center justify-center">
                      <Users className="text-[#2E86DE]" size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {userData.user.name ||
                          userData.user.email ||
                          `User ${userData.user.id}`}
                      </h2>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Mail size={16} />
                          <span className="text-sm">{userData.user.email}</span>
                        </div>
                        <span
                          className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                            userData.user.subscription_tier === "pro" ||
                            userData.user.subscription_tier === "premium"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {userData.user.subscription_tier === "pro" ||
                            (userData.user.subscription_tier === "premium" && (
                              <Crown size={14} className="mr-1" />
                            ))}
                          {userData.user.subscription_tier || "free"} plan
                        </span>
                        {userData.user.is_admin && (
                          <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {userData.user.id}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Joined{" "}
                      {userData.user.created_at
                        ? new Date(
                            userData.user.created_at,
                          ).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Receipts
                      </p>
                      <p className="text-3xl font-bold text-[#10B981]">
                        {userData.stats?.totalReceipts || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <Receipt className="text-[#10B981]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      +{userData.stats?.receiptsThisPeriod || 0} this period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Amount
                      </p>
                      <p className="text-3xl font-bold text-[#8B5CF6]">
                        {formatCurrency(userData.stats?.totalAmount)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#8B5CF6] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <DollarSign className="text-[#8B5CF6]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      {formatCurrency(userData.stats?.amountThisPeriod)} this
                      period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Reports Generated
                      </p>
                      <p className="text-3xl font-bold text-[#F59E0B]">
                        {userData.stats?.totalReports || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <FileText className="text-[#F59E0B]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      +{userData.stats?.reportsThisPeriod || 0} this period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Last Active
                      </p>
                      <p className="text-lg font-bold text-[#2E86DE]">
                        {userData.stats?.lastActivity
                          ? new Date(
                              userData.stats.lastActivity,
                            ).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <Activity className="text-[#2E86DE]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      {userData.stats?.lastActivity
                        ? formatDate(userData.stats.lastActivity)
                        : "No activity"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Recent Activity */}
                <div className="bg-white rounded-3xl border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Recent Activity
                      </h2>
                      <Activity className="text-gray-400" size={20} />
                    </div>
                  </div>
                  <div className="p-6 max-h-96 overflow-y-auto">
                    {userData.recentActivity?.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        No recent activity
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {userData.recentActivity
                          ?.slice(0, 10)
                          .map((activity, index) => (
                            <div
                              key={index}
                              className="flex items-start space-x-3"
                            >
                              <div className="w-8 h-8 bg-[#2E86DE] bg-opacity-10 rounded-full flex items-center justify-center flex-shrink-0">
                                <Activity
                                  className="text-[#2E86DE]"
                                  size={16}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {activity.event}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(activity.created_at)}
                                </p>
                                {activity.meta &&
                                  Object.keys(activity.meta).length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {JSON.stringify(activity.meta)}
                                    </p>
                                  )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-3xl border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Category Breakdown
                      </h2>
                      <TrendingUp className="text-gray-400" size={20} />
                    </div>
                  </div>
                  <div className="p-6">
                    {userData.categoryBreakdown?.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        No expense data
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {userData.categoryBreakdown?.map((category, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {category.category?.charAt(0) || "O"}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {category.category || "Other"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {category.count} receipts
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(category.total)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(
                                  (category.total /
                                    userData.stats?.totalAmount) *
                                    100 || 0
                                ).toFixed(1)}
                                %
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Receipts */}
              <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    User Receipts
                  </h2>
                </div>
                {userData.receipts?.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No receipts found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Merchant
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {userData.receipts?.map((receipt) => (
                          <tr key={receipt.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {receipt.receipt_date || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {receipt.merchant_name || "Unknown"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#10B981]">
                              {formatCurrency(receipt.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-lg">
                                {receipt.category || "Other"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(
                                receipt.created_at,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                {receipt.file_url && (
                                  <button
                                    onClick={() =>
                                      window.open(receipt.file_url, "_blank")
                                    }
                                    className="text-[#2E86DE] hover:text-[#2574C7] p-1"
                                    title="View Receipt"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleDeleteReceipt(receipt.id)
                                  }
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete Receipt (Admin)"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
