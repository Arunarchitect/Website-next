// /hooks/use-login.ts
import { useState, ChangeEvent, FormEvent } from "react";
import { useLoginMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { setAuth } from "@/redux/features/authSlice";
import { useAppDispatch } from "@/redux/hooks";
import { OrganisationMembership } from "@/redux/features/membershipApiSlice";

const BASE_URL = process.env.NEXT_PUBLIC_HOST; // ← match your actual env var name

async function fetchIsAdmin(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/my-memberships/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data: OrganisationMembership[] = await res.json();
    return data.some((m) => m.role === "admin");
  } catch {
    return false;
  }
}

export default function useLogin() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const { email, password } = formData;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    login({ email, password })
      .unwrap()
      .then(async (data) => {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        dispatch(setAuth());

        toast.success("Logged in successfully", {
          autoClose: 3000,
          pauseOnHover: true,
        });

        const isAdmin = await fetchIsAdmin(data.access);
        const destination = isAdmin ? "/new/dash/dashadmin" : "/new/dash/dashnormal";

        setTimeout(() => {
          router.push(destination);
        }, 3000);
      })
      .catch((error) => {
        const toastOptions = { autoClose: 5000, pauseOnHover: true };
        if (error.status === 400) {
          toast.error(error.data?.detail || "Invalid request format", toastOptions);
        } else if (error.status === 401) {
          toast.error(error.data?.detail || "Invalid credentials", toastOptions);
        } else if (error.status === 500) {
          toast.error("Server error - please try again later", toastOptions);
        } else if (error.status === "FETCH_ERROR" || !error.status) {
          toast.error("Network error - please check your connection", toastOptions);
        } else {
          toast.error("Login failed - please try again", toastOptions);
        }
      });
  };

  return { email, password, isLoading, onChange, onSubmit };
}