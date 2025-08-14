// app/tools/quiz/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLazyGetQuizQuestionsQuery, useEvaluateQuizMutation } from '@/redux/features/quizApiSlice';
import { useRetrieveUserQuery } from '@/redux/features/authApiSlice';
import { Spinner } from '@/components/common';
import { useQuiz } from './hooks/useQuiz';
import { useTimer } from './hooks/useTimer';
import type { QuizParams, QuizQuestion, QuizScore } from './types/quizTypes';
import QuizHeader from './components/QuizHeader';
import QuizSettings from './components/QuizSettings';
import QuestionCard from './components/QuestionCard';
import ScoreDisplay from './components/ScoreDisplay';
import ErrorDisplay from './components/ErrorDisplay';
import { formatTime } from './utils/quizUtils';

const DEFAULT_QUIZ_PARAMS: QuizParams = {
  count: 7,
  exam: undefined,
  category: undefined
};

export default function QuizPage() {
  // User authentication
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useRetrieveUserQuery();

  // Quiz state management
  const [
    getQuizQuestions,
    { 
      data: questions = [], 
      isLoading: isQuizLoading, 
      isError: isQuizError, 
      refetch 
    }
  ] = useLazyGetQuizQuestionsQuery();

  const [evaluateQuiz, { isLoading: isEvaluationLoading }] = useEvaluateQuizMutation();

  const {
    answers,
    score,
    quizParams,
    shuffledQuestions,
    setScore,
    handleAnswerChange,
    handleParamChange,
    resetQuiz
  } = useQuiz(questions);

  const [quizStarted, setQuizStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!quizStarted) return;

    try {
      const answersPayload = Object.entries(answers).reduce((acc, [qid, answer]) => {
        acc[`question_${qid}`] = answer;
        return acc;
      }, {} as Record<string, string>);

      const result = await evaluateQuiz(answersPayload).unwrap();

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
      } as QuizScore);
    } catch (error) {
      console.error("Evaluation error:", error);
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
      } as QuizScore);
    }

    setQuizStarted(false);
    setSubmitted(true);
  }, [answers, quizStarted, shuffledQuestions, evaluateQuiz, setScore]);

  const { timeLeft, resetTimer } = useTimer(0, handleSubmit);

  useEffect(() => {
    if (questions.length > 0 && quizStarted) {
      resetTimer(questions.length * 30);
    }
  }, [questions, quizStarted, resetTimer]);

  const handleStartQuiz = async () => {
    try {
      await getQuizQuestions(quizParams).unwrap();
      setQuizStarted(true);
      setSubmitted(false);
      resetQuiz();
    } catch (error) {
      console.error("Error starting quiz:", error);
    }
  };

  const handleReload = async () => {
    try {
      await refetch();
      resetQuiz();
      setQuizStarted(false);
      setSubmitted(false);
    } catch (error) {
      console.error("Error reloading quiz:", error);
    }
  };

  // Loading state
  if (isUserLoading || isQuizLoading || isEvaluationLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  // Error states
  if (isUserError) return <ErrorDisplay title="Authentication Required" message="Please login to access the quiz" />;
  if (!user || ![1, 2].includes(user.id)) return <ErrorDisplay title="Access Restricted" message="You don't have access to this feature" />;
  if (isQuizError) return <ErrorDisplay title="Error loading questions" action={<button onClick={handleReload}>Try Again</button>} />;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Suspense fallback={<Spinner />}>
        <QuizHeader 
          userName={user?.first_name} 
          timeLeft={quizStarted ? timeLeft : undefined} 
          onReload={handleReload} 
        />
        
        {score && <ScoreDisplay score={score} />}

        {!quizStarted && !submitted ? (
          <QuizSettings 
            params={quizParams}
            onParamChange={handleParamChange}
            onStart={handleStartQuiz}
          />
        ) : shuffledQuestions.length === 0 ? (
          <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
            <p>No questions available. Please try reloading.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {shuffledQuestions.map((q: QuizQuestion, index: number) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={index}
                answer={answers[q.id]}
                showResult={score !== null}
                onChange={(value) => handleAnswerChange(q.id, value)}
              />
            ))}

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
      </Suspense>
    </div>
  );
}