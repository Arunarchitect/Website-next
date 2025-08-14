// app/tools/quiz/components/QuizSettings.tsx
'use client'; // Add this if not present
import { QuizParams } from '../types/quiztypes';
import { formatTime } from '../utils/quizUtils'; // Add this import

interface QuizSettingsProps {
  params: QuizParams;
  onParamChange: (key: keyof QuizParams, value: number | undefined) => void;
  onStart: () => void;
}

export default function QuizSettings({ params, onParamChange, onStart }: QuizSettingsProps) {
  return (
    <div className="text-center py-10">
      <h2 className="text-xl font-bold mb-4">Quiz Settings</h2>
      
      <div className="mb-6 max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Number of Questions:
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={params.count}
            onChange={(e) => onParamChange('count', parseInt(e.target.value) || 7)}
            className="w-20 px-3 py-2 border rounded-md"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Exam (optional):
          </label>
          <input
            type="number"
            min="1"
            value={params.exam || ''}
            onChange={(e) => onParamChange('exam', parseInt(e.target.value) || undefined)}
            className="w-20 px-3 py-2 border rounded-md"
            placeholder="Exam ID"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category (optional):
          </label>
          <input
            type="number"
            min="1"
            value={params.category || ''}
            onChange={(e) => onParamChange('category', parseInt(e.target.value) || undefined)}
            className="w-20 px-3 py-2 border rounded-md"
            placeholder="Category ID"
          />
        </div>
      </div>

      <p className="mb-6">
        You`&apos`ll have {formatTime(params.count * 30)} ({params.count} questions × 30 seconds each)
      </p>
      <button
        onClick={onStart}
        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors dark:bg-green-700 dark:hover:bg-green-800 text-lg"
      >
        Start Quiz
      </button>
    </div>
  );
}