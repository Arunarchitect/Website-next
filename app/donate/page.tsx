"use client";
import { useState, useEffect } from "react";
import type {
  RazorpayOptions
} from "@/types/razorpay";

interface DonationState {
  id: string;
  amount: string;
  email: string;
}

export default function DonatePage() {
  const [amount, setAmount] = useState("100");
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
    if (!razorpayLoaded) {
      alert("Payment gateway is loading. Please wait...");
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
      amount: Number(amount) * 100,
      currency: "INR",
      name: "Your Organization",
      description: "Donation",
      handler: (response) => {
        setPaymentDetails({
          id: response.razorpay_payment_id,
          amount,
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
        alert(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment initialization failed");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentSuccess(false);
    setAmount("100");
    setName("");
    setEmail("");
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-md mx-auto p-4 text-center">
        <div className="bg-green-100 text-green-800 p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">Thank You!</h2>
          <div className="text-left space-y-2 bg-white p-4 rounded">
            <p><span className="font-semibold">Amount:</span> ₹{paymentDetails.amount}</p>
            <p><span className="font-semibold">Payment ID:</span> {paymentDetails.id}</p>
            <p><span className="font-semibold">Email:</span> {paymentDetails.email}</p>
          </div>
        </div>
        <button
          onClick={resetForm}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Donate Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Donate</h1>
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 border rounded"
            min="10"
          />
        </div>
        <div>
          <label className="block mb-2">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className={`w-full py-2 rounded text-white ${loading || !razorpayLoaded ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? "Processing..." : `Donate ₹${amount}`}
        </button>
        {!razorpayLoaded && <p className="text-yellow-600 text-sm">Loading payment gateway...</p>}
      </div>
    </div>
  );
}