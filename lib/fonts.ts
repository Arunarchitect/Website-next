import localFont from "next/font/local";

// Course, drawing, estimate, issues, main, meeting pages
export const spaceGrotesk = localFont({
  src: "../app/fonts/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-display",
});

export const ibmPlexMono = localFont({
  src: [
    { path: "../app/fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
});

// Product page
export const fraunces = localFont({
  src: "../app/fonts/fraunces-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-display",
});

export const inter = localFont({
  src: "../app/fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-body",
});

// Root layout
export const geistSans = localFont({
  src: "../app/fonts/geist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
});

export const geistMono = localFont({
  src: "../app/fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
});