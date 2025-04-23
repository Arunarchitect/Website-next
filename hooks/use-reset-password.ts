import { useState, ChangeEvent, FormEvent } from 'react';
import { useResetPasswordMutation } from '@/redux/features/authApiSlice';
import { toast } from 'react-toastify';

export default function useResetPassword() {
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [email, setEmail] = useState('');

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    resetPassword({ email }) // Corrected: pass email inside an object
      .unwrap() // Unwrap for better error handling
      .then(() => {
        toast.success('Request sent, check your email for reset link');
      })
      .catch((error) => {
        console.error('Reset password failed:', error);
        toast.error('Failed to send request');
      });
  };

  return {
    email,
    isLoading,
    onChange,
    onSubmit,
  };
}
