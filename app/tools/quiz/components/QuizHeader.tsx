// app/tools/quiz/components/QuizHeader.tsx
'use client';

import { formatTime } from '../utils/quizUtils';

interface QuizHeaderProps {
  userName?: string;
  timeLeft?: number;
  onReload: () => void;
}

export default function QuizHeader({ userName, timeLeft, onReload }: QuizHeaderProps) {
  return (
    <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {userName ? `Welcome, ${userName}` : "Quiz App"}
      </h1>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {timeLeft !== undefined && (
          <div className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded-md text-red-800 dark:text-red-200 font-medium">
            Time Left: {formatTime(timeLeft)}
          </div>
        )}
        <button
          onClick={onReload}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-800 dark:text-white"
        >
          Reload Quiz
        </button>
      </div>
    </div>
  );
}