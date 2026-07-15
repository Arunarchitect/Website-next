import { useState, ChangeEvent, FormEvent } from "react";
import { useRegisterMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

interface RegisterErrorData {
  promo_code?: string[];
  email?: string[];
  password?: string[];
  first_name?: string[];
  last_name?: string[];
  non_field_errors?: string[];
}

function isFetchBaseQueryError(
  error: unknown
): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error;
}

function getErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  if (!error) return "Failed to register";

  if (isFetchBaseQueryError(error)) {
    const data = error.data as RegisterErrorData | undefined;

    return (
      data?.promo_code?.[0] ||
      data?.email?.[0] ||
      data?.password?.[0] ||
      data?.first_name?.[0] ||
      data?.last_name?.[0] ||
      data?.non_field_errors?.[0] ||
      "Failed to register"
    );
  }

  return error.message ?? "Failed to register";
}

interface RegisterFormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  re_password: string;
  promo_code: string;
}

export default function useRegister() {
  const router = useRouter();
  const [register, { isLoading }] = useRegisterMutation();

  const [formData, setFormData] = useState<RegisterFormData>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    re_password: "",
    promo_code: "",
  });

  const {
    first_name,
    last_name,
    email,
    password,
    re_password,
    promo_code,
  } = formData;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    register({
      first_name,
      last_name,
      email,
      password,
      re_password,
      promo_code,
    })
      .unwrap()
      .then(() => {
        toast.success("Please check email");
        router.push("/auth/login");
      })
      .catch((error: FetchBaseQueryError | SerializedError) => {
        toast.error(getErrorMessage(error));
      });
  };

  return {
    first_name,
    last_name,
    email,
    password,
    re_password,
    promo_code,
    isLoading,
    onChange,
    onSubmit,
  };
}