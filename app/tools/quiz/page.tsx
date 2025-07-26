"use client";

import { useState } from "react";
import { useGetQuizQuestionsQuery } from "@/redux/features/quizApiSlice";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import { Spinner } from "@/components/common";

interface Question {
  id: number;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  correct_option: string;
  explanation?: string;
}

export default function QuizPage() {
  // Fetch user data first
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useRetrieveUserQuery();

  const {
    data: questions = [] as Question[],
    isLoading: isQuizLoading,
    isError: isQuizError,
    refetch,
  } = useGetQuizQuestionsQuery(undefined, { skip: !user });

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<{
    correct: number;
    wrong: number;
    unanswered: number;
    total: number;
    percentage: number;
    netScore: number;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const correctAnswers = questions.filter(
      (q) => answers[q.id] === q.correct_option
    ).length;
    
    const wrongAnswers = questions.filter(
      (q) => answers[q.id] && answers[q.id] !== q.correct_option
    ).length;

    const unanswered = questions.length - correctAnswers - wrongAnswers;
    
    // PSC style negative marking (1/3 deduction for wrong answers)
    const netScore = correctAnswers - (wrongAnswers / 3);
    const percentage = (netScore / questions.length) * 100;

    setScore({
      correct: correctAnswers,
      wrong: wrongAnswers,
      unanswered,
      total: questions.length,
      percentage,
      netScore
    });
  };

  const handleAnswerChange = (qid: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleReload = async () => {
    try {
      await refetch();
      setAnswers({});
      setScore(null);
    } catch (error) {
      console.error("Error reloading quiz:", error);
    }
  };

  // Combined loading states
  if (isUserLoading || isQuizLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  // Handle authentication errors
  if (isUserError) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Authentication Required
        </h1>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Please login to access the quiz
        </p>
      </div>
    );
  }

  // Handle quiz loading errors
  if (isQuizError) {
    return (
      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Error loading questions
        </h1>
        <button
          onClick={handleReload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user ? `Welcome, ${user.first_name}` : "OMR Quiz"}
        </h1>
        <div className="flex gap-4">
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-800 dark:text-white"
          >
            Reload Quiz
          </button>
          {score !== null && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 rounded-md text-gray-800 dark:text-white text-center">
                <div className="font-bold text-sm">Net Score</div>
                <div>{score.netScore.toFixed(2)}/{score.total}</div>
                <div className="text-xs">({score.percentage.toFixed(2)}%)</div>
              </div>
              <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900 rounded-md text-gray-800 dark:text-white text-center">
                <div className="font-bold text-sm">Correct</div>
                <div>{score.correct}</div>
              </div>
              <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900 rounded-md text-gray-800 dark:text-white text-center">
                <div className="font-bold text-sm">Wrong</div>
                <div>{score.wrong}</div>
                <div className="text-xs">(-{score.wrong}/3)</div>
              </div>
              <div className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900 rounded-md text-gray-800 dark:text-white text-center">
                <div className="font-bold text-sm">Unanswered</div>
                <div>{score.unanswered}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quiz Content */}
      {questions.length === 0 ? (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center text-gray-800 dark:text-gray-200">
          <p>No questions available. Please try reloading.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q, index) => {
            const options = [
              q.option_1,
              q.option_2,
              q.option_3,
              q.correct_option,
            ].filter(Boolean) as string[];

            const questionFeedback =
              score !== null
                ? {
                    isCorrect: answers[q.id] === q.correct_option,
                    explanation: q.explanation || "No explanation provided.",
                  }
                : null;

            return (
              <div
                key={q.id}
                className={`p-4 border rounded-lg transition-colors ${
                  questionFeedback
                    ? questionFeedback.isCorrect
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                }`}
              >
                <p className="font-bold text-lg mb-3 text-gray-900 dark:text-white">
                  Q{index + 1}: {q.question_text}
                </p>

                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <label
                      key={i}
                      className="flex items-center space-x-3 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`question_${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => handleAnswerChange(q.id, opt)}
                        disabled={score !== null}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
                      />
                      <span
                        className={`flex-1 ${
                          score !== null
                            ? ""
                            : "text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {opt}
                        {questionFeedback && q.correct_option === opt && (
                          <span className="ml-2 text-green-600 dark:text-green-400">
                            ✓ Correct
                          </span>
                        )}
                        {questionFeedback &&
                          answers[q.id] === opt &&
                          !questionFeedback.isCorrect && (
                            <span className="ml-2 text-red-600 dark:text-red-400">
                              ✗ Your Answer
                            </span>
                          )}
                      </span>
                    </label>
                  ))}
                </div>

                {questionFeedback && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded text-sm text-gray-800 dark:text-gray-200">
                    <p className="font-medium">Explanation:</p>
                    <p>{questionFeedback.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}

          {questions.length > 0 && score === null && (
            <div className="text-center pt-4">
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Submit Quiz
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}