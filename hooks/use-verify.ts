'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setAuth, finishInitialLoad, logout } from '@/redux/features/authSlice';
import { useVerifyMutation, useRefreshTokenMutation } from '@/redux/features/authApiSlice';
import { useRouter } from 'next/navigation';

export default function useVerify() {
  const dispatch = useAppDispatch();
  const [verify] = useVerifyMutation();
  const [refreshToken] = useRefreshTokenMutation();
  const router = useRouter();

  useEffect(() => {
    const verifyToken = async () => {
      const access = localStorage.getItem('access');
      const refresh = localStorage.getItem('refresh');

      try {
        if (access) {
          // Verify if access token is valid
          await verify({ token: access }).unwrap();
          dispatch(setAuth());
        } else if (refresh) {
          // Try refreshing token
          const response = await refreshToken({ refresh }).unwrap();

          console.log('Refresh response:', response); // <-- LOG ADDED HERE

          if (response?.access) {
            localStorage.setItem('access', response.access);
          }

          if (response?.refresh) {
            localStorage.setItem('refresh', response.refresh);
          }

          dispatch(setAuth());
        } else {
          dispatch(logout());
        }
      } catch (error) {
        console.error('Token verification or refresh error:', error);
        dispatch(logout());
      } finally {
        dispatch(finishInitialLoad());
      }
    };

    verifyToken();
  }, [dispatch, verify, refreshToken]);

}
