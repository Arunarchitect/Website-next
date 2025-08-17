import { useState } from 'react';
import { Exam, Category } from '../types/quiztypes';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { SerializedError } from '@reduxjs/toolkit';

interface ScoreDetailsModalProps {
  averageScore: number;
  examBreakdown: Array<{
    exam?: Exam | null;
    average_score: number;
    attempt_count: number;
  }>;
  categoryBreakdown: Array<{
    category?: Category | null;
    average_score: number;
    attempt_count: number;
  }>;
  scoreHistory: Array<{
    id: number;
    score: number;
    date: string;
    exam?: Exam | null;
    category?: Category | null;
  }>;
  historyLoading: boolean;
  historyError: FetchBaseQueryError | SerializedError | undefined;
  onClose: () => void;
}

export default function ScoreDetailsModal({
  averageScore,
  examBreakdown,
  categoryBreakdown,
  scoreHistory,
  historyLoading,
  historyError,
  onClose
}: ScoreDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'history'>('stats');

  const getScoreColor = (score: number) => {
    return score >= 70 ? 'text-green-500 dark:text-green-400' :
           score >= 50 ? 'text-yellow-500 dark:text-yellow-400' : 
           'text-red-500 dark:text-red-400';
  };

  const getErrorMessage = (error: FetchBaseQueryError | SerializedError | undefined): string => {
    if (!error) return 'Unknown error';
    
    if ('status' in error) {
      // Handle FetchBaseQueryError
      const errMsg = error.data && typeof error.data === 'object' && 'message' in error.data 
        ? (error.data as { message: string }).message
        : JSON.stringify(error.data);
      return `Error ${error.status}: ${errMsg}`;
    }
    
    if ('message' in error) {
      // Handle SerializedError
      return error.message || 'Unknown error';
    }
    
    return 'Unknown error';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Your Performance Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 text-2xl"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'stats' 
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('stats')}
          >
            Performance Stats
          </button>
          <button
            className={`py-2 px-4 font-medium ${
              activeTab === 'history' 
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('history')}
          >
            Score History
          </button>
        </div>

        {activeTab === 'stats' && (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Overall Average
              </h3>
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {averageScore.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Performance by Exam
              </h3>
              <div className="space-y-3">
                {examBreakdown.length > 0 ? (
                  examBreakdown.map((item, index) => (
                    <div 
                      key={item.exam?.id || index} 
                      className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.exam?.name || 'General Quiz'}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {item.average_score.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.attempt_count} attempt{item.attempt_count !== 1 && 's'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No exam data available</p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Performance by Category
              </h3>
              <div className="space-y-3">
                {categoryBreakdown.length > 0 ? (
                  categoryBreakdown.map((item, index) => (
                    <div 
                      key={item.category?.id || index} 
                      className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.category?.name || 'General Category'}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {item.average_score.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {item.attempt_count} attempt{item.attempt_count !== 1 && 's'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No category data available</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="text-center py-8 text-gray-900 dark:text-white">
                Loading your history...
              </div>
            ) : historyError ? (
              <div className="text-red-500 dark:text-red-400 text-center py-8">
                {getErrorMessage(historyError)}
              </div>
            ) : scoreHistory?.length ? (
              <>
                <div className="grid grid-cols-12 gap-4 font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
                  <div className="col-span-4">Quiz</div>
                  <div className="col-span-3">Category</div>
                  <div className="col-span-2 text-right">Score</div>
                  <div className="col-span-3 text-right">Date</div>
                </div>
                
                {scoreHistory.map((score) => (
                  <div 
                    key={score.id} 
                    className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100 dark:border-gray-700"
                  >
                    <div className="col-span-4 font-medium text-gray-900 dark:text-white">
                      {score.exam?.name || 'General Quiz'}
                    </div>
                    <div className="col-span-3 text-gray-600 dark:text-gray-300">
                      {score.category?.name || '-'}
                    </div>
                    <div className={`col-span-2 font-bold text-right ${getScoreColor(score.score)}`}>
                      {score.score.toFixed(1)}%
                    </div>
                    <div className="col-span-3 text-gray-500 dark:text-gray-400 text-right text-sm">
                      {new Date(score.date).toLocaleDateString()}
                      <br />
                      {new Date(score.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No quiz attempts found
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}