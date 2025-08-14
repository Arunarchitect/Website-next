// app/tools/quiz/components/QuestionCard.tsx
'use client';

import type { QuizQuestion } from '../types/quizTypes';

interface QuestionCardProps {
  question: QuizQuestion;
  index: number;
  answer?: string;
  showResult: boolean;
  onChange: (value: string) => void;
}

export default function QuestionCard({
  question,
  index,
  answer,
  showResult,
  onChange,
}: QuestionCardProps) {
  const questionExplanation = showResult
    ? question.explanation || 'No explanation available'
    : null;

  const isCorrect = showResult && answer === question.correct_option;

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        showResult
          ? isCorrect
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <p className="font-bold text-lg mb-3 text-gray-900 dark:text-white">
        Q{index + 1}: {question.question_text}
      </p>

      <div className="space-y-2">
        {question.shuffledOptions.map((option, i) => (
          <label key={i} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name={`question_${question.id}`}
              value={option}
              checked={answer === option}
              onChange={() => onChange(option)}
              disabled={showResult}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
            />
            <span className="flex-1 text-gray-800 dark:text-gray-200">
              {option}
              {showResult && question.correct_option === option && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  ✓ Correct
                </span>
              )}
              {showResult &&
                answer === option &&
                answer !== question.correct_option && (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    ✗ Your Answer
                  </span>
                )}
            </span>
          </label>
        ))}
      </div>

      {showResult && questionExplanation && (
        <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded text-sm text-gray-800 dark:text-gray-200">
          <p className="font-medium">Explanation:</p>
          <p>{questionExplanation}</p>
        </div>
      )}
    </div>
  );
}