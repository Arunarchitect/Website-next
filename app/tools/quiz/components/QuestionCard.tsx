// components/QuestionCard.tsx
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
  const options = [
    { id: 'option_1', value: question.option_1 },
    { id: 'option_2', value: question.option_2 },
    { id: 'option_3', value: question.option_3 },
    { id: 'correct_option', value: question.correct_option }
  ];

  const uniqueOptions = options.filter(
    (option, index, self) => 
      index === self.findIndex((o) => o.value === option.value)
  );

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
        {uniqueOptions.map((opt) => (
          <div
            key={opt.id}
            onClick={() => !showResult && onAnswerSelect(opt.value)}
            className={`p-3 border rounded cursor-pointer transition-colors ${
              !showResult ? 'text-gray-900 dark:text-white' : ''
            } ${getOptionClass(opt.value)}`}
          >
            {opt.value}
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