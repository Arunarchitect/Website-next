import Link from "next/link";
import { FaCalculator, FaRulerCombined, FaArrowRight } from "react-icons/fa";

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Design Tools
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fee Calculator Card */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                  <FaCalculator size={24} />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Fee Calculator
                </h2>
              </div>
              <p className="text-gray-600 mb-6">
                Calculate design fees based on area and selected services with automatic PDF proposal generation.
              </p>
              <Link
                href="/tools/fee"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Open Calculator <FaArrowRight className="ml-2" />
              </Link>
            </div>
          </div>

          {/* Area Calculator Card */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                  <FaRulerCombined size={24} />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Area Calculator
                </h2>
              </div>
              <p className="text-gray-600 mb-6">
                Calculate approximate total area by adding spaces with options for walls and circulation.
              </p>
              <Link
                href="/tools/area"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Open Calculator <FaArrowRight className="ml-2" />
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            About These Tools
          </h2>
          <p className="text-gray-600 mb-4">
            These professional design tools help architects and clients quickly estimate project parameters.
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li>Both calculators generate printable PDF reports</li>
            <li>Mobile-friendly interfaces for on-site use</li>
            <li>Customizable inputs for accurate estimates</li>
            <li>Professional formatting for client presentations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}