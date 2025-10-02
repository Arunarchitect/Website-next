// components/QuestionCard.tsx
import { useMemo } from 'react';
import { Question } from '../types/quiztypes';

interface QuestionCardProps {
  question: Question;
  selectedAnswer: string | null;
  onAnswerSelect: (option: string) => void;
  showResult?: boolean;
  correctAnswer?: string;
}

export default function QuestionCard({
  question,
  selectedAnswer,
  onAnswerSelect,
  showResult = false,
  correctAnswer
}: QuestionCardProps) {

  // Shuffle and deduplicate options only once per question render
  const shuffledOptions = useMemo(() => {
    const rawOptions = [
      question.option_1,
      question.option_2,
      question.option_3,
      question.correct_option,
    ];

    // Remove duplicates
    const uniqueOptions = Array.from(new Set(rawOptions));

    // Fisher-Yates shuffle
    for (let i = uniqueOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
    }

    return uniqueOptions;
  }, [question]);

  const getOptionClass = (option: string) => {
    if (!showResult) {
      return selectedAnswer === option 
        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400' 
        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600';
    }

    if (option === correctAnswer) {
      return 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-400';
    }
    if (selectedAnswer === option && option !== correctAnswer) {
      return 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-400';
    }
    return 'border-gray-200 dark:border-gray-600';
  };

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">
        {question.question_text}
      </h3>
      <div className="space-y-2">
        {shuffledOptions.map((option, index) => (
          <div
            key={index}
            onClick={() => !showResult && onAnswerSelect(option)}
            className={`p-3 border rounded cursor-pointer transition-colors ${
              !showResult ? 'text-gray-900 dark:text-white' : ''
            } ${getOptionClass(option)}`}
          >
            {option}
          </div>
        ))}
      </div>
      {showResult && question.explanation && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
          <p className="font-medium text-gray-900 dark:text-white">Explanation:</p>
          <p className="text-gray-700 dark:text-gray-300">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
