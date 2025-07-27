"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

interface QuizQuestion extends Question {
  shuffledOptions: string[];
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
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle questions only once when questions change
  const shuffledQuestions = useMemo<QuizQuestion[]>(() => {
    if (!questions.length) return [];
    
    return questions.map((q: Question) => {
      const allOptions = [
        q.option_1,
        q.option_2,
        q.option_3,
        q.correct_option
      ].filter(Boolean) as string[];
      
      // Fisher-Yates shuffle algorithm
      const shuffledOptions = [...allOptions];
      for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
      }

      return {
        ...q,
        shuffledOptions
      };
    });
  }, [questions]); // Removed unnecessary quizStarted dependency

  // Memoize handleSubmit to prevent recreation on every render
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();

    if (!quizStarted) return;

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const correctAnswers = shuffledQuestions.filter(
      (q: QuizQuestion) => answers[q.id] === q.correct_option
    ).length;

    const wrongAnswers = shuffledQuestions.filter(
      (q: QuizQuestion) => answers[q.id] && answers[q.id] !== q.correct_option
    ).length;

    const unanswered = shuffledQuestions.length - correctAnswers - wrongAnswers;

    // PSC style negative marking (1/3 deduction for wrong answers)
    const netScore = correctAnswers - wrongAnswers / 3;
    const percentage = (netScore / shuffledQuestions.length) * 100;

    setScore({
      correct: correctAnswers,
      wrong: wrongAnswers,
      unanswered,
      total: shuffledQuestions.length,
      percentage,
      netScore,
    });

    setQuizStarted(false);
  }, [answers, quizStarted, shuffledQuestions]);

  // Calculate total time needed (30 seconds per question)
  useEffect(() => {
    if (questions.length > 0) {
      setTotalTime(questions.length * 30);
    }
  }, [questions]);

  // Timer effect
  useEffect(() => {
    if (quizStarted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && quizStarted) {
      handleSubmit(); // Auto-submit when time runs out
      setQuizStarted(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizStarted, timeLeft, handleSubmit]); // Added handleSubmit to dependencies

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
    setTimeLeft(totalTime);
    setAnswers({});
    setScore(null);
  };

  const handleAnswerChange = (qid: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleReload = async () => {
    try {
      await refetch();
      setAnswers({});
      setScore(null);
      setQuizStarted(false);
      setTimeLeft(0);
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

  // Check if user has access (user_id 1 or 2)
  const hasAccess = user && [1, 2].includes(user.id);

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow">
          <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Access Restricted
          </h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            You have limited access to this feature.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Please contact support if you believe this is an error.
          </p>
        </div>
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
      {/* Header Section - Stacked on mobile */}
      <div className="mb-6">
        <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user ? `Welcome, ${user.first_name}` : "OMR Quiz"}
          </h1>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {quizStarted && (
              <div className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded-md text-red-800 dark:text-red-200 font-medium">
                Time Left: {formatTime(timeLeft)}
              </div>
            )}
            <button
              onClick={handleReload}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-800 dark:text-white"
            >
              Reload Quiz
            </button>
          </div>
        </div>

        {/* Score cards - full width below welcome on mobile */}
        {score !== null && (
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
        )}
      </div>

      {/* Quiz Content */}
      {shuffledQuestions.length === 0 ? (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center text-gray-800 dark:text-gray-200">
          <p>No questions available. Please try reloading.</p>
        </div>
      ) : !quizStarted && score === null ? (
        <div className="text-center py-10">
          <h2 className="text-xl font-bold mb-4">Ready to Start the Quiz?</h2>
          <p className="mb-6">
            You`&apos;`ll have {formatTime(totalTime)} ({shuffledQuestions.length} questions × 30 seconds each) to complete the quiz.
          </p>
          <button
            onClick={handleStartQuiz}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors dark:bg-green-700 dark:hover:bg-green-800 text-lg"
          >
            Start Quiz
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {shuffledQuestions.map((q: QuizQuestion, index: number) => {
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
                  {q.shuffledOptions.map((opt: string, i: number) => (
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

          {quizStarted && (
            <div className="flex justify-between items-center pt-4">
              <div className="text-red-600 dark:text-red-400 font-medium">
                Time Remaining: {formatTime(timeLeft)}
              </div>
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