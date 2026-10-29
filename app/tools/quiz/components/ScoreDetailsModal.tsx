// ScoreDetailsModal.tsx
import React, { useEffect } from "react";
import { Exam, Category, ScoreRecord } from "../types/quiztypes";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { SerializedError } from "@reduxjs/toolkit";

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

// Django decimals arrive as strings ("85.00"): always coerce
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const f1 = (v: unknown) => num(v).toFixed(1);

const tone = (s: number) =>
  s >= 70
    ? { text: "text-green-600 dark:text-green-400", bar: "bg-green-500" }
    : s >= 40
    ? { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" }
    : { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };

const card = "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";
const h3 = "text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2";

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`${card} p-3 text-center`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color || "text-gray-900 dark:text-white"}`}>{value}</div>
    </div>
  );
}

function Row({
  name,
  attempts,
  avg,
  best,
  low,
}: {
  name: string;
  attempts: number;
  avg: number;
  best: number;
  low: number;
}) {
  const t = tone(avg);
  return (
    <div className={`${card} p-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white" title={name}>
          {name}
        </span>
        <span className={`shrink-0 text-base font-bold ${t.text}`}>{f1(avg)}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, Math.min(100, avg))}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>{attempts}× taken</span>
        <span>
          Best <b className={tone(best).text}>{f1(best)}</b>
        </span>
        <span>
          Low <b className={tone(low).text}>{f1(low)}</b>
        </span>
      </div>
    </div>
  );
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
  onClose,
}: ScoreDetailsModalProps) {
  // Lock page scroll + close on Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const getErrorMessage = (error: FetchBaseQueryError | SerializedError | undefined): string => {
    if (!error) return "Unknown error";
    if ("status" in error) {
      const errMsg =
        error.data && typeof error.data === "object" && "message" in error.data
          ? (error.data as { message: string }).message
          : JSON.stringify(error.data);
      return `Error ${error.status}: ${errMsg}`;
    }
    if ("message" in error) return error.message || "Unknown error";
    return "Unknown error";
  };

  const getExamName = (i: BreakdownItem) => i.exam?.name || i.exam_name || "General Quiz";
  const getCategoryName = (i: BreakdownItem) => i.category?.name || i.category_name || "General Category";
  const getAttemptCount = (i: BreakdownItem) => num(i.attempt_count);
  const getAverageScore = (i: BreakdownItem) => num(i.average_score);

  const exams = examBreakdown || [];
  const cats = categoryBreakdown || [];
  const history = scoreHistory || [];

  const calculateUniqueQuizSessions = () => {
    if (overallStats?.unique_sessions) return num(overallStats.unique_sessions);
    if (overallStats?.total_attempts) return num(overallStats.total_attempts);
    const e = exams.length ? Math.max(...exams.map(getAttemptCount)) : 0;
    const c = cats.length ? Math.max(...cats.map(getAttemptCount)) : 0;
    return Math.max(e, c);
  };

  const displayAverageScore = num(overallStats?.average_score ?? averageScore);
  const best = num(overallStats?.highest_score);
  const low = num(overallStats?.lowest_score);
  const sessions = calculateUniqueQuizSessions();

  const hasScoreHistory = history.length > 0;
  const hasExamData = exams.some((i) => getAttemptCount(i) > 0);
  const hasCategoryData = cats.some((i) => getAttemptCount(i) > 0);
  const hasData =
    hasAttempts || displayAverageScore > 0 || sessions > 0 || hasExamData || hasCategoryData || hasScoreHistory;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filteredCats = cats
    .filter((i) => getAttemptCount(i) > 0)
    .sort((a, b) => getAverageScore(a) - getAverageScore(b)); // weakest first

  const filteredExams = exams
    .filter((i) => getAttemptCount(i) > 0)
    .sort((a, b) => getAverageScore(b) - getAverageScore(a));

  const recent = [...history]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-gray-50 dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Performance overview</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full text-2xl leading-none text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {historyLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-700 dark:text-gray-200">Loading your performance data...</p>
            </div>
          ) : historyError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center text-red-600 dark:text-red-300">
              <p className="font-semibold mb-1">Error loading data</p>
              <p className="text-sm break-words">{getErrorMessage(historyError)}</p>
            </div>
          ) : !hasData ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">📊</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No quiz data yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Complete your first quiz to see your stats and progress here.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi label="Sessions" value={String(sessions)} />
                <Kpi label="Average" value={`${f1(displayAverageScore)}%`} color={tone(displayAverageScore).text} />
                <Kpi label="Best" value={`${f1(best)}%`} color={tone(best).text} />
                <Kpi label="Lowest" value={`${f1(low)}%`} color={tone(low).text} />
              </div>
              {overallStats?.last_attempt && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  Last attempt: {formatDate(overallStats.last_attempt)}
                </p>
              )}

              {/* Recent attempts */}
              {hasScoreHistory && (
                <div>
                  <h3 className={h3}>Recent attempts</h3>
                  <div className={`${card} divide-y divide-gray-100 dark:divide-gray-700`}>
                    {recent.map((r, i) => {
                      const s = num(r.score);
                      return (
                        <div key={r.id || `history-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.date)}</p>
                            {(r.exam?.name || r.category?.name) && (
                              <p className="text-xs text-gray-700 dark:text-gray-200 truncate">
                                {r.exam?.name}
                                {r.exam?.name && r.category?.name && " · "}
                                {r.category?.name}
                              </p>
                            )}
                          </div>
                          <span className={`shrink-0 text-base font-bold ${tone(s).text}`}>{f1(s)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categories */}
              {hasCategoryData && (
                <div>
                  <h3 className={h3}>By category · weakest first</h3>
                  <div className="space-y-2">
                    {filteredCats.map((it, i) => (
                      <Row
                        key={it.category?.id || it.category_id || `category-${i}`}
                        name={getCategoryName(it)}
                        attempts={getAttemptCount(it)}
                        avg={getAverageScore(it)}
                        best={num(it.highest_score)}
                        low={num(it.lowest_score)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Exams */}
              {hasExamData && (
                <div>
                  <h3 className={h3}>By exam</h3>
                  <div className="space-y-2">
                    {filteredExams.map((it, i) => (
                      <Row
                        key={it.exam?.id || it.exam_id || `exam-${i}`}
                        name={getExamName(it)}
                        attempts={getAttemptCount(it)}
                        avg={getAverageScore(it)}
                        best={num(it.highest_score)}
                        low={num(it.lowest_score)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Insights</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  {displayAverageScore >= 70 ? (
                    <li>• Consistently scoring high. Keep it up.</li>
                  ) : displayAverageScore >= 40 ? (
                    <li>• Good progress. Focus on the weakest categories above.</li>
                  ) : (
                    <li>• Keep practicing. Review explanations for wrong answers.</li>
                  )}
                  <li>
                    • {sessions} quiz session{sessions !== 1 ? "s" : ""} so far.
                  </li>
                  {filteredCats.length > 0 && (
                    <li>
                      • {filteredCats.length} categor{filteredCats.length !== 1 ? "ies" : "y"} attempted.
                    </li>
                  )}
                  {filteredCats.length > 0 && (
                    <li>
                      • Weakest: {getCategoryName(filteredCats[0])} ({f1(getAverageScore(filteredCats[0]))}%).
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 transition-colors"
          >
            {hasData ? "Close" : "Start a Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}