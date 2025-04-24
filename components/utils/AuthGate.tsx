'use client';

import { useAppSelector } from '@/redux/hooks';
import { Spinner } from '@/components/common';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const { isLoading } = useAppSelector((state) => state.auth);

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  return <>{children}</>;
}
