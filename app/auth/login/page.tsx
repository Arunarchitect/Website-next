import Link from "next/link";
import { LoginForm } from "@/components/forms";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Modelflick | Login",
  description: "Modelflick login page",
};

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <Image
          src="/logo.svg"
          alt="Modelflick"
          width={80}
          height={80}
          className="mx-auto h-20 w-auto"
          priority
        />
        <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-700 dark:text-gray-300">
          Sign in to your Account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Pass the next destination into the form */}
        <LoginForm next={next} />

        <p className="mt-10 text-center text-sm/6 text-gray-500">
          Don&apos;t have an Account?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}