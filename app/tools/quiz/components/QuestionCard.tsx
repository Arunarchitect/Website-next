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
  // Include all four options (three regular + correct option)
  const options = [
    { id: 'option_1', value: question.option_1 },
    { id: 'option_2', value: question.option_2 },
    { id: 'option_3', value: question.option_3 },
    { id: 'correct_option', value: question.correct_option }
  ];

  // Remove duplicate options (in case correct_option matches one of the others)
  const uniqueOptions = options.filter(
    (option, index, self) => 
      index === self.findIndex((o) => o.value === option.value)
  );

  const getOptionClass = (option: string) => {
    if (!showResult) {
      return selectedAnswer === option 
        ? 'bg-blue-100 border-blue-500' 
        : 'hover:bg-gray-50';
    }

    if (option === correctAnswer) {
      return 'bg-green-100 border-green-500';
    }
    if (selectedAnswer === option && option !== correctAnswer) {
      return 'bg-red-100 border-red-500';
    }
    return '';
  };

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-medium mb-3">{question.question_text}</h3>
      <div className="space-y-2">
        {uniqueOptions.map((opt) => (
          <div
            key={opt.id}
            onClick={() => !showResult && onAnswerSelect(opt.value)}
            className={`p-3 border rounded cursor-pointer ${getOptionClass(opt.value)}`}
          >
            {opt.value}
          </div>
        ))}
      </div>
      {showResult && question.explanation && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
          <p className="font-medium">Explanation:</p>
          <p>{question.explanation}</p>
        </div>
      )}
    </div>
  );
}