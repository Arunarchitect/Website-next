// components/QuizHeader.tsx
interface QuizHeaderProps {
  currentQuestion: number;
  totalQuestions: number;
  onQuit: () => void;
  userName?: string; // Make it optional
}

export default function QuizHeader({ 
  currentQuestion, 
  totalQuestions, 
  onQuit,
  userName 
}: QuizHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        {userName && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Welcome, {userName}
          </p>
        )}
        <h2 className="text-xl font-bold dark:text-white">
          Question {currentQuestion} of {totalQuestions}
        </h2>
      </div>
      <button
        onClick={onQuit}
        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
      >
        Quit Quiz
      </button>
    </div>
  );
}