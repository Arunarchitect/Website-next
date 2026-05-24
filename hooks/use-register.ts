import { useState, ChangeEvent, FormEvent } from "react";
import { useRegisterMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export default function useRegister() {
  const router = useRouter();
  const [register, { isLoading }] = useRegisterMutation();

  const [formData, setFormData] = useState({
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
      .catch((error) => {
        const promoError = error?.data?.promo_code?.[0];
        const emailError = error?.data?.email?.[0];
        const passwordError = error?.data?.password?.[0];
        const nonFieldError = error?.data?.non_field_errors?.[0];

        toast.error(
          promoError ||
            emailError ||
            passwordError ||
            nonFieldError ||
            "Failed to register"
        );
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