// app/tools/quiz/components/ScoreDisplay.tsx
'use client';

import type { QuizScore } from "../types/quizTypes";

interface ScoreDisplayProps {
  score: QuizScore;
}

// Changed from named export to default export
export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div className="mt-4 w-full grid grid-cols-4 gap-2 sm:gap-3">
      <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900 rounded-md text-gray-800 dark:text-white text-center">
        <div className="font-bold text-xs sm:text-sm">Net Score</div>
        <div className="text-sm sm:text-base">
          {score.netScore.toFixed(2)}/{score.total}
        </div>
        <div className="text-xs">({score.percentage.toFixed(2)}%)</div>
      </div>
      <div className="px-3 py-2 bg-green-100 dark:bg-green-900 rounded-md text-gray-800 dark:text-white text-center">
        <div className="font-bold text-xs sm:text-sm">Correct</div>
        <div className="text-sm sm:text-base">{score.correct}</div>
      </div>
      <div className="px-3 py-2 bg-red-100 dark:bg-red-900 rounded-md text-gray-800 dark:text-white text-center">
        <div className="font-bold text-xs sm:text-sm">Wrong</div>
        <div className="text-sm sm:text-base">{score.wrong}</div>
        <div className="text-xs">(-{score.wrong}/3)</div>
      </div>
      <div className="px-3 py-2 bg-yellow-100 dark:bg-yellow-900 rounded-md text-gray-800 dark:text-white text-center">
        <div className="font-bold text-xs sm:text-sm">Unanswered</div>
        <div className="text-sm sm:text-base">{score.unanswered}</div>
      </div>
    </div>
  );
}