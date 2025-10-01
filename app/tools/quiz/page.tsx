"use client";

import { useState, useEffect } from "react";
import { 
  useGetExamsQuery,
  useGetScoreStatsQuery,
  useGetScoresByExamQuery,
  useGetScoresByCategoryQuery,
  useLazyGetFilteredScoresQuery,
  useGetUserStatsQuery
} from "@/redux/features/quizApiSlice";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import QuizSettings from "./components/QuizSettings";
import QuestionsList from "./components/QuestionList";
import ScoreDisplay from "./components/ScoreDisplay";
import ErrorDisplay from "./components/ErrorDisplay";
import QuizHeader from "./components/QuizHeader";
import { useQuiz } from "./hooks/useQuiz";
import ScoreDetailsModal from "./components/ScoreDetailsModal";
import { ExtendedQuizParams } from "./types/quiztypes";

export default function QuizPage() {
  const { data: user, isLoading: userLoading, error: userError } = useRetrieveUserQuery();
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
    handleExamChange,
    metadata,
  } = useQuiz();

  const [questionsPerPage, setQuestionsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [shouldFetchStats, setShouldFetchStats] = useState(false);

  // Always fetch user stats - they're lightweight and cached
  const { 
    data: userStats, 
    isLoading: userStatsLoading, 
    error: userStatsError,
    refetch: refetchUserStats 
  } = useGetUserStatsQuery();

  const { 
    data: statsData, 
    isLoading: statsLoading,
    refetch: refetchScoreStats 
  } = useGetScoreStatsQuery();

  const { 
    data: examBreakdown = [], 
    isLoading: examBreakdownLoading,
    refetch: refetchExamBreakdown 
  } = useGetScoresByExamQuery();

  const { 
    data: categoryBreakdown = [], 
    isLoading: categoryBreakdownLoading,
    refetch: refetchCategoryBreakdown 
  } = useGetScoresByCategoryQuery();

  const [getFilteredScores, { 
    data: scoreHistory, 
    isLoading: historyLoading, 
    error: historyError
  }] = useLazyGetFilteredScoresQuery();

  useEffect(() => {
    if (questions && questions.length > 0) {
      setCurrentPage(1);
    }
  }, [questions]);

  // Trigger stats refresh when quiz is completed
  useEffect(() => {
    if (quizState === "results" && results) {
      setShouldFetchStats(true);
    }
  }, [quizState, results]);

  // Refetch stats when shouldFetchStats is true
  useEffect(() => {
    if (shouldFetchStats) {
      const refreshStats = async () => {
        try {
          await Promise.all([
            refetchUserStats(),
            refetchScoreStats(),
            refetchExamBreakdown(),
            refetchCategoryBreakdown()
          ]);
        } catch (err) {
          console.error("Failed to refresh stats:", err);
        } finally {
          setShouldFetchStats(false);
        }
      };
      
      refreshStats();
    }
  }, [shouldFetchStats, refetchUserStats, refetchScoreStats, refetchExamBreakdown, refetchCategoryBreakdown]);

  const handleViewHistory = async () => {
    try {
      // Only fetch filtered scores (the others are already being fetched)
      await getFilteredScores({});
      setShowScoreDetails(true);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleStartQuiz = (params: ExtendedQuizParams) => {
    fetchQuestions(params);
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

  const toggleScoreDetails = () => {
    if (!showScoreDetails) {
      handleViewHistory();
    } else {
      setShowScoreDetails(false);
    }
  };

  // Safe array handling with null checks
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const totalPages = Math.ceil(safeQuestions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const paginatedQuestions = safeQuestions.slice(startIndex, endIndex);

  // Combined loading state for history modal
  const isHistoryLoading = userStatsLoading || statsLoading || examBreakdownLoading || categoryBreakdownLoading || historyLoading;

  if (quizState === "settings") {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-6 lg:px-8 relative">
        {userLoading ? (
          <div className="flex items-center mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="animate-pulse rounded-full h-12 w-12 bg-gray-200 dark:bg-gray-600 mr-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
            </div>
          </div>
        ) : userError ? (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded">
            Error loading user profile
          </div>
        ) : user && (
          <div className="flex items-center mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold mr-4">
              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
            </div>
            <div>
              <h2 className="font-semibold dark:text-white">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
            </div>
            <button
              onClick={handleViewHistory}
              disabled={isHistoryLoading}
              className={`ml-auto bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 py-2 px-4 rounded-lg flex items-center ${
                isHistoryLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isHistoryLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-800 dark:text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  View History
                </>
              )}
            </button>
          </div>
        )}
        
        {error && <ErrorDisplay error={error} onRetry={handleRetry} />}
        <QuizSettings
          exams={exams}
          categories={categories}
          onStartQuiz={handleStartQuiz}
          isLoading={isQuestionsLoading}
          isCategoriesLoading={isCategoriesLoading}
          currentExam={currentExam}
          currentCategory={currentCategory}
          handleExamChange={handleExamChange}
        />

        {showScoreDetails && (
          <ScoreDetailsModal
            averageScore={userStats?.average_score || statsData?.average_score || 0}
            examBreakdown={examBreakdown}
            categoryBreakdown={categoryBreakdown}
            hasAttempts={userStats?.has_attempts || false}
            overallStats={userStats?.overall_stats}
            scoreHistory={scoreHistory?.results || []}
            historyLoading={isHistoryLoading}
            historyError={userStatsError || historyError}
            onClose={() => setShowScoreDetails(false)}
          />
        )}
      </div>
    );
  }

  if (isQuestionsLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4 sm:px-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          Preparing your quiz{user ? `, ${user.first_name}` : ''}...
        </p>
        <button 
          onClick={handleViewHistory}
          className="mt-4 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 py-2 px-4 rounded-lg transition-colors duration-200"
        >
          View History While Waiting
        </button>
      </div>
    );
  }

  if (quizState === "results" && results) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4 sm:px-6">
        <ScoreDisplay
          results={results}
          onRetry={handleRetry}
          averageScore={userStats?.average_score || statsData?.average_score || 0}
          onViewDetails={toggleScoreDetails}
        />
        
        {showScoreDetails && (
          <ScoreDetailsModal
            averageScore={userStats?.average_score || statsData?.average_score || 0}
            examBreakdown={examBreakdown}
            categoryBreakdown={categoryBreakdown}
            hasAttempts={userStats?.has_attempts || false}
            overallStats={userStats?.overall_stats}
            scoreHistory={scoreHistory?.results || []}
            historyLoading={isHistoryLoading}
            historyError={userStatsError || historyError}
            onClose={toggleScoreDetails}
          />
        )}
      </div>
    );
  }

  // Check if questions is not an array or is empty
  if (!Array.isArray(questions) || safeQuestions.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
        <ErrorDisplay error="No questions available. Please try different settings." />
        <button
          onClick={handleQuitQuiz}
          className="mt-4 bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-200"
        >
          Back to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 p-4 sm:p-6">
      {/* Metadata Display */}
      {metadata && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm">
            Quiz Session Information
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Requested:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">
                {metadata.requested_count} questions
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Returned:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">
                {metadata.returned_count} questions
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Available:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">
                {metadata.total_available} total
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Session:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">
                {metadata.session_size} seen
              </span>
            </div>
            {metadata.session_reset && (
              <div className="col-span-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Fresh session started
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <QuizHeader
        currentQuestion={currentPage}
        totalQuestions={totalPages}
        onQuit={handleQuitQuiz}
        userName={user?.first_name}
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Questions per page:
          <select
            value={questionsPerPage}
            onChange={(e) => setQuestionsPerPage(Number(e.target.value))}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 sm:text-sm rounded-md bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
      </div>

      <QuestionsList
        questions={paginatedQuestions}
        answers={answers}
        onAnswerSelect={handleAnswerSelect}
      />

      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 px-4 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
        >
          Previous
        </button>

        {currentPage < totalPages ? (
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            className="bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-200"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmitQuiz}
            disabled={isEvaluationLoading}
            className="bg-green-600 dark:bg-green-700 text-white py-2 px-4 rounded hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-200"
          >
            {isEvaluationLoading ? "Submitting..." : "Submit Quiz"}
          </button>
        )}
      </div>
    </div>
  );
}