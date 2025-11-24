import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import useSubscription from "@/utils/useSubscription";
import {
  Receipt,
  Upload,
  FileText,
  Filter,
  Download,
  Trash2,
  Eye,
  Plus,
  Crown,
} from "lucide-react";

export default function DashboardPage() {
  const { data: user, loading: userLoading } = useUser();
  const {
    subscriptionTier,
    isSubscribed,
    loading: subscriptionLoading,
  } = useSubscription();
  const [receipts, setReceipts] = useState([]);
  const [allReceipts, setAllReceipts] = useState([]); // Store all receipts for filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    dateRange: "all", // "all", "current_month", "last_30", "last_90", "custom"
    customStartDate: "",
    customEndDate: "",
    category: "all",
    merchant: "", // New merchant search filter
  });
  const [generateReportLoading, setGenerateReportLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState([]);
  const [selectedCompanySetting, setSelectedCompanySetting] = useState(null);

  // Helper function to get user's display name
  const getUserDisplayName = (user) => {
    if (!user) return "";

    // Try to construct full name from first_name and last_name
    const firstName = user.first_name?.trim();
    const lastName = user.last_name?.trim();

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      // Fallback to email if no first/last name available
      return user.email;
    }
  };

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      // Fetch all receipts without server-side filtering
      const response = await fetch(`/api/receipts`);
      if (!response.ok) {
        throw new Error("Failed to fetch receipts");
      }
      const data = await response.json();
      const allReceiptsData = data.receipts || [];
      setAllReceipts(allReceiptsData);

      // Apply client-side filtering
      const filteredReceipts = applyFilters(allReceiptsData);
      setReceipts(filteredReceipts);
    } catch (err) {
      console.error("Error fetching receipts:", err);
      setError("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch("/api/company-settings");
      if (response.ok) {
        const data = await response.json();
        setCompanySettings(data.settings || []);
        // Set default company setting
        const defaultSetting = data.settings.find((s) => s.is_default);
        if (defaultSetting) {
          setSelectedCompanySetting(defaultSetting.id);
        } else if (data.settings.length > 0) {
          setSelectedCompanySetting(data.settings[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  // Client-side filtering function
  const applyFilters = (receiptsData) => {
    let filtered = [...receiptsData];

    // Date filtering
    if (filters.dateRange !== "all") {
      const now = new Date();
      let startDate, endDate;

      switch (filters.dateRange) {
        case "current_month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "last_30":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          endDate = now;
          break;
        case "last_90":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 90);
          endDate = now;
          break;
        case "custom":
          if (filters.customStartDate)
            startDate = new Date(filters.customStartDate);
          if (filters.customEndDate) endDate = new Date(filters.customEndDate);
          break;
      }

      if (startDate && endDate) {
        filtered = filtered.filter((receipt) => {
          if (!receipt.receipt_date) return false;
          const receiptDate = new Date(receipt.receipt_date);
          return receiptDate >= startDate && receiptDate <= endDate;
        });
      }
    }

    // Category filtering
    if (filters.category !== "all") {
      filtered = filtered.filter(
        (receipt) => (receipt.category || "Other") === filters.category,
      );
    }

    // Merchant filtering
    if (filters.merchant.trim()) {
      const merchantSearch = filters.merchant.toLowerCase().trim();
      filtered = filtered.filter((receipt) =>
        (receipt.merchant_name || "").toLowerCase().includes(merchantSearch),
      );
    }

    return filtered;
  };

  // Update receipts when filters change
  useEffect(() => {
    if (allReceipts.length > 0) {
      const filteredReceipts = applyFilters(allReceipts);
      setReceipts(filteredReceipts);
    }
  }, [filters, allReceipts]);

  useEffect(() => {
    if (user) {
      fetchReceipts();
      fetchCompanySettings();
    }
  }, [user]);

  const handleDeleteReceipt = async (receiptId) => {
    if (!confirm("Are you sure you want to delete this receipt?")) return;

    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete receipt");
      }

      // Refresh receipts list
      fetchReceipts();
    } catch (err) {
      console.error("Error deleting receipt:", err);
      alert("Failed to delete receipt");
    }
  };

  const handleGenerateReport = async (format) => {
    try {
      setGenerateReportLoading(true);

      // Use current filtered receipts for report
      const reportData = {
        receipt_ids: receipts.map((r) => r.id),
        date_range: filters.dateRange,
        category: filters.category,
        format,
        company_setting_id: selectedCompanySetting, // Include selected company setting
      };

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();

      // Download the report
      const link = document.createElement("a");
      link.href = data.download_url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate report");
    } finally {
      setGenerateReportLoading(false);
    }
  };

  // Reset filters function
  const resetFilters = () => {
    setFilters({
      dateRange: "all",
      customStartDate: "",
      customEndDate: "",
      category: "all",
      merchant: "",
    });
  };

  const monthlyTotal = receipts.reduce(
    (sum, receipt) => sum + (parseFloat(receipt.amount) || 0),
    0,
  );

  const categoryTotals = receipts.reduce((acc, receipt) => {
    const category = receipt.category || "Other";
    acc[category] = (acc[category] || 0) + (parseFloat(receipt.amount) || 0);
    return acc;
  }, {});

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to access your dashboard
          </p>
          <a
            href="/account/signin"
            className="text-[#2E86DE] hover:text-[#2574C7]"
          >
            Sign In
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
                  Welcome back, {getUserDisplayName(user)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <a
                href="/company-settings"
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Company Settings
              </a>
              {user?.is_admin && (
                <a
                  href="/admin"
                  className="text-gray-600 hover:text-gray-800 font-medium"
                >
                  Admin
                </a>
              )}
              <a
                href="/upload"
                className="flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
              >
                <Plus size={18} />
                Upload Receipt
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-3xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Filtered Total
                </h3>
                <div className="w-10 h-10 bg-[#10B981] bg-opacity-10 rounded-2xl flex items-center justify-center">
                  <FileText size={20} className="text-[#10B981]" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#10B981]">
                ${monthlyTotal.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {receipts.length} of {allReceipts.length} receipts
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Top Category
                </h3>
                <div className="w-10 h-10 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center">
                  <Filter size={20} className="text-[#2E86DE]" />
                </div>
              </div>
              {Object.keys(categoryTotals).length > 0 ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.entries(categoryTotals).sort(
                      ([, a], [, b]) => b - a,
                    )[0]?.[0] || "None"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    $
                    {Object.entries(categoryTotals)
                      .sort(([, a], [, b]) => b - a)[0]?.[1]
                      ?.toFixed(2) || "0.00"}
                  </p>
                </>
              ) : (
                <p className="text-xl text-gray-500">No data</p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  All Time Total
                </h3>
                <div className="w-10 h-10 bg-[#8B5CF6] bg-opacity-10 rounded-2xl flex items-center justify-center">
                  <Receipt size={20} className="text-[#8B5CF6]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#8B5CF6]">
                $
                {allReceipts
                  .reduce(
                    (sum, receipt) => sum + (parseFloat(receipt.amount) || 0),
                    0,
                  )
                  .toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {allReceipts.length} total receipts
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Subscription
                </h3>
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    subscriptionTier === "pro" || subscriptionTier === "premium"
                      ? "bg-yellow-100"
                      : "bg-gray-100"
                  }`}
                >
                  {subscriptionTier === "pro" ||
                  subscriptionTier === "premium" ? (
                    <Crown size={20} className="text-yellow-600" />
                  ) : (
                    <Receipt size={20} className="text-gray-600" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-2xl font-bold text-gray-900 capitalize">
                  {subscriptionLoading
                    ? "Loading..."
                    : subscriptionTier || "Free"}
                </p>
                {(subscriptionTier === "pro" ||
                  subscriptionTier === "premium") && (
                  <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-lg">
                    Active
                  </div>
                )}
              </div>
              <a
                href="/pricing"
                className="text-sm text-[#2E86DE] hover:text-[#2574C7] mt-1 inline-block"
              >
                {subscriptionTier === "free" ? "Upgrade Plan" : "Manage Plan"}
              </a>
            </div>
          </div>

          {/* Enhanced Filters and Actions */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 mb-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
              {/* Company Selection for Reports */}
              {companySettings.length > 0 && (
                <div className="w-full lg:w-auto mb-4 lg:mb-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report For
                  </label>
                  <select
                    value={selectedCompanySetting || ""}
                    onChange={(e) => setSelectedCompanySetting(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent min-w-[200px]"
                  >
                    {companySettings.map((setting) => (
                      <option key={setting.id} value={setting.id}>
                        {setting.company_name}
                        {setting.is_default && " (Default)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Range
                    </label>
                    <select
                      value={filters.dateRange}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    >
                      <option value="all">All Time</option>
                      <option value="last_30">Last 30 Days</option>
                      <option value="last_90">Last 90 Days</option>
                      <option value="current_month">Current Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={filters.category}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    >
                      <option value="all">All Categories</option>
                      <option value="Meals">Meals</option>
                      <option value="Travel">Travel</option>
                      <option value="Supplies">Supplies</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Merchant
                    </label>
                    <input
                      type="text"
                      value={filters.merchant}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          merchant: e.target.value,
                        }))
                      }
                      placeholder="Search merchant..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={resetFilters}
                      className="w-full px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>

                {/* Custom Date Range */}
                {filters.dateRange === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={filters.customStartDate}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            customStartDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={filters.customEndDate}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            customEndDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateReport("csv")}
                  disabled={generateReportLoading || receipts.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white font-medium rounded-2xl transition-colors disabled:opacity-50"
                >
                  <Download size={18} />
                  CSV Report
                </button>
                <button
                  onClick={() => handleGenerateReport("pdf")}
                  disabled={generateReportLoading || receipts.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors disabled:opacity-50"
                >
                  <Download size={18} />
                  PDF Report
                </button>
              </div>
            </div>

            {/* Filter Status */}
            {(filters.dateRange !== "all" ||
              filters.category !== "all" ||
              filters.merchant.trim()) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Active filters:</span>
                    {filters.dateRange !== "all" && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 rounded-lg">
                        {filters.dateRange === "custom"
                          ? "Custom dates"
                          : filters.dateRange.replace("_", " ")}
                      </span>
                    )}
                    {filters.category !== "all" && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 rounded-lg">
                        {filters.category}
                      </span>
                    )}
                    {filters.merchant.trim() && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 rounded-lg">
                        "{filters.merchant}"
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-blue-600 font-medium">
                    {receipts.length} receipts found
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Receipts Table */}
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Receipts</h2>
            </div>

            {loading ? (
              <div className="p-6 text-center">
                <div className="text-gray-600">Loading receipts...</div>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <div className="text-red-600">{error}</div>
              </div>
            ) : receipts.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-gray-500 mb-4">
                  {allReceipts.length === 0
                    ? "No receipts found. Upload your first receipt to get started!"
                    : "No receipts match your current filters"}
                </div>
                {allReceipts.length === 0 ? (
                  <a
                    href="/upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                  >
                    <Upload size={18} />
                    Upload Your First Receipt
                  </a>
                ) : (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-2xl transition-colors"
                  >
                    <Filter size={18} />
                    Clear Filters
                  </button>
                )}
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {receipts.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {receipt.receipt_date || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {receipt.merchant_name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#10B981]">
                          ${parseFloat(receipt.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-lg">
                            {receipt.category || "Other"}
                          </span>
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
                              onClick={() => handleDeleteReceipt(receipt.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Delete Receipt"
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
        </main>
      </div>
    </>
  );
}
