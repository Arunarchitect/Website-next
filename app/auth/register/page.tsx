import Link from "next/link";
import { RegisterForm } from "@/components/forms";
import type { Metadata } from "next";
import Image from "next/image"; // import Image from next/image

export const metadata: Metadata = {
  title: "Modelflick | Register",
  description: "Modelflick register page",
};

export default function Page() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <Image
          src="/logo.svg"
          alt="Modelflick"
          width={80} // <- Add width
          height={80} // <- Add height
          className="mx-auto h-20 w-auto"
          priority // optional: load early
        />
        <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tighttext-gray-700 dark:text-gray-300">
          Sign Up
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <RegisterForm />

        <p className="mt-10 text-center text-sm/6 text-gray-500">
          Already Have an Account?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Login Here
          </Link>
        </p>
      </div>
    </div>
  );
}
