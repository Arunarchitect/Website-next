// components/QuestionsList.tsx
import { Question } from '../types/quiztypes';
import QuestionCard from './QuestionCard';

interface QuestionsListProps {
  questions: Question[];
  answers: Record<string, string>;
  showResults?: boolean;
  onAnswerSelect: (questionId: number, option: string) => void;
}

export default function QuestionsList({
  questions,
  answers,
  showResults = false,
  onAnswerSelect
}: QuestionsListProps) {
  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          selectedAnswer={answers[`question_${question.id}`] || null}
          onAnswerSelect={(option) => onAnswerSelect(question.id, option)}
          showResult={showResults}
          correctAnswer={question.correct_option}
        />
      ))}
    </div>
  );
}