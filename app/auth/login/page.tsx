import Link from "next/link";
import { LoginForm } from "@/components/forms";
import type { Metadata } from "next";
import Image from "next/image";  // import Image from next/image

export const metadata: Metadata = {
  title: "Modelflick | Login",
  description: "Modelflick login page",
};

export default function Page() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
      <Image
          alt="Modelflick"
          src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
          className="mx-auto h-10 w-auto"
          width={40}  // specify the width
          height={40}  // specify the height
        />
        <h2 className=" mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-700 dark:text-gray-300">
          Sign in to your Account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm ">
        
        <LoginForm  />

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
