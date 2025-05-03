// app/password-reset/[uid]/[token]/page.tsx
import { PasswordResetConfirmForm } from '@/components/forms';
import type { Metadata } from 'next';
import Image from 'next/image';
import { use } from 'react'

// Optional metadata for the route
export const metadata: Metadata = {
  title: 'Full Auth | Password Reset Confirm',
  description: 'Full Auth password reset confirm page',
};

// ✅ In App Router, params are automatically passed (not a Promise)
export default function Page({
  params,
}: {
  params: Promise<{ uid: string; token: string }>
}) {
  const { uid, token } = use(params)

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
      <Image
          src="/logo.svg"   // local logo from public folder
          alt="Modelflick"
          className="mx-auto h-20 w-auto"  // you can adjust h-10
        />
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-700 dark:text-gray-300">
          Reset your password
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <PasswordResetConfirmForm uid={uid} token={token} />
      </div>
    </div>
  );
}
