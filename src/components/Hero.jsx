import { useState, useEffect } from "react";
import { Play, Upload, FileText, BarChart3 } from "lucide-react";

const receiptData = [
  { merchant: "Starbucks", amount: "$8.45", category: "Meals", date: "Dec 15" },
  { merchant: "Uber", amount: "$23.50", category: "Travel", date: "Dec 14" },
  {
    merchant: "Office Depot",
    amount: "$45.99",
    category: "Supplies",
    date: "Dec 13",
  },
  { merchant: "Subway", amount: "$12.75", category: "Meals", date: "Dec 12" },
];

export default function Hero() {
  const [calloutsVisible, setCalloutsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCalloutsVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <section
        className="relative py-20 md:py-32 px-6 bg-gradient-to-b from-[#F3F4F6] to-white"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="max-w-[1200px] mx-auto">
          {/* Headline Block */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl md:text-[64px] leading-tight md:leading-[1.1] text-gray-900 mb-6 max-w-4xl mx-auto"
              style={{ fontFamily: "Poppins, serif", letterSpacing: "-0.05em" }}
            >
              Your receipts.{" "}
              <em className="font-medium text-[#2E86DE]">Reimbursed.</em>
              <br />
              Instantly.
            </h1>

            <p className="text-base md:text-lg text-gray-600 opacity-90 mb-8 max-w-[55ch] mx-auto">
              Upload receipts and get clean reimbursement reports automatically.
              No more manual data entry or lost receipts.
            </p>

            {/* Primary CTAs */}
            <div
              className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mb-16"
              id="how-it-works"
            >
              <button
                onClick={() => {
                  const howItWorksSection =
                    document.getElementById("how-it-works-steps");
                  if (howItWorksSection) {
                    howItWorksSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="group flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2"
              >
                <div className="flex items-center justify-center w-6 h-6 border border-gray-200 rounded-full">
                  <Play size={10} className="text-gray-600 ml-[1px]" />
                </div>
                <span className="text-gray-900 font-semibold text-[15px]">
                  How it works
                </span>
              </button>

              <a
                href="/account/signup"
                className="px-6 py-3 rounded-2xl text-white font-semibold text-[15px] bg-[#2E86DE] hover:bg-[#2574C7] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:ring-offset-2"
              >
                Start free trial
              </a>
            </div>
          </div>

          {/* Device Showcase */}
          <div className="relative max-w-[1200px] mx-auto">
            <div className="relative">
              <div
                className="relative rounded-3xl border-2 border-gray-200 overflow-hidden bg-white p-6"
                style={{
                  boxShadow: "0 18px 30px rgba(0,0,0,0.12)",
                  height: "500px",
                }}
              >
                {/* Dashboard Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    Receipt Dashboard
                  </h3>
                  <p className="text-sm text-gray-600">
                    Track all your expenses in one place
                  </p>
                </div>

                {/* Receipt Table */}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="grid grid-cols-4 gap-4 mb-4 text-sm font-medium text-gray-600 border-b border-gray-200 pb-2">
                    <div>Merchant</div>
                    <div>Amount</div>
                    <div>Category</div>
                    <div>Date</div>
                  </div>

                  {receiptData.map((receipt, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-4 gap-4 py-3 text-sm border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">
                        {receipt.merchant}
                      </div>
                      <div className="text-[#10B981] font-semibold">
                        {receipt.amount}
                      </div>
                      <div className="text-gray-600">
                        <span className="px-2 py-1 bg-white rounded-lg text-xs">
                          {receipt.category}
                        </span>
                      </div>
                      <div className="text-gray-500">{receipt.date}</div>
                    </div>
                  ))}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Total</span>
                      <span className="text-lg font-bold text-[#10B981]">
                        $90.69
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Callouts */}
              <div
                className={`absolute bottom-4 left-4 transition-all duration-300 ${
                  calloutsVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2"
                }`}
                style={{ transitionDelay: "150ms" }}
              >
                <div className="bg-[#2E86DE] text-white px-4 py-2 rounded-2xl font-semibold text-sm whitespace-nowrap">
                  Auto-categorized
                </div>
              </div>

              <div
                className={`absolute top-1/2 -right-4 transform -translate-y-1/2 transition-all duration-300 ${
                  calloutsVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2"
                }`}
                style={{ transitionDelay: "200ms" }}
              >
                <div className="bg-[#10B981] text-white px-4 py-2 rounded-2xl font-semibold text-sm whitespace-nowrap">
                  Export Ready
                </div>
              </div>
            </div>
          </div>

          {/* How It Works Steps */}
          <div
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            id="how-it-works-steps"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2E86DE] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload size={24} className="text-white" />
              </div>
              <h3
                className="text-xl font-semibold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                1. Upload
              </h3>
              <p className="text-gray-600">
                Drag and drop receipts or take photos with your phone
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#10B981] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-white" />
              </div>
              <h3
                className="text-xl font-semibold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                2. Extract
              </h3>
              <p className="text-gray-600">
                AI automatically extracts merchant, amount, date, and category
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 size={24} className="text-white" />
              </div>
              <h3
                className="text-xl font-semibold text-gray-900 mb-2"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                3. Export
              </h3>
              <p className="text-gray-600">
                Generate professional PDF and CSV reports for reimbursement
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
