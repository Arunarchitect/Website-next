// app/main/admin/layout.tsx  (copy the same file to app/new/dash/layout.tsx)
// IMPORTANT: no "use client" here. This must be a Server Component.
import { spaceGrotesk as display, ibmPlexMono as mono } from "@/lib/fonts";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${mono.variable}`}>{children}</div>
  );
}