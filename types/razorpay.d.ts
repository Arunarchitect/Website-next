// types/razorpay.d.ts
export interface RazorpayOptions {
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

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface PaymentFailedResponse {
  error: {
    description: string;
    code?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

export interface RazorpayInstance {
  on: (event: 'payment.failed', callback: (response: PaymentFailedResponse) => void) => void;
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}