import { useState, useCallback } from "react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import { Receipt, Upload, FileText, Check, X, ArrowLeft } from "lucide-react";

export default function UploadPage() {
  const { data: user, loading: userLoading } = useUser();
  const [upload, { loading: uploadLoading }] = useUpload();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, []);

  const handleFileUpload = async (file) => {
    try {
      setError(null);
      setSuccess(false);
      setExtractedData(null);
      setEditedData(null);

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Please upload a JPEG, PNG, or PDF file");
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB");
      }

      // Upload file
      const uploadResult = await upload({ file });
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      setUploadedFile({
        url: uploadResult.url,
        name: file.name,
        type: file.type,
        size: file.size,
      });

      // Process with OCR
      await processOCR(uploadResult.url, file.name);
    } catch (err) {
      console.error("File upload error:", err);
      setError(err.message || "Failed to upload file");
    }
  };

  const processOCR = async (fileUrl, filename) => {
    try {
      setOcrLoading(true);

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: fileUrl,
          filename,
        }),
      });

      if (!response.ok) {
        throw new Error("OCR processing failed");
      }

      const data = await response.json();
      setExtractedData(data.extracted_data);
      setEditedData(data.extracted_data);
    } catch (err) {
      console.error("OCR error:", err);
      setError(
        "Failed to extract receipt data. You can enter the details manually.",
      );
      // Set default data for manual entry
      setExtractedData({
        merchant_name: "",
        amount: "",
        category: "Other",
        receipt_date: new Date().toISOString().split("T")[0],
      });
      setEditedData({
        merchant_name: "",
        amount: "",
        category: "Other",
        receipt_date: new Date().toISOString().split("T")[0],
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveReceipt = async () => {
    try {
      setSaveLoading(true);
      setError(null);

      if (!uploadedFile || !editedData) {
        throw new Error("Missing required data");
      }

      // Validate required fields
      if (!editedData.merchant_name?.trim()) {
        throw new Error("Merchant name is required");
      }

      if (!editedData.amount || parseFloat(editedData.amount) <= 0) {
        throw new Error("Valid amount is required");
      }

      if (!editedData.receipt_date) {
        throw new Error("Receipt date is required");
      }

      if (!editedData.category) {
        throw new Error("Category is required");
      }

      console.log("Attempting to save receipt with data:", {
        file_url: uploadedFile.url,
        merchant_name: editedData.merchant_name,
        receipt_date: editedData.receipt_date,
        amount: parseFloat(editedData.amount),
        category: editedData.category,
      });

      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: uploadedFile.url,
          merchant_name: editedData.merchant_name,
          receipt_date: editedData.receipt_date,
          amount: parseFloat(editedData.amount),
          category: editedData.category,
        }),
      });

      console.log("Receipt save response status:", response.status);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Receipt save failed:", errorData);
        throw new Error(
          errorData.error || `Failed to save receipt (${response.status})`,
        );
      }

      const responseData = await response.json();
      console.log("Receipt saved successfully:", responseData);

      setSuccess(true);

      // Reset form after 2 seconds
      setTimeout(() => {
        setUploadedFile(null);
        setExtractedData(null);
        setEditedData(null);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message || "Failed to save receipt");
    } finally {
      setSaveLoading(false);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setEditedData(null);
    setError(null);
    setSuccess(false);
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
            Please sign in to upload receipts
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
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft size={24} />
              </a>
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
                  Upload Receipt
                </h1>
                <p className="text-sm text-gray-600">
                  Upload and process your receipt
                </p>
              </div>
            </div>

            <a
              href="/dashboard"
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              Back to Dashboard
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-8">
          {success ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-200 text-center">
              <div className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-white" />
              </div>
              <h2
                className="text-2xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Receipt Saved Successfully!
              </h2>
              <p className="text-gray-600 mb-6">
                Your receipt has been processed and added to your dashboard.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                >
                  Upload Another Receipt
                </button>
                <a
                  href="/dashboard"
                  className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                >
                  View Dashboard
                </a>
              </div>
            </div>
          ) : !uploadedFile ? (
            /* Upload Zone */
            <div className="bg-white rounded-3xl p-8 border border-gray-200">
              <div
                className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-colors ${
                  dragActive
                    ? "border-[#2E86DE] bg-[#2E86DE] bg-opacity-5"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileSelect}
                  disabled={uploadLoading}
                />

                <div className="w-16 h-16 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} className="text-[#2E86DE]" />
                </div>

                <h3
                  className="text-xl font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  {dragActive
                    ? "Drop your receipt here"
                    : "Upload your receipt"}
                </h3>

                <p className="text-gray-600 mb-6">
                  Drag and drop your receipt or click to browse files
                  <br />
                  Supports JPEG, PNG, and PDF files up to 10MB
                </p>

                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors cursor-pointer"
                >
                  <Upload size={18} />
                  {uploadLoading ? "Uploading..." : "Choose File"}
                </label>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-red-600">
                    <X size={20} />
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Processing and Review */
            <div className="space-y-6">
              {/* File Preview */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Uploaded File
                </h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center">
                    <FileText size={20} className="text-[#2E86DE]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={resetUpload}
                    className="text-gray-500 hover:text-gray-700 p-2"
                    title="Remove file"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* OCR Processing */}
              {ocrLoading && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200 text-center">
                  <div className="w-12 h-12 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Receipt size={24} className="text-[#2E86DE]" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Processing Receipt...
                  </h3>
                  <p className="text-gray-600">
                    AI is extracting data from your receipt
                  </p>
                </div>
              )}

              {/* Extracted Data Form */}
              {extractedData && editedData && (
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Review & Edit Details
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Merchant Name
                      </label>
                      <input
                        type="text"
                        value={editedData.merchant_name || ""}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            merchant_name: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                        placeholder="Enter merchant name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editedData.amount || ""}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={editedData.receipt_date || ""}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            receipt_date: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select
                        value={editedData.category || "Other"}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                      >
                        <option value="Meals">Meals</option>
                        <option value="Travel">Travel</option>
                        <option value="Supplies">Supplies</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                      <div className="flex items-center gap-2 text-red-600">
                        <X size={20} />
                        <span className="font-medium">{error}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 flex gap-4">
                    <button
                      onClick={handleSaveReceipt}
                      disabled={
                        saveLoading ||
                        !editedData.merchant_name ||
                        !editedData.amount
                      }
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors disabled:opacity-50"
                    >
                      <Check size={18} />
                      {saveLoading ? "Saving..." : "Save Receipt"}
                    </button>

                    <button
                      onClick={resetUpload}
                      className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-2xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
