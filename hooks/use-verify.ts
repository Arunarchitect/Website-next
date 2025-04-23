import { useEffect } from 'react';
import { useAppDispatch } from '@/redux/hooks';
import { setAuth, finishInitialLoad } from '@/redux/features/authSlice';
import { useVerifyMutation } from '@/redux/features/authApiSlice';

export default function useVerify() {
  const dispatch = useAppDispatch();
  const [verify] = useVerifyMutation();

  useEffect(() => {
    const access = localStorage.getItem('access');
    
    if (access) {
      verify({ token: access })
        .unwrap()
        .then(() => {
          dispatch(setAuth());
        })
        .catch(() => {
          dispatch(logout());
        })
        .finally(() => {
          dispatch(finishInitialLoad());
        });
    } else {
      dispatch(finishInitialLoad());
    }
  }, []);
}