"use client";

import { useLogin } from "@/hooks";
import { Form } from "@/components/forms";

type LoginFormProps = {
  next?: string;
};

export default function LoginForm({ next }: LoginFormProps) {
  const { email, password, isLoading, onChange, onSubmit } = useLogin();

  const safeNext = next && next.startsWith("/") ? next : "/";

  const config = [
    {
      labelText: "Email",
      labelId: "email",
      type: "email",
      value: email,
      required: true,
    },
    {
      labelText: "Password",
      labelId: "password",
      type: "password",
      value: password,
      link: {
        linkText: "Forgot Password?",
        linkUrl: "/password-reset",
      },
      required: true,
    },
    {
      labelText: "Next",
      labelId: "next",
      type: "hidden",
      value: safeNext,
      required: false,
    },
  ];

  return (
    <Form
      config={config}
      isLoading={isLoading}
      btnText="Sign In"
      onChange={onChange}
      onSubmit={onSubmit}
    />
  );
}