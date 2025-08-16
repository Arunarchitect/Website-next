import { QuizEvaluation, QuestionExplanation } from '../types/quiztypes';

interface ScoreDisplayProps {
  results: QuizEvaluation;
  onRetry: () => void;
}

export default function ScoreDisplay({ results, onRetry }: ScoreDisplayProps) {
  const actualScore = results.rawScore ?? results.score;
  const actualPercentage = results.percentage ?? results.percentage;
  const displayScore = results.displayScore ?? Math.max(0, actualScore);
  const displayPercentage = results.displayPercentage ?? Math.max(0, actualPercentage);

  const scoreColor = actualPercentage >= 70 ? 'text-green-600' : 
                   actualPercentage >= 50 ? 'text-yellow-600' : 
                   actualPercentage >= 0 ? 'text-red-600' : 'text-red-800';

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Quiz Results</h2>
        
        {actualPercentage < 0 ? (
          <div className="text-red-800 text-4xl font-bold mb-1">
            0% (Negative Score: {actualPercentage.toFixed(2)}%)
          </div>
        ) : (
          <div className={`text-5xl font-bold mb-1 ${scoreColor}`}>
            {displayPercentage.toFixed(2)}%
          </div>
        )}

        <p className="text-gray-600">
          {displayScore.toFixed(2)} / {results.total} points
          {actualScore < 0 && (
            <span className="block text-red-800 text-sm mt-1">
              (Actual Score: {actualScore.toFixed(2)})
            </span>
          )}
        </p>
        
        <p className="text-sm text-gray-500 mt-2">
          Scoring: +1 for correct, -0.33 for wrong answers
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Question Review</h3>
        <div className="space-y-4">
          {results.explanations.map((item: QuestionExplanation, index: number) => (
            <div key={item.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">Q{index + 1}: {item.question}</span>
                {item.is_correct ? (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    Correct
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    Incorrect
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Your answer:</p>
                  <p className={`font-medium ${
                    !item.is_correct ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {item.selected}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Correct answer:</p>
                  <p className="font-medium text-green-600">{item.correct}</p>
                </div>
              </div>

              {item.explanation && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <p className="text-gray-500">Explanation:</p>
                  <p>{item.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onRetry}
          className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}