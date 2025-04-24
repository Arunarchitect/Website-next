'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setAuth, finishInitialLoad, logout } from '@/redux/features/authSlice';
import { useVerifyMutation } from '@/redux/features/authApiSlice';
import { useRouter } from 'next/navigation';

export default function useVerify() {
  const dispatch = useAppDispatch();
  const [verify] = useVerifyMutation();
  const router = useRouter();

  useEffect(() => {
    const verifyToken = async () => {
      const access = localStorage.getItem('access');
      
      try {
        if (access) {
          await verify({ token: access }).unwrap();
          dispatch(setAuth());
        } else {
          dispatch(logout());
        }
      } catch (error) {
        dispatch(logout());
      } finally {
        dispatch(finishInitialLoad());
      }
    };

    verifyToken();
  }, [dispatch, verify]);

  // No more automatic reload - state changes will trigger re-renders
}