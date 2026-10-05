// app/main/admin/layout.tsx  (copy the same file to app/new/dash/layout.tsx)
// IMPORTANT: no "use client" here. This must be a Server Component.
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display", // no `weight`: Space Grotesk is a variable font
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${mono.variable}`}>{children}</div>
  );
}