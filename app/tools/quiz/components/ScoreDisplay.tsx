// components/ScoreDisplay.tsx
import { QuizEvaluation, QuestionExplanation } from '../types/quiztypes';

interface ScoreDisplayProps {
  results: QuizEvaluation;
  onRetry: () => void;
  averageScore?: number;
  onViewDetails: () => void;
}

export default function ScoreDisplay({ 
  results, 
  onRetry,
  averageScore,
  onViewDetails 
}: ScoreDisplayProps) {
  const actualScore = results.rawScore ?? results.score;
  const actualPercentage = results.percentage ?? results.percentage;
  const displayScore = results.displayScore ?? Math.max(0, actualScore);
  const displayPercentage = results.displayPercentage ?? Math.max(0, actualPercentage);

  const scoreColor = actualPercentage >= 70 ? 'text-green-600 dark:text-green-400' : 
                   actualPercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
                   actualPercentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-red-800 dark:text-red-500';

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Quiz Results</h2>
        
        {actualPercentage < 0 ? (
          <div className="text-red-800 dark:text-red-500 text-4xl font-bold mb-1">
            0% (Negative Score: {actualPercentage.toFixed(2)}%)
          </div>
        ) : (
          <div className={`text-5xl font-bold mb-1 ${scoreColor}`}>
            {displayPercentage.toFixed(2)}%
          </div>
        )}

        {averageScore !== undefined && (
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Your Current Score: {displayPercentage.toFixed(2)}% | Average Performance: {averageScore.toFixed(2)}%
          </p>
        )}

        <p className="text-gray-600 dark:text-gray-300">
          {displayScore.toFixed(2)} / {results.total} points
          {actualScore < 0 && (
            <span className="block text-red-800 dark:text-red-500 text-sm mt-1">
              (Actual Score: {actualScore.toFixed(2)})
            </span>
          )}
        </p>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Scoring: +1 for correct, -0.33 for wrong answers
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 dark:text-white">Question Review</h3>
        <div className="space-y-4">
          {results.explanations.map((item: QuestionExplanation, index: number) => (
            <div key={item.id} className="p-4 border rounded-lg dark:border-gray-700 dark:bg-gray-700">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium dark:text-gray-200">Q{index + 1}: {item.question}</span>
                {item.is_correct ? (
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded">
                    Correct
                  </span>
                ) : (
                  <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-2 py-1 rounded">
                    Incorrect
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Your answer:</p>
                  <p className={`font-medium ${
                    !item.is_correct ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {item.selected}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Correct answer:</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{item.correct}</p>
                </div>
              </div>

              {item.explanation && (
                <div className="mt-3 pt-3 border-t dark:border-gray-600 text-sm">
                  <p className="text-gray-500 dark:text-gray-400">Explanation:</p>
                  <p className="dark:text-gray-300">{item.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          Try Again
        </button>
        <button
          onClick={onViewDetails}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-6 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white"
        >
          View Details & History
        </button>
      </div>
    </div>
  );
}