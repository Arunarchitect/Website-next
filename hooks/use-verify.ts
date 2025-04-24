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
    const access = localStorage.getItem('access');
    
    if (access) {
      verify({ token: access })
        .unwrap()
        .then(() => {
          dispatch(setAuth());
          dispatch(finishInitialLoad());
        })
        .catch(() => {
          dispatch(logout());
          dispatch(finishInitialLoad());
        });
    } else {
      dispatch(finishInitialLoad());
    }
  }, [dispatch, verify]);

  useEffect(() => {
    // Automatically reload the page if authentication state changes
    const authState = localStorage.getItem('access');
    if (authState && typeof window !== 'undefined') {
      // Using window.location.href for reloading the page without full reload
      window.location.href = window.location.href;
    }
  }, [router]);
}
