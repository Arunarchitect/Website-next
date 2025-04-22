"use client";

import { useEffect } from "react";
import { useActivationMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter, useParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const params = useParams(); // ⬅️ useParams gives you the route params
  const [activation] = useActivationMutation();

  useEffect(() => {
    const uid = params?.uid as string;
    const token = params?.token as string;

    if (!uid || !token) return;

    activation({ uid, token })
      .unwrap()
      .then(() => {
        toast.success("Account Activated");
      })
      .catch(() => {
        toast.error("Failed to Activate");
      })
      .finally(() => {
        router.push("/auth/login");
      });
  }, [params]);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h1 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Activating your Account...
        </h1>
      </div>
    </div>
  );
}
