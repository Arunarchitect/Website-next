// ScoreDetailsModal.tsx

import React from 'react';
import { Exam, Category, ScoreRecord } from '../types/quiztypes';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { SerializedError } from '@reduxjs/toolkit';

interface ScoreDetailsModalProps {
  averageScore: number;
  examBreakdown: Array<{
    exam_id?: number;
    exam_name?: string;
    average_score: number;
    attempt_count: number;
    highest_score?: number;
    lowest_score?: number;
    exam?: Exam | null;
  }>;
  categoryBreakdown: Array<{
    category_id?: number;
    category_name?: string;
    average_score: number;
    attempt_count: number;
    highest_score?: number;
    lowest_score?: number;
    category?: Category | null;
    type?: string;
  }>;
  hasAttempts?: boolean;
  overallStats?: {
    average_score: number;
    highest_score: number;
    lowest_score: number;
    total_attempts: number;
    last_attempt: string;
    unique_sessions?: number;
  };
  scoreHistory: ScoreRecord[];
  historyLoading: boolean;
  historyError: FetchBaseQueryError | SerializedError | undefined;
  onClose: () => void;
}

interface BreakdownItem {
  exam?: Exam | null;
  exam_name?: string;
  category?: Category | null;
  category_name?: string;
  attempt_count: number;
  average_score: number;
  highest_score?: number;
  lowest_score?: number;
  exam_id?: number;
  category_id?: number;
  type?: string;
}

