'use client';

import { useRetrieveUserQuery } from '@/redux/features/authApiSlice';
import { List, Spinner } from '@/components/common';
import { useRouter } from 'next/navigation';
import WorklogForm from '@/components/forms/WorklogForm';

interface UserData {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export default function DashboardPage() {
  const { data: user, isLoading, isFetching } = useRetrieveUserQuery();
  const router = useRouter();

  if (isLoading || isFetching) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  const userConfig = [
    { label: 'First Name', value: user?.first_name },
    { label: 'Last Name', value: user?.last_name },
    { label: 'Email', value: user?.email },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </header>
      
      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <List config={userConfig} />
        <button
          onClick={() => router.push('/projects')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Projects
        </button>
      </div>
      
      {user?.id && <WorklogForm userId={user.id} />}
    </div>
  );
}