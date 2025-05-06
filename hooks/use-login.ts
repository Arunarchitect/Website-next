import { useState, ChangeEvent, FormEvent } from "react";
import { useLoginMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { setAuth } from "@/redux/features/authSlice";
import { useAppDispatch } from "@/redux/hooks";

export default function useLogin() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const { email, password } = formData;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    login({ email, password })
      .unwrap()
      .then((data) => {
        // Save access and refresh tokens to localStorage
        localStorage.setItem('access', data.access);
        localStorage.setItem('refresh', data.refresh);

        // Dispatch action to update the auth state (if needed)
        dispatch(setAuth());

        toast.success("Logged in successfully", {
          autoClose: 3000,
          pauseOnHover: true,
        });

        // Redirect to the dashboard immediately after login
        router.push("/dashboard");
      })
      .catch((error) => {
        const toastOptions = {
          autoClose: 5000,
          pauseOnHover: true,
        };

        // Handle errors based on the error status
        if (error.status === 400) {
          toast.error(
            error.data?.detail || "Invalid request format", 
            toastOptions
          );
        } else if (error.status === 401) {
          toast.error(
            error.data?.detail || "Invalid credentials", 
            toastOptions
          );
        } else if (error.status === 500) {
          toast.error(
            "Server error - please try again later", 
            toastOptions
          );
        } else if (error.status === 'FETCH_ERROR' || !error.status) {
          toast.error(
            "Network error - please check your connection", 
            toastOptions
          );
        } else {
          toast.error(
            "Login failed - please try again", 
            toastOptions
          );
        }
      });
  };

  return {
    email,
    password,
    isLoading,
    onChange,
    onSubmit,
  };
}
