'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { useAppSelector } from '@/redux/hooks';
import { Spinner } from '@/components/common';

interface Props {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: Props) {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    console.log('Auth state:', { isLoading, isAuthenticated });
  }, [isLoading, isAuthenticated]);

  // While checking token validity (hydrating)
  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  // Token is checked, but user is not authenticated
  if (!isAuthenticated) {
    redirect('/auth/login');
    return null;
  }

  // Auth is verified
  return <>{children}</>;
}