export default function ScoreDetailsModal({
  averageScore,
  examBreakdown,
  categoryBreakdown,
  hasAttempts = false,
  overallStats,
  scoreHistory,
  historyLoading,
  historyError,
  onClose
}: ScoreDetailsModalProps) {

  const getScoreColor = (score: number) => {
    return score >= 70 ? 'text-green-500 dark:text-green-400' :
           score >= 50 ? 'text-yellow-500 dark:text-yellow-400' : 
           'text-red-500 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    return score >= 70 ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' :
           score >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800' : 
           'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  };

  const getErrorMessage = (error: FetchBaseQueryError | SerializedError | undefined): string => {
    if (!error) return 'Unknown error';
    if ('status' in error) {
      const errMsg = error.data && typeof error.data === 'object' && 'message' in error.data 
        ? (error.data as { message: string }).message
        : JSON.stringify(error.data);
      return `Error ${error.status}: ${errMsg}`;
    }
    if ('message' in error) {
      return error.message || 'Unknown error';
    }
    return 'Unknown error';
  };

  const getExamName = (item: BreakdownItem) => {
    return item.exam?.name || item.exam_name || 'General Quiz';
  };

  const getCategoryName = (item: BreakdownItem) => {
    return item.category?.name || item.category_name || 'General Category';
  };

  const getAttemptCount = (item: BreakdownItem) => {
    return item.attempt_count || 0;
  };

  const getAverageScore = (item: BreakdownItem) => {
    return item.average_score || 0;
  };

  const calculateUniqueQuizSessions = () => {
    if (overallStats?.unique_sessions) {
      return overallStats.unique_sessions;
    }
    
    if (overallStats?.total_attempts) {
      return overallStats.total_attempts;
    }
    
    const maxExamAttempts = examBreakdown.length > 0 
      ? Math.max(...examBreakdown.map(item => getAttemptCount(item)))
      : 0;
    const maxCategoryAttempts = categoryBreakdown.length > 0
      ? Math.max(...categoryBreakdown.map(item => getAttemptCount(item)))
      : 0;
    
    return Math.max(maxExamAttempts, maxCategoryAttempts);
  };

  const displayAverageScore = overallStats?.average_score || averageScore;
  const uniqueQuizSessions = calculateUniqueQuizSessions();

  // Check if we have score history data
  const hasScoreHistory = scoreHistory && scoreHistory.length > 0;
  const hasExamData = examBreakdown && examBreakdown.length > 0 && examBreakdown.some(item => getAttemptCount(item) > 0);
  const hasCategoryData = categoryBreakdown && categoryBreakdown.length > 0 && categoryBreakdown.some(item => getAttemptCount(item) > 0);
  const hasData = hasAttempts || displayAverageScore > 0 || uniqueQuizSessions > 0 || hasExamData || hasCategoryData || hasScoreHistory;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredCategoryBreakdown = categoryBreakdown
    .filter(item => getAttemptCount(item) > 0)
    .sort((a, b) => getAverageScore(b) - getAverageScore(a));

  const filteredExamBreakdown = examBreakdown
    .filter(item => getAttemptCount(item) > 0)
    .sort((a, b) => getAverageScore(b) - getAverageScore(a));

  // Sort score history by date (newest first)
  const sortedScoreHistory = [...scoreHistory].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 10); // Show only last 10 attempts

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Performance Overview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 text-2xl"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {historyLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-900 dark:text-white">Loading your performance data...</p>
          </div>
        ) : historyError ? (
          <div className="text-red-500 dark:text-red-400 text-center py-8">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <p className="font-semibold mb-2">Error Loading Data</p>
              <p>{getErrorMessage(historyError)}</p>
            </div>
          </div>
        ) : !hasData ? (
          <div className="text-center py-8">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Quiz Data Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Complete your first quiz to see your performance statistics and track your progress over time.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                How it works:
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 text-left space-y-1">
                <li>• Complete quizzes to build your performance history</li>
                <li>• Track your average scores across different exams</li>
                <li>• Identify your strong and weak categories</li>
                <li>• Monitor your improvement over time</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Performance Card */}
            <div className={`border rounded-lg p-6 ${getScoreBgColor(displayAverageScore)}`}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
                Overall Performance Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {uniqueQuizSessions}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Quiz Sessions</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(displayAverageScore)}`}>
                    {displayAverageScore.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Average Score</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(overallStats?.highest_score || 0)}`}>
                    {(overallStats?.highest_score || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Best Score</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getScoreColor(overallStats?.lowest_score || 0)}`}>
                    {(overallStats?.lowest_score || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Lowest Score</p>
                </div>
              </div>
              {overallStats?.last_attempt && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last attempt: {formatDate(overallStats.last_attempt)}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Score History */}
            {hasScoreHistory && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  Recent Quiz Attempts
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sortedScoreHistory.map((record, index) => (
                    <div 
                      key={record.id || `history-${index}`}
                      className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(record.date)}
                          </p>
                          {(record.exam || record.category) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {record.exam?.name && `Exam: ${record.exam.name}`}
                              {record.exam?.name && record.category?.name && ' • '}
                              {record.category?.name && `Category: ${record.category.name}`}
                            </p>
                          )}
                        </div>
                        <span className={`text-lg font-bold ${getScoreColor(record.score)}`}>
                          {record.score.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {hasCategoryData && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  Performance by Category
                </h3>
                <div className="space-y-3">
                  {filteredCategoryBreakdown.map((item, index) => (
                    <div 
                      key={item.category?.id || item.category_id || `category-${index}`} 
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-900 dark:text-white text-lg">
                          {getCategoryName(item)}
                        </span>
                        <span className={`text-xl font-bold ${getScoreColor(getAverageScore(item))}`}>
                          {getAverageScore(item).toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Quiz Sessions: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {getAttemptCount(item)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Best: </span>
                          <span className={`font-bold ${getScoreColor(item.highest_score || 0)}`}>
                            {(item.highest_score || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Average: </span>
                          <span className={`font-bold ${getScoreColor(getAverageScore(item))}`}>
                            {getAverageScore(item).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Lowest: </span>
                          <span className={`font-bold ${getScoreColor(item.lowest_score || 0)}`}>
                            {(item.lowest_score || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exam Breakdown */}
            {hasExamData && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  Performance by Exam
                </h3>
                <div className="space-y-3">
                  {filteredExamBreakdown.map((item, index) => (
                    <div 
                      key={item.exam?.id || item.exam_id || `exam-${index}`} 
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-900 dark:text-white text-lg">
                          {getExamName(item)}
                        </span>
                        <span className={`text-xl font-bold ${getScoreColor(getAverageScore(item))}`}>
                          {getAverageScore(item).toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Quiz Sessions: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {getAttemptCount(item)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Best: </span>
                          <span className={`font-bold ${getScoreColor(item.highest_score || 0)}`}>
                            {(item.highest_score || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Average: </span>
                          <span className={`font-bold ${getScoreColor(getAverageScore(item))}`}>
                            {getAverageScore(item).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Lowest: </span>
                          <span className={`font-bold ${getScoreColor(item.lowest_score || 0)}`}>
                            {(item.lowest_score || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Insights */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Performance Insights
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                {displayAverageScore >= 70 ? (
                  <li>• Excellent! You&apos;re consistently scoring high. Keep up the great work!</li>
                ) : displayAverageScore >= 50 ? (
                  <li>• Good progress! You&apos;re above average. Focus on weak areas to improve further.</li>
                ) : (
                  <li>• Keep practicing! Review the explanations for wrong answers to improve.</li>
                )}
                <li>• You&apos;ve completed {uniqueQuizSessions} quiz session{uniqueQuizSessions !== 1 ? 's' : ''} so far.</li>
                {hasScoreHistory && (
                  <li>• You have {scoreHistory.length} recorded attempt{scoreHistory.length !== 1 ? 's' : ''} in your history.</li>
                )}
                {overallStats?.highest_score && overallStats.highest_score >= 80 && (
                  <li>• Your best score of {overallStats.highest_score.toFixed(1)}% shows great potential!</li>
                )}
                {filteredCategoryBreakdown.length > 0 && (
                  <li>• You have attempted questions from {filteredCategoryBreakdown.length} different category{filteredCategoryBreakdown.length !== 1 ? 's' : ''}.</li>
                )}
                {filteredExamBreakdown.length > 0 && (
                  <li>• You have attempted questions from {filteredExamBreakdown.length} different exam{filteredExamBreakdown.length !== 1 ? 's' : ''}.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
        >
          {hasData ? 'Close' : 'Start a Quiz'}
        </button>
      </div>
    </div>
  );
}