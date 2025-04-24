'use client';

import { useAppSelector } from '@/redux/hooks';
import { Spinner } from '@/components/common';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAppSelector(state => state.auth);

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  return <>{children}</>;
}
