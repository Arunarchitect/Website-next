"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLazyGetQuizQuestionsQuery, useEvaluateQuizMutation } from "@/redux/features/quizApiSlice";
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
  exam?: number;
  category?: number;
}

interface QuizQuestion extends Question {
  shuffledOptions: string[];
}

interface QuizParams {
  count: number;
  exam?: number;
  category?: number;
}

export default function QuizPage() {
  // User authentication
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useRetrieveUserQuery();

  // Quiz questions
  const [
    getQuizQuestions,
    { 
      data: questions = [], 
      isLoading: isQuizLoading, 
      isError: isQuizError, 
      refetch 
    }
  ] = useLazyGetQuizQuestionsQuery();

  // Quiz evaluation
  const [evaluateQuiz, { isLoading: isEvaluationLoading }] = useEvaluateQuizMutation();

  // Component state
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<{
    correct: number;
    wrong: number;
    unanswered: number;
    total: number;
    percentage: number;
    netScore: number;
    explanations: Array<{
      id: number;
      question: string;
      selected: string;
      correct: string;
      explanation: string;
      is_correct: boolean;
    }>;
  } | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [quizParams, setQuizParams] = useState<QuizParams>({
    count: 7,
    exam: undefined,
    category: undefined
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle questions and options
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
  }, [questions]);

  // Handle quiz submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!quizStarted) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      // Format answers for backend
      const answersPayload = Object.entries(answers).reduce((acc, [qid, answer]) => {
        acc[`question_${qid}`] = answer;
        return acc;
      }, {} as Record<string, string>);

      // Evaluate with backend
      const result = await evaluateQuiz(answersPayload).unwrap();

      // Calculate score
      const correctAnswers = result.score;
      const wrongAnswers = result.total - correctAnswers;
      const unanswered = shuffledQuestions.length - Object.keys(answers).length;
      const netScore = correctAnswers - wrongAnswers / 3;

      setScore({
        correct: correctAnswers,
        wrong: wrongAnswers,
        unanswered,
        total: result.total,
        percentage: result.percentage,
        netScore,
        explanations: result.explanations
      });
    } catch (error) {
      console.error("Evaluation error:", error);
      // Fallback to client-side evaluation
      const correctAnswers = shuffledQuestions.filter(
        (q) => answers[q.id] === q.correct_option
      ).length;
      const wrongAnswers = shuffledQuestions.filter(
        (q) => answers[q.id] && answers[q.id] !== q.correct_option
      ).length;
      const unanswered = shuffledQuestions.length - correctAnswers - wrongAnswers;
      const netScore = correctAnswers - wrongAnswers / 3;
      const percentage = (netScore / shuffledQuestions.length) * 100;

      setScore({
        correct: correctAnswers,
        wrong: wrongAnswers,
        unanswered,
        total: shuffledQuestions.length,
        percentage,
        netScore,
        explanations: shuffledQuestions.map(q => ({
          id: q.id,
          question: q.question_text,
          selected: answers[q.id] || '',
          correct: q.correct_option,
          explanation: q.explanation || 'No explanation available',
          is_correct: answers[q.id] === q.correct_option
        }))
      });
    }

    setQuizStarted(false);
  }, [answers, quizStarted, shuffledQuestions, evaluateQuiz]);

  // Set total time when questions load
  useEffect(() => {
    if (questions.length > 0) {
      setTotalTime(questions.length * 30);
    }
  }, [questions]);

  // Timer logic
  useEffect(() => {
    if (quizStarted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && quizStarted) {
      handleSubmit();
      setQuizStarted(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizStarted, timeLeft, handleSubmit]);

  // Helper functions
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStartQuiz = async () => {
    try {
      await getQuizQuestions({
        count: quizParams.count,
        exam: quizParams.exam,
        category: quizParams.category
      }).unwrap();
      
      setQuizStarted(true);
      setTimeLeft(quizParams.count * 30);
      setAnswers({});
      setScore(null);
    } catch (error) {
      console.error("Error starting quiz:", error);
    }
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

  const handleParamChange = (key: keyof QuizParams, value: number | undefined) => {
    setQuizParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Loading states
  if (isUserLoading || isQuizLoading || isEvaluationLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  // Authentication error
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

  // Access control
  const hasAccess = user && [1, 2].includes(user.id);
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow">
          <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Access Restricted
          </h1>
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            You don't have access to this feature
          </p>
        </div>
      </div>
    );
  }

  // Quiz error
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user ? `Welcome, ${user.first_name}` : "Quiz App"}
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

        {/* Score display */}
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

      {/* Quiz content */}
      {!quizStarted && score === null ? (
        <div className="text-center py-10">
          <h2 className="text-xl font-bold mb-4">Quiz Settings</h2>
          
          <div className="mb-6 max-w-md mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Number of Questions:
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={quizParams.count}
                onChange={(e) => handleParamChange('count', parseInt(e.target.value) || 7)}
                className="w-20 px-3 py-2 border rounded-md"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Exam (optional):
              </label>
              <input
                type="number"
                min="1"
                value={quizParams.exam || ''}
                onChange={(e) => handleParamChange('exam', parseInt(e.target.value) || undefined)}
                className="w-20 px-3 py-2 border rounded-md"
                placeholder="Exam ID"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Category (optional):
              </label>
              <input
                type="number"
                min="1"
                value={quizParams.category || ''}
                onChange={(e) => handleParamChange('category', parseInt(e.target.value) || undefined)}
                className="w-20 px-3 py-2 border rounded-md"
                placeholder="Category ID"
              />
            </div>
          </div>

          <p className="mb-6">
            You'll have {formatTime(quizParams.count * 30)} ({quizParams.count} questions × 30 seconds each)
          </p>
          <button
            onClick={handleStartQuiz}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors dark:bg-green-700 dark:hover:bg-green-800 text-lg"
          >
            Start Quiz
          </button>
        </div>
      ) : shuffledQuestions.length === 0 ? (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center text-gray-800 dark:text-gray-200">
          <p>No questions available. Please try reloading.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {shuffledQuestions.map((q: QuizQuestion, index: number) => {
            const questionExplanation = score?.explanations.find(exp => exp.id === q.id);
            const isAnswered = answers[q.id] !== undefined;
            const isCorrect = questionExplanation?.is_correct;

            return (
              <div
                key={q.id}
                className={`p-4 border rounded-lg transition-colors ${
                  score !== null
                    ? isCorrect
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
                      <span className="flex-1 text-gray-800 dark:text-gray-200">
                        {opt}
                        {score !== null && q.correct_option === opt && (
                          <span className="ml-2 text-green-600 dark:text-green-400">
                            ✓ Correct
                          </span>
                        )}
                        {score !== null &&
                          answers[q.id] === opt &&
                          !isCorrect && (
                            <span className="ml-2 text-red-600 dark:text-red-400">
                              ✗ Your Answer
                            </span>
                          )}
                      </span>
                    </label>
                  ))}
                </div>

                {score !== null && questionExplanation && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded text-sm text-gray-800 dark:text-gray-200">
                    <p className="font-medium">Explanation:</p>
                    <p>{questionExplanation.explanation}</p>
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