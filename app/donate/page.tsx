"use client";
import { useState, useEffect } from "react";
import type { RazorpayOptions } from "@/types/razorpay";

interface DonationState {
  id: string;
  amount: string;
  email: string;
}

export default function DonatePage() {
  const [amount, setAmount] = useState("250");
  const [customAmount, setCustomAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<DonationState>({
    id: "",
    amount: "",
    email: "",
  });

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

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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

    if (!name || !email) {
      alert("Please fill all required fields");
      return;
    }

    setLoading(true);

    const options: RazorpayOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Number(finalAmount) * 100,
      currency: "INR",
      name: "Your Organization",
      description: "Donation",
      handler: (response) => {
        setPaymentDetails({
          id: response.razorpay_payment_id,
          amount: finalAmount,
          email,
        });
        setPaymentSuccess(true);
        setLoading(false);
      },
      prefill: {
        name,
        email,
      },
      theme: {
        color: "#3399cc",
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      
      rzp.on("payment.failed", (response) => {
        alert(`Payment failed: ${response.error.description}\n\nPlease refresh the page if you'd like to try again.`);
        setLoading(false);
      });

      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment initialization failed. Please refresh the page and try again.");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentSuccess(false);
    setAmount("250");
    setCustomAmount("");
    setName("");
    setEmail("");
  };

  const handleAmountSelect = (selectedAmount: string) => {
    setAmount(selectedAmount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomAmount(value);
    if (value) {
      setAmount("");
    }
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
              <span className="font-medium">{paymentDetails.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{paymentDetails.email}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={resetForm}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
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
        <div>
          <label className="block text-gray-700 font-medium mb-3">Select an amount (₹)</label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {["250", "500", "1000", "2000", "5000", "10000"].map((amt) => (
              <button
                key={amt}
                onClick={() => handleAmountSelect(amt)}
                className={`py-2 rounded-lg border transition-colors ${amount === amt && !customAmount ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
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
        
        <div>
          <label htmlFor="name" className="block text-gray-700 font-medium mb-2">Your Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <button
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className={`w-full py-3 rounded-lg text-white font-medium transition-colors ${loading || !razorpayLoaded ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
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
        
        {/* Always displayed help text */}
        <div className="text-sm text-gray-500 p-3 rounded-lg border border-gray-200">
          <p className="mb-1">Having trouble with payment?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Refresh the page if payment does not start or is still Loading</li>
            <li>Ensure pop-ups are enabled for this site</li>
            <li>Try again after a few moments if it fails</li>
          </ul>
        </div>
        
        {/* Still keep the loading indicator but separate from help text */}
        {!razorpayLoaded && (
          <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
            Payment gateway is loading...
          </div>
        )}
      </div>
    </div>
  );
}