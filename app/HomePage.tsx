"use client";

import Link from "next/link";
import { useAppSelector } from "@/redux/hooks";
import Image from "next/image";

export default function HomePage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const guestLinks = () => (
    <div className="mt-10 flex items-center justify-center gap-x-6">
      <Link
        href="/auth/login"
        className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Log into your account
      </Link>
      <Link
        href="/auth/register"
        className="text-sm font-semibold leading-6 text-gray-900"
      >
        Or create an account <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  );

  return (
    <main className="bg-white">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-12 sm:py-16 lg:py-20">
          <div className="text-center">
            {/* Add Logo */}
            <Image
              src="/logo.svg" // local logo from public folder
              alt="Modelflick"
              className="mx-auto h-20 w-auto" // you can adjust h-10
            />

            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Modelflick
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Making Architecture and Planning easier
            </p>

            {!isAuthenticated && guestLinks()}
          </div>
        </div>
      </div>
    </main>
  );
}
