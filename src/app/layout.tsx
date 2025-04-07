// DO NOT USE 'use client' here

import './globals.css';
import ClientLayout from './client-layout';

export const metadata = {
  title: 'Modelflick',
  description: 'Architectural project tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-sans">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
