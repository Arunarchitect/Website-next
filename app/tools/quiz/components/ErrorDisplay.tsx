// app/tools/quiz/components/ErrorDisplay.tsx
'use client';

import { ReactNode } from 'react';

interface ErrorDisplayProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

export default function ErrorDisplay({ title, message, action }: ErrorDisplayProps) {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {title}
        </h1>
        {message && (
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            {message}
          </p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}