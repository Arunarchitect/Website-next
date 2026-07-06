
// app/pixels/buy/page.tsx
"use client";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type BillingPeriod = "monthly" | "annual";
type PaymentType = "one-time" | "recurring";

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const COST_PER_PIXEL = 5;
const MIN_UNITS = 1;
const MAX_UNITS = 60;
// When an image is uploaded, its longer side is scaled to this many
// grid units, and the shorter side scales proportionally to preserve
// the image's real aspect ratio.
const TARGET_LONG_SIDE = 24;

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function clamp(value: number) {
  if (Number.isNaN(value)) return MIN_UNITS;
  return Math.max(MIN_UNITS, Math.min(MAX_UNITS, Math.round(value)));
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function BuyPixelsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [paymentType, setPaymentType] = useState<PaymentType>("recurring");

  const [width, setWidth] = useState<number>(6);
  const [height, setHeight] = useState<number>(6);
  // raw text state so users can freely type/clear the field mid-edit
  const [widthInput, setWidthInput] = useState<string>("6");
  const [heightInput, setHeightInput] = useState<string>("6");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState<{ w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  /* ---------------- Width / height input handling ---------------- */

  const commitWidth = (raw: string) => {
    const num = clamp(parseInt(raw, 10));
    setWidth(num);
    setWidthInput(String(num));
  };

  const commitHeight = (raw: string) => {
    const num = clamp(parseInt(raw, 10));
    setHeight(num);
    setHeightInput(String(num));
  };

  const adjustWidth = (delta: number) => {
    const num = clamp(width + delta);
    setWidth(num);
    setWidthInput(String(num));
  };

  const adjustHeight = (delta: number) => {
    const num = clamp(height + delta);
    setHeight(num);
    setHeightInput(String(num));
  };

  /* ---------------- Image handling ---------------- */

  const processFile = useCallback((file: File) => {
    setImageError(null);

    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (isSvg) {
      setImageError("SVGs are vector graphics without fixed pixel dimensions — please upload a PNG or JPG.");
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError("Only PNG and JPG files are supported.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      const realW = img.naturalWidth;
      const realH = img.naturalHeight;

      // Scale so the longer side maps to TARGET_LONG_SIDE grid units,
      // preserving the real aspect ratio for the shorter side.
      const longSide = Math.max(realW, realH);
      const scale = TARGET_LONG_SIDE / longSide;

      const gridW = clamp(realW * scale);
      const gridH = clamp(realH * scale);

      setWidth(gridW);
      setHeight(gridH);
      setWidthInput(String(gridW));
      setHeightInput(String(gridH));
      setAutoDetected({ w: gridW, h: gridH });
      setImagePreview(objectUrl);
    };

    img.onerror = () => {
      setImageError("Couldn't read that image — please try another file.");
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageError(null);
    setAutoDetected(null);
  };

  const isCustomSize = autoDetected
    ? width !== autoDetected.w || height !== autoDetected.h
    : false;

  /* ---------------- Pricing ---------------- */

  const totalUnits = width * height;
  const monthlyPrice = totalUnits * COST_PER_PIXEL;
  const annualPrice = Math.round(monthlyPrice * 12 * 0.8);
  const price = billingPeriod === "monthly" ? monthlyPrice : annualPrice;
  const periodText = billingPeriod === "monthly" ? "month" : "year";

  /* ---------------- Theme classes ---------------- */

  const t = {
    background: theme === "dark" ? "bg-neutral-950" : "bg-neutral-50",
    text: theme === "dark" ? "text-neutral-100" : "text-neutral-900",
    textSecondary: theme === "dark" ? "text-neutral-400" : "text-neutral-600",
    border: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    cardBg: theme === "dark" ? "bg-neutral-900" : "bg-white",
    inputBg: theme === "dark" ? "bg-neutral-800" : "bg-neutral-100",
    inputBorder: theme === "dark" ? "border-neutral-700" : "border-neutral-300",
    canvasBg: theme === "dark" ? "bg-neutral-950" : "bg-neutral-100",
  };

  // Visual size of the preview rectangle — scaled so it always fits nicely,
  // preserving the width:height ratio the user has chosen.
  const maxPreviewSide = 260;
  const longer = Math.max(width, height, 1);
  const previewW = Math.max(24, Math.round((width / longer) * maxPreviewSide));
  const previewH = Math.max(24, Math.round((height / longer) * maxPreviewSide));

  return (
    <main className={`min-h-screen ${t.background} ${t.text} px-4 py-6 sm:py-12 sm:px-8 transition-colors duration-300`}>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/opensource" className="text-indigo-500 hover:text-indigo-400 transition-colors text-sm">
            ← Back to Wall
          </Link>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${t.cardBg} ${t.border} border transition-colors duration-200 text-xl`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Heading */}
        <section className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Buy Pixels to Support Open Source
          </h1>
          <p className={`${t.textSecondary} max-w-2xl mx-auto text-sm sm:text-base`}>
            Type in your block size, or upload your logo and we`&apos;`ll size it automatically to match its shape.
          </p>
        </section>

        {/* Sizer + Uploader */}
        <div className={`rounded-2xl border ${t.border} ${t.cardBg} p-6 mb-8 transition-colors duration-300`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: live rectangle preview + inputs */}
            <div>
              <h2 className="text-sm font-semibold mb-4 uppercase tracking-wide text-indigo-500">
                Block Size
              </h2>

              <div className={`flex items-center justify-center rounded-xl ${t.canvasBg} border ${t.border} p-6 mb-6 min-h-[220px]`}>
                <div
                  className="relative rounded-md overflow-hidden shadow-lg transition-all duration-200 ease-out border-2 border-indigo-500"
                  style={{ width: previewW, height: previewH }}
                >
                  {imagePreview ? (
                    <Image
                        src={imagePreview}
                        alt="Logo preview"
                        fill
                        className="object-cover"
                        unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500/40 to-indigo-700/40" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2 text-neutral-500">
                    Width (px units)
                  </label>
                  <div className={`flex items-center rounded-lg border ${t.inputBorder} ${t.inputBg} overflow-hidden`}>
                    <button
                      onClick={() => adjustWidth(-1)}
                      className="px-3 py-2 text-lg hover:bg-indigo-600 hover:text-white transition-colors"
                      aria-label="Decrease width"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_UNITS}
                      max={MAX_UNITS}
                      value={widthInput}
                      onChange={(e) => setWidthInput(e.target.value)}
                      onBlur={(e) => commitWidth(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitWidth((e.target as HTMLInputElement).value);
                      }}
                      className="w-full text-center text-sm font-medium bg-transparent py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => adjustWidth(1)}
                      className="px-3 py-2 text-lg hover:bg-indigo-600 hover:text-white transition-colors"
                      aria-label="Increase width"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2 text-neutral-500">
                    Height (px units)
                  </label>
                  <div className={`flex items-center rounded-lg border ${t.inputBorder} ${t.inputBg} overflow-hidden`}>
                    <button
                      onClick={() => adjustHeight(-1)}
                      className="px-3 py-2 text-lg hover:bg-indigo-600 hover:text-white transition-colors"
                      aria-label="Decrease height"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_UNITS}
                      max={MAX_UNITS}
                      value={heightInput}
                      onChange={(e) => setHeightInput(e.target.value)}
                      onBlur={(e) => commitHeight(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitHeight((e.target as HTMLInputElement).value);
                      }}
                      className="w-full text-center text-sm font-medium bg-transparent py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => adjustHeight(1)}
                      className="px-3 py-2 text-lg hover:bg-indigo-600 hover:text-white transition-colors"
                      aria-label="Increase height"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <p className={`mt-3 text-xs ${t.textSecondary}`}>
                {totalUnits.toLocaleString()} pixels total &middot; any whole number, {MIN_UNITS}–{MAX_UNITS} per side
              </p>

              {autoDetected && isCustomSize && (
                <p className="mt-2 text-xs text-amber-500">
                  Custom size — no longer matches your uploaded image`&apos;`s proportions.
                </p>
              )}
            </div>

            {/* Right: uploader */}
            <div>
              <h2 className="text-sm font-semibold mb-4 uppercase tracking-wide text-indigo-500">
                Upload Logo
              </h2>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center min-h-[220px] rounded-xl border-2 border-dashed cursor-pointer transition-colors duration-150 p-6 text-center ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-500/10"
                    : `${t.inputBorder} ${t.canvasBg} hover:border-indigo-500`
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="text-3xl mb-3">📁</div>
                <p className="text-sm font-medium">
                  Drag & drop your logo here
                </p>
                <p className={`text-xs mt-1 ${t.textSecondary}`}>
                  or click to browse &middot; PNG or JPG only
                </p>
              </div>

              {imageError && (
                <p className="mt-3 text-xs text-red-500">{imageError}</p>
              )}

              {imagePreview && !imageError && autoDetected && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-green-500">
                    Detected {autoDetected.w}×{autoDetected.h} from your image `&apos;`s aspect ratio
                  </p>
                  <button
                    onClick={clearImage}
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline"
                  >
                    Remove
                  </button>
                </div>
              )}

              <p className={`mt-4 text-xs ${t.textSecondary} leading-relaxed`}>
                We read your image `&apos;`s real resolution and scale its longer side
                to {TARGET_LONG_SIDE} grid units, keeping the same proportions
                as your logo. You can still type in any width/height by hand.
                SVGs aren`&apos;`t supported since they have no fixed pixel resolution.
              </p>
            </div>
          </div>
        </div>

        {/* Billing and Payment Options */}
        <div className={`rounded-2xl border ${t.border} ${t.cardBg} p-6 mb-8 transition-colors duration-300`}>
          <h2 className="text-lg font-semibold mb-4">Payment Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Billing Period</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    billingPeriod === "monthly"
                      ? "bg-indigo-600 text-white"
                      : `${t.inputBg} ${t.text} border ${t.inputBorder}`
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod("annual")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    billingPeriod === "annual"
                      ? "bg-indigo-600 text-white"
                      : `${t.inputBg} ${t.text} border ${t.inputBorder}`
                  }`}
                >
                  Annual <span className="text-xs text-green-500">Save 20%</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Payment Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentType("one-time")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    paymentType === "one-time"
                      ? "bg-indigo-600 text-white"
                      : `${t.inputBg} ${t.text} border ${t.inputBorder}`
                  }`}
                >
                  One-time
                </button>
                <button
                  onClick={() => setPaymentType("recurring")}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    paymentType === "recurring"
                      ? "bg-indigo-600 text-white"
                      : `${t.inputBg} ${t.text} border ${t.inputBorder}`
                  }`}
                >
                  Recurring
                </button>
              </div>
              <p className="text-xs mt-2 text-neutral-500">
                {paymentType === "recurring"
                  ? "You'll be billed automatically each period"
                  : "One-time payment for the selected period"}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className={`rounded-2xl border ${t.border} ${t.cardBg} p-6 mb-8 transition-colors duration-300`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold">Total</h3>
              <p className={`${t.textSecondary} text-sm`}>
                {width}×{height} block &middot; {totalUnits.toLocaleString()} pixels &middot; {billingPeriod} billing &middot; {paymentType} payment
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-500">
                ${price.toLocaleString()}
              </div>
              <div className={`${t.textSecondary} text-sm`}>
                per {periodText}
                {billingPeriod === "annual" && (
                  <span className="text-green-500 ml-2">(Save 20%)</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              console.log("Purchase:", {
                pixels: totalUnits,
                dimensions: `${width}×${height}`,
                period: billingPeriod,
                payment: paymentType,
                price,
              });
              // TODO: wire this up to checkout
            }}
            className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors"
          >
            Purchase Now — ${price.toLocaleString()}
          </button>
        </div>

        {/* FAQ */}
        <div className={`rounded-2xl border ${t.border} ${t.cardBg} p-6 transition-colors duration-300`}>
          <h3 className="text-lg font-semibold mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm">What happens after my subscription ends?</h4>
              <p className={`${t.textSecondary} text-sm mt-1`}>
                Your logo moves to our archives page. You can renew anytime to reappear on the main wall.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Why can`&apos;`t I upload an SVG?</h4>
              <p className={`${t.textSecondary} text-sm mt-1`}>
                SVGs are vector graphics — they don`&apos;`t have a fixed pixel resolution, so we can`&apos;`t size a pixel block from them automatically. Export your logo as PNG or JPG first.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Can I type in an odd number like 7×13?</h4>
              <p className={`${t.textSecondary} text-sm mt-1`}>
                Yes — any whole number between {MIN_UNITS} and {MAX_UNITS} is allowed on each side.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}