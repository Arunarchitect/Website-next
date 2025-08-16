// pages/QuizPage.tsx
"use client";

import { useState, useEffect } from "react";
import { useGetExamsQuery } from "@/redux/features/quizApiSlice";
import QuizSettings from "./components/QuizSettings";
import QuestionCard from "./components/QuestionCard";
import ScoreDisplay from "./components/ScoreDisplay";
import ErrorDisplay from "./components/ErrorDisplay";
import QuizHeader from "./components/QuizHeader";
import { useQuiz } from "./hooks/useQuiz";

export default function QuizPage() {
  const { data: exams = [] } = useGetExamsQuery();
  const {
    questions,
    answers,
    results,
    error,
    categories,
    isQuestionsLoading,
    isEvaluationLoading,
    isCategoriesLoading,
    fetchQuestions,
    submitAnswers,
    handleAnswerSelect,
    resetQuiz,
    quizState,
    currentExam,
    currentCategory,
    handleExamChange, // Make sure to destructure this from useQuiz
  } = useQuiz();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    if (questions.length > 0) {
      setCurrentQuestionIndex(0);
    }
  }, [questions]);

  const handleStartQuiz = (params: { count: number; exam?: number; category?: number }) => {
    fetchQuestions(params);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = () => {
    submitAnswers();
  };

  const handleQuitQuiz = () => {
    resetQuiz();
  };

  const handleRetry = () => {
    resetQuiz();
  };

  if (quizState === "settings") {
    return (
      <div className="max-w-md mx-auto mt-10">
        {error && <ErrorDisplay error={error} onRetry={handleRetry} />}
        <QuizSettings
          exams={exams}
          categories={categories}
          onStartQuiz={handleStartQuiz}
          isLoading={isQuestionsLoading}
          isCategoriesLoading={isCategoriesLoading}
          currentExam={currentExam}
          currentCategory={currentCategory}
          handleExamChange={handleExamChange} // Pass the function here
        />
      </div>
    );
  }

  if (quizState === "results" && results) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <ScoreDisplay
          results={results}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <ErrorDisplay error="No questions available. Please try different settings." />
        <button
          onClick={handleQuitQuiz}
          className="mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Back to Settings
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = answers[`question_${currentQuestion.id}`] || null;

  return (
    <div className="max-w-2xl mx-auto mt-6 p-4">
      <QuizHeader
        currentQuestion={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        onQuit={handleQuitQuiz}
      />

      <QuestionCard
        question={currentQuestion}
        selectedAnswer={selectedAnswer}
        onAnswerSelect={(option) => handleAnswerSelect(currentQuestion.id, option)}
      />

      <div className="flex justify-between mt-6">
        <button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>

        {currentQuestionIndex < questions.length - 1 ? (
          <button
            onClick={handleNextQuestion}
            disabled={!selectedAnswer}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmitQuiz}
            disabled={!selectedAnswer || isEvaluationLoading}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {isEvaluationLoading ? "Submitting..." : "Submit Quiz"}
          </button>
        )}
      </div>
    </div>
  );
}