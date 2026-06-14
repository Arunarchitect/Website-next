"use client";
import { useState, useEffect, useRef } from "react";
import type { RazorpayOptions } from "@/types/razorpay";

interface DonationState {
  id: string;
  amount: string;
  email: string;
}

const COUNTRY_CODES = [
  { code: "+93", country: "Afghanistan" },
  { code: "+355", country: "Albania" },
  { code: "+213", country: "Algeria" },
  { code: "+376", country: "Andorra" },
  { code: "+244", country: "Angola" },
  { code: "+1268", country: "Antigua & Barbuda" },
  { code: "+54", country: "Argentina" },
  { code: "+374", country: "Armenia" },
  { code: "+61", country: "Australia" },
  { code: "+43", country: "Austria" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+1242", country: "Bahamas" },
  { code: "+973", country: "Bahrain" },
  { code: "+880", country: "Bangladesh" },
  { code: "+1246", country: "Barbados" },
  { code: "+375", country: "Belarus" },
  { code: "+32", country: "Belgium" },
  { code: "+501", country: "Belize" },
  { code: "+229", country: "Benin" },
  { code: "+975", country: "Bhutan" },
  { code: "+591", country: "Bolivia" },
  { code: "+387", country: "Bosnia & Herzegovina" },
  { code: "+267", country: "Botswana" },
  { code: "+55", country: "Brazil" },
  { code: "+673", country: "Brunei" },
  { code: "+359", country: "Bulgaria" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+257", country: "Burundi" },
  { code: "+238", country: "Cape Verde" },
  { code: "+855", country: "Cambodia" },
  { code: "+237", country: "Cameroon" },
  { code: "+1", country: "Canada" },
  { code: "+236", country: "Central African Republic" },
  { code: "+235", country: "Chad" },
  { code: "+56", country: "Chile" },
  { code: "+86", country: "China" },
  { code: "+57", country: "Colombia" },
  { code: "+269", country: "Comoros" },
  { code: "+242", country: "Congo" },
  { code: "+506", country: "Costa Rica" },
  { code: "+385", country: "Croatia" },
  { code: "+53", country: "Cuba" },
  { code: "+357", country: "Cyprus" },
  { code: "+420", country: "Czech Republic" },
  { code: "+45", country: "Denmark" },
  { code: "+253", country: "Djibouti" },
  { code: "+1767", country: "Dominica" },
  { code: "+1809", country: "Dominican Republic" },
  { code: "+593", country: "Ecuador" },
  { code: "+20", country: "Egypt" },
  { code: "+503", country: "El Salvador" },
  { code: "+240", country: "Equatorial Guinea" },
  { code: "+291", country: "Eritrea" },
  { code: "+372", country: "Estonia" },
  { code: "+268", country: "Eswatini" },
  { code: "+251", country: "Ethiopia" },
  { code: "+679", country: "Fiji" },
  { code: "+358", country: "Finland" },
  { code: "+33", country: "France" },
  { code: "+241", country: "Gabon" },
  { code: "+220", country: "Gambia" },
  { code: "+995", country: "Georgia" },
  { code: "+49", country: "Germany" },
  { code: "+233", country: "Ghana" },
  { code: "+30", country: "Greece" },
  { code: "+1473", country: "Grenada" },
  { code: "+502", country: "Guatemala" },
  { code: "+224", country: "Guinea" },
  { code: "+245", country: "Guinea-Bissau" },
  { code: "+592", country: "Guyana" },
  { code: "+509", country: "Haiti" },
  { code: "+504", country: "Honduras" },
  { code: "+36", country: "Hungary" },
  { code: "+354", country: "Iceland" },
  { code: "+91", country: "India" },
  { code: "+62", country: "Indonesia" },
  { code: "+98", country: "Iran" },
  { code: "+964", country: "Iraq" },
  { code: "+353", country: "Ireland" },
  { code: "+972", country: "Israel" },
  { code: "+39", country: "Italy" },
  { code: "+1876", country: "Jamaica" },
  { code: "+81", country: "Japan" },
  { code: "+962", country: "Jordan" },
  { code: "+7", country: "Kazakhstan" },
  { code: "+254", country: "Kenya" },
  { code: "+686", country: "Kiribati" },
  { code: "+850", country: "North Korea" },
  { code: "+82", country: "South Korea" },
  { code: "+965", country: "Kuwait" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+856", country: "Laos" },
  { code: "+371", country: "Latvia" },
  { code: "+961", country: "Lebanon" },
  { code: "+266", country: "Lesotho" },
  { code: "+231", country: "Liberia" },
  { code: "+218", country: "Libya" },
  { code: "+423", country: "Liechtenstein" },
  { code: "+370", country: "Lithuania" },
  { code: "+352", country: "Luxembourg" },
  { code: "+261", country: "Madagascar" },
  { code: "+265", country: "Malawi" },
  { code: "+60", country: "Malaysia" },
  { code: "+960", country: "Maldives" },
  { code: "+223", country: "Mali" },
  { code: "+356", country: "Malta" },
  { code: "+692", country: "Marshall Islands" },
  { code: "+222", country: "Mauritania" },
  { code: "+230", country: "Mauritius" },
  { code: "+52", country: "Mexico" },
  { code: "+691", country: "Micronesia" },
  { code: "+373", country: "Moldova" },
  { code: "+377", country: "Monaco" },
  { code: "+976", country: "Mongolia" },
  { code: "+382", country: "Montenegro" },
  { code: "+212", country: "Morocco" },
  { code: "+258", country: "Mozambique" },
  { code: "+95", country: "Myanmar" },
  { code: "+264", country: "Namibia" },
  { code: "+674", country: "Nauru" },
  { code: "+977", country: "Nepal" },
  { code: "+31", country: "Netherlands" },
  { code: "+64", country: "New Zealand" },
  { code: "+505", country: "Nicaragua" },
  { code: "+227", country: "Niger" },
  { code: "+234", country: "Nigeria" },
  { code: "+389", country: "North Macedonia" },
  { code: "+47", country: "Norway" },
  { code: "+968", country: "Oman" },
  { code: "+92", country: "Pakistan" },
  { code: "+680", country: "Palau" },
  { code: "+507", country: "Panama" },
  { code: "+675", country: "Papua New Guinea" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Peru" },
  { code: "+63", country: "Philippines" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+974", country: "Qatar" },
  { code: "+40", country: "Romania" },
  { code: "+7", country: "Russia" },
  { code: "+250", country: "Rwanda" },
  { code: "+1869", country: "Saint Kitts & Nevis" },
  { code: "+1758", country: "Saint Lucia" },
  { code: "+1784", country: "Saint Vincent" },
  { code: "+685", country: "Samoa" },
  { code: "+378", country: "San Marino" },
  { code: "+239", country: "São Tomé & Príncipe" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+221", country: "Senegal" },
  { code: "+381", country: "Serbia" },
  { code: "+248", country: "Seychelles" },
  { code: "+232", country: "Sierra Leone" },
  { code: "+65", country: "Singapore" },
  { code: "+421", country: "Slovakia" },
  { code: "+386", country: "Slovenia" },
  { code: "+677", country: "Solomon Islands" },
  { code: "+252", country: "Somalia" },
  { code: "+27", country: "South Africa" },
  { code: "+211", country: "South Sudan" },
  { code: "+34", country: "Spain" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+249", country: "Sudan" },
  { code: "+597", country: "Suriname" },
  { code: "+46", country: "Sweden" },
  { code: "+41", country: "Switzerland" },
  { code: "+963", country: "Syria" },
  { code: "+886", country: "Taiwan" },
  { code: "+992", country: "Tajikistan" },
  { code: "+255", country: "Tanzania" },
  { code: "+66", country: "Thailand" },
  { code: "+670", country: "Timor-Leste" },
  { code: "+228", country: "Togo" },
  { code: "+676", country: "Tonga" },
  { code: "+1868", country: "Trinidad & Tobago" },
  { code: "+216", country: "Tunisia" },
  { code: "+90", country: "Turkey" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+688", country: "Tuvalu" },
  { code: "+256", country: "Uganda" },
  { code: "+380", country: "Ukraine" },
  { code: "+971", country: "UAE" },
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States" },
  { code: "+598", country: "Uruguay" },
  { code: "+998", country: "Uzbekistan" },
  { code: "+678", country: "Vanuatu" },
  { code: "+379", country: "Vatican City" },
  { code: "+58", country: "Venezuela" },
  { code: "+84", country: "Vietnam" },
  { code: "+967", country: "Yemen" },
  { code: "+260", country: "Zambia" },
  { code: "+263", country: "Zimbabwe" },
];

export default function DonateClient() {
  const [amount, setAmount] = useState("250");
  const [customAmount, setCustomAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [countrySearch, setCountrySearch] = useState("India (+91)");
  const [showDropdown, setShowDropdown] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<DonationState>({
    id: "",
    amount: "",
    email: "",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCountries = COUNTRY_CODES.filter(
    ({ country, code }) =>
      country.toLowerCase().includes(countrySearch.toLowerCase()) ||
      code.includes(countrySearch)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        // reset search text to selected value if user clicked away without selecting
        const match = COUNTRY_CODES.find((c) => c.code === countryCode);
        if (match) setCountrySearch(`${match.country} (${match.code})`);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [countryCode]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      console.error("Razorpay script failed to load");
      setRazorpayLoaded(false);
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const selectCountry = (code: string, country: string) => {
    setCountryCode(code);
    setCountrySearch(`${country} (${code})`);
    setShowDropdown(false);
  };

  const handlePayment = () => {
    const finalAmount = customAmount ? customAmount : amount;

    if (!razorpayLoaded) {
      alert("Payment gateway is loading. Please wait or refresh the page if this persists.");
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      alert("Payment configuration error");
      return;
    }
    if (!name || !phone) {
      alert("Please enter your name and phone number");
      return;
    }

    setLoading(true);

    const fullPhone = `${countryCode}${phone}`;

    const options: RazorpayOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Number(finalAmount) * 100,
      currency: "INR",
      name: "Modelflick",
      description: "Donation",
      handler: (response) => {
        setPaymentDetails({ id: response.razorpay_payment_id, amount: finalAmount, email });
        setPaymentSuccess(true);
        setLoading(false);
      },
      prefill: {
        name,
        email: email || undefined,
        contact: fullPhone,
      },
      config: {
        display: {
          blocks: {
            international: {
              name: "Pay via International Card",
              instruments: [{ method: "card" }],
            },
            other: {
              name: "Other Payment Methods",
              instruments: [
                { method: "upi" },
                { method: "netbanking" },
                { method: "wallet" },
              ],
            },
          },
          sequence: ["block.international", "block.other"],
          preferences: { show_default_blocks: false },
        },
      },
      theme: { color: "#3399cc" },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        alert(`Payment failed: ${response.error.description}\n\nPlease refresh and try again.`);
        setLoading(false);
      });
      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment initialization failed. Please refresh and try again.");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentSuccess(false);
    setAmount("250");
    setCustomAmount("");
    setName("");
    setEmail("");
    setCountryCode("+91");
    setCountrySearch("India (+91)");
    setPhone("");
  };

  const handleAmountSelect = (selectedAmount: string) => {
    setAmount(selectedAmount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomAmount(value);
    if (value) setAmount("");
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you for your donation!</h2>
          <p className="text-gray-600">Your support helps us continue our work.</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-lg mb-3 text-gray-700">Donation Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium">₹{paymentDetails.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment ID:</span>
              <span className="font-medium text-sm break-all">{paymentDetails.id}</span>
            </div>
            {paymentDetails.email && (
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{paymentDetails.email}</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={resetForm} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
          Make Another Donation
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Support Our Work</h1>
      <p className="text-gray-600 mb-6">Your support fuels real change in our community.</p>

      <div className="space-y-6">

        {/* Amount Selection */}
        <div>
          <label className="block text-gray-700 font-medium mb-3">Select an amount (₹)</label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {["250", "500", "1000", "2000", "5000", "10000"].map((amt) => (
              <button
                key={amt}
                onClick={() => handleAmountSelect(amt)}
                className={`py-2 rounded-lg border transition-colors ${
                  amount === amt && !customAmount
                    ? "bg-blue-100 border-blue-500 text-blue-700"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">₹</span>
            </div>
            <input
              type="number"
              value={customAmount}
              onChange={handleCustomAmountChange}
              placeholder="Other amount"
              className="w-full pl-8 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="10"
              step="10"
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Email — optional */}
        <div>
          <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
            Email Address{" "}
            <span className="text-gray-400 font-normal text-sm">(optional )</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Phone with searchable country code */}
        <div>
          <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            {/* Searchable country code */}
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => {
                  setCountrySearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  setCountrySearch("");
                  setShowDropdown(true);
                }}
                placeholder="Country"
                className="w-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 text-sm"
              />
              {showDropdown && (
                <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map(({ code, country }) => (
                      <button
                        key={`${country}-${code}`}
                        onClick={() => selectCountry(code, country)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-700 flex justify-between items-center"
                      >
                        <span>{country}</span>
                        <span className="text-gray-400 ml-2">{code}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-gray-400">No results</p>
                  )}
                </div>
              )}
            </div>

            {/* Phone number input */}
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="Phone number"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Type to search your country, then enter your number.
          </p>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${
            loading || !razorpayLoaded
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            `Donate ₹${customAmount || amount}`
          )}
        </button>

        {/* Help text */}
        <div className="text-sm text-gray-500 p-3 rounded-lg border border-gray-200">
          <p className="mb-1 font-medium">Having trouble with payment?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Refresh the page if payment does not start</li>
            <li>Ensure pop-ups are enabled for this site</li>
            <li>International cards (Visa, Mastercard, Amex) are accepted</li>
            <li>Try again after a few moments if it fails</li>
          </ul>
        </div>

        {!razorpayLoaded && (
          <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
            Payment gateway is loading...
          </div>
        )}

      </div>
    </div>
  );
}