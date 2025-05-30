import { PasswordResetForm } from "@/components/forms";
import type { Metadata } from "next";
import Image from "next/image"; // import Image from next/image

export const metadata: Metadata = {
  title: "Modelflick | Password Reset",
  description: "Modelflick password reset page",
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
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-700 dark:text-gray-300">
          Reset your password
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <PasswordResetForm />
      </div>
    </div>
  );
}
