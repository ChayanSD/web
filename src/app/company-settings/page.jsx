import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Building2,
  Plus,
  Save,
  Trash2,
  Edit3,
  Check,
  Star,
  StarOff,
} from "lucide-react";

export default function CompanySettingsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    setting_name: "",
    company_name: "",
    approver_name: "",
    approver_email: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "United States",
    department: "",
    cost_center: "",
    notes: "",
    is_default: false,
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load company settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const resetForm = () => {
    setFormData({
      setting_name: "",
      company_name: "",
      approver_name: "",
      approver_email: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zip_code: "",
      country: "United States",
      department: "",
      cost_center: "",
      notes: "",
      is_default: false,
    });
    setEditingId(null);
  };

  const handleEdit = (setting) => {
    setFormData({
      setting_name: setting.setting_name || "",
      company_name: setting.company_name || "",
      approver_name: setting.approver_name || "",
      approver_email: setting.approver_email || "",
      address_line_1: setting.address_line_1 || "",
      address_line_2: setting.address_line_2 || "",
      city: setting.city || "",
      state: setting.state || "",
      zip_code: setting.zip_code || "",
      country: setting.country || "United States",
      department: setting.department || "",
      cost_center: setting.cost_center || "",
      notes: setting.notes || "",
      is_default: setting.is_default || false,
    });
    setEditingId(setting.id);
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      // Validation
      if (
        !formData.company_name ||
        !formData.approver_name ||
        !formData.approver_email
      ) {
        alert("Company name, approver name, and approver email are required.");
        return;
      }

      // Generate setting name if creating new
      if (!editingId && !formData.setting_name) {
        const baseName = formData.company_name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        formData.setting_name = baseName;
      }

      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      const data = await response.json();
      fetchSettings();
      resetForm();
      alert(data.message);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert(err.message || "Failed to save settings");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (settingId) => {
    if (!confirm("Are you sure you want to delete this company setting?")) {
      return;
    }

    try {
      const response = await fetch(`/api/company-settings?id=${settingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete setting");
      }

      fetchSettings();
      if (editingId === settingId) {
        resetForm();
      }
      alert("Setting deleted successfully");
    } catch (err) {
      console.error("Error deleting setting:", err);
      alert(err.message || "Failed to delete setting");
    }
  };

  const handleSetDefault = async (settingId) => {
    const setting = settings.find((s) => s.id === settingId);
    if (!setting) return;

    try {
      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...setting, is_default: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to set as default");
      }

      fetchSettings();
      alert("Default setting updated successfully");
    } catch (err) {
      console.error("Error setting default:", err);
      alert("Failed to set as default");
    }
  };

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
            Please sign in to access settings
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
                  Company Settings
                </h1>
                <p className="text-sm text-gray-600">
                  Manage your company and client details for expense reports
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Back to Dashboard
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Settings List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Your Company Settings
                </h2>
                <button
                  onClick={() => {
                    resetForm();
                    setFormData((prev) => ({
                      ...prev,
                      setting_name: `company_${Date.now()}`,
                    }));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                >
                  <Plus size={18} />
                  Add New Company
                </button>
              </div>

              {loading ? (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="text-gray-600">Loading settings...</div>
                </div>
              ) : error ? (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="text-red-600">{error}</div>
                </div>
              ) : settings.length === 0 ? (
                <div className="bg-white rounded-3xl p-6 border border-gray-200 text-center">
                  <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">
                    No company settings found
                  </p>
                  <p className="text-sm text-gray-400">
                    Create your first company setting to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.map((setting) => (
                    <div
                      key={setting.id}
                      className={`bg-white rounded-3xl p-6 border transition-all ${
                        editingId === setting.id
                          ? "border-[#2E86DE] ring-2 ring-[#2E86DE] ring-opacity-20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                              setting.is_default
                                ? "bg-yellow-100"
                                : "bg-gray-100"
                            }`}
                          >
                            {setting.is_default ? (
                              <Star
                                size={20}
                                className="text-yellow-600 fill-current"
                              />
                            ) : (
                              <Building2 size={20} className="text-gray-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                              {setting.company_name}
                              {setting.is_default && (
                                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-lg font-medium">
                                  Default
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {setting.approver_name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!setting.is_default && (
                            <button
                              onClick={() => handleSetDefault(setting.id)}
                              className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-xl transition-colors"
                              title="Set as default"
                            >
                              <StarOff size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(setting)}
                            className="p-2 text-gray-400 hover:text-[#2E86DE] hover:bg-blue-50 rounded-xl transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(setting.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Approver Email</div>
                          <div className="font-medium">
                            {setting.approver_email}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Department</div>
                          <div className="font-medium">
                            {setting.department || "N/A"}
                          </div>
                        </div>
                        {(setting.city || setting.state) && (
                          <div className="col-span-2">
                            <div className="text-gray-500">Address</div>
                            <div className="font-medium">
                              {[
                                setting.address_line_1,
                                setting.city,
                                setting.state,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Form */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200 h-fit sticky top-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {editingId ? "Edit Company Setting" : "Add New Company Setting"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        company_name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approver Name *
                    </label>
                    <input
                      type="text"
                      value={formData.approver_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          approver_name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="e.g. John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approver Email *
                    </label>
                    <input
                      type="email"
                      value={formData.approver_email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          approver_email: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="john@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.address_line_1}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        address_line_1: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    placeholder="123 Business Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.address_line_2}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        address_line_2: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    placeholder="Suite 100"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="San Francisco"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="CA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          zip_code: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="94105"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          department: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="Engineering"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Center
                    </label>
                    <input
                      type="text"
                      value={formData.cost_center}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cost_center: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      placeholder="CC-1001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                    placeholder="Additional notes or instructions..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_default: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-[#2E86DE] border-gray-300 rounded focus:ring-[#2E86DE]"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Set as default company setting
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] disabled:opacity-50 text-white font-medium rounded-2xl transition-colors"
                  >
                    <Save size={18} />
                    {saveLoading
                      ? "Saving..."
                      : editingId
                        ? "Update Setting"
                        : "Save Setting"}
                  </button>

                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
