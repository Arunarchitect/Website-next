import { useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useResetPasswordConfirmMutation } from '@/redux/features/authApiSlice';
import { toast } from 'react-toastify';

export default function useResetPasswordConfirm(uid: string, token: string) {
  const router = useRouter();

  const [resetPasswordConfirm, { isLoading }] = useResetPasswordConfirmMutation();

  const [formData, setFormData] = useState({
    new_password: '',
    re_new_password: '',
  });

  const { new_password, re_new_password } = formData;

  // Update form fields on change
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle form submission
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Client-side validation: check if passwords match
    if (new_password !== re_new_password) {
      toast.error('Passwords do not match');
      return;
    }

    // API call to reset password
    resetPasswordConfirm({ uid, token, new_password, re_new_password })
      .unwrap()
      .then(() => {
        toast.success('Password reset successful');
        router.push('/auth/login'); // Redirect to login
      })
      .catch(() => {
        toast.error('Password reset failed');
      });
  };

  return {
    new_password,
    re_new_password,
    isLoading,
    onChange,
    onSubmit,
  };
}
