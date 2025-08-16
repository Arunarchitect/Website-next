interface QuizHeaderProps {
  currentQuestion: number;
  totalQuestions: number;
  onQuit: () => void;
}

export default function QuizHeader({ currentQuestion, totalQuestions, onQuit }: QuizHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold">
        Question {currentQuestion} of {totalQuestions}
      </h2>
      <button
        onClick={onQuit}
        className="text-red-600 hover:text-red-800 text-sm font-medium"
      >
        Quit Quiz
      </button>
    </div>
  );
}