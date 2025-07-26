// app/donate/page.tsx
"use client";
import { useState, useEffect } from "react";

interface PaymentDetails {
  id: string;
  amount: string;
  email: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface PaymentFailedResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: 'payment.failed', callback: (response: PaymentFailedResponse) => void) => void;
    };
  }
}

export default function DonatePage() {
  const [amount, setAmount] = useState("100");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    id: "",
    amount: "",
    email: "",
  });

  useEffect(() => {
    const loadRazorpay = () => {
      if (typeof window !== "undefined" && !window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => setRazorpayLoaded(true);
        script.onerror = () => {
          console.error("Failed to load Razorpay script");
          setRazorpayLoaded(false);
        };
        document.body.appendChild(script);
      } else {
        setRazorpayLoaded(true);
      }
    };

    loadRazorpay();
  }, []);

  const handlePayment = () => {
    if (!razorpayLoaded) {
      alert("Payment gateway is still loading. Please try again in a moment.");
      return;
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      alert("Payment gateway configuration error");
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
      rzp.on("payment.failed", (response: PaymentFailedResponse) => {
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

  const handleNewDonation = () => {
    setPaymentSuccess(false);
    setAmount("100");
    setName("");
    setEmail("");
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-md mx-auto p-4 text-center">
        <div className="bg-green-100 text-green-800 p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">Thank You For Your Donation!</h2>
          <div className="text-left space-y-2 bg-white p-4 rounded">
            <p>
              <span className="font-semibold">Amount:</span> ₹{paymentDetails.amount}
            </p>
            <p>
              <span className="font-semibold">Payment ID:</span> {paymentDetails.id}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {paymentDetails.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleNewDonation}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Make Another Donation
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Make a Donation</h1>

      <div className="space-y-5">
        <div>
          <label className="block mb-2 font-medium">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            min="10"
            required
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            required
          />
        </div>

        <button
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing Payment..." : `Donate ₹${amount}`}
        </button>
      </div>

      {!razorpayLoaded && (
        <p className="mt-2 text-sm text-yellow-600">Payment gateway loading...</p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        Note: This is a test payment. No actual money will be transferred.
      </p>
    </div>
  );
}