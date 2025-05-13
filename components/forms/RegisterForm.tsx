"use client";

import { useRegister } from "@/hooks";
import { Form } from "@/components/forms";
import { useState } from "react";

export default function RegisterForm() {
  const {
    first_name,
    last_name,
    email,
    password,
    re_password,
    isLoading,
    onChange,
    onSubmit,
  } = useRegister();

  const [promoCode, setPromoCode] = useState("");
  const [isPromoValid, setIsPromoValid] = useState(false);
  const HARDCODED_PROMO = "arunarchitect";

  const handlePromoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPromoCode(value);
    setIsPromoValid(value === HARDCODED_PROMO);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default first
    if (isPromoValid) {
      onSubmit(e);
    }
  };

  const config = [
    {
      labelText: "First Name",
      labelId: "first_name",
      type: "text",
      value: first_name,
      required: true,
    },
    {
      labelText: "Last Name",
      labelId: "last_name",
      type: "text",
      value: last_name,
      required: true,
    },
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
      required: true,
    },
    {
      labelText: "Confirm Password",
      labelId: "re_password",
      type: "password",
      value: re_password,
      required: true,
    },
    {
      labelText: "Promo Code",
      labelId: "promo_code",
      type: "text",
      value: promoCode,
      required: true,
      onChange: handlePromoChange, // Use the custom handler
    },
  ];

  return (
    <Form
      config={config}
      isLoading={isLoading}
      btnText="Sign Up"
      onChange={onChange} // Default handler for other inputs
      onSubmit={handleSubmit}
      btnDisabled={!isPromoValid} // Disable if promo code is invalid
    />
  );
}