// components/ScoreDisplay.tsx
import { useMemo, useState } from "react";
import { QuizEvaluation, ExamBreakdown, OverallScoreData } from "../types/quiztypes";

interface ScoreDisplayProps {
  results: QuizEvaluation & {
    category_breakdown?: Record<
      string,
      {
        raw_score: number;
        display_score: number;
        percentage: number;
        display_percentage: number;
        question_count: number;
        category_name: string;
      }
    >;
    exam_breakdown?: ExamBreakdown;
    overall_score?: OverallScoreData;
  };
  onRetry: () => void;
  averageScore?: number;
  onViewDetails: () => void;
  /** Starts the next quiz with the same settings (hidden when not provided) */
  onNext?: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const tone = (v: number) =>
  v >= 70
    ? { text: "text-green-600 dark:text-green-400", bar: "bg-green-500" }
    : v >= 40
    ? { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" }
    : { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };

const card = "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";

type Filter = "all" | "wrong" | "skipped";

export default function ScoreDisplay({
  results,
  onRetry,
  averageScore,
  onViewDetails,
  onNext,
  nextLabel,
  nextLoading,
}: ScoreDisplayProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const rawScore = num(results.rawScore ?? results.score);
  const pct = num(results.percentage);
  const shownPct = Math.max(0, pct);
  const total = num(results.total) || results.explanations.length;
  const avg = averageScore !== undefined ? num(averageScore) : undefined;
  const t = tone(pct);

  const stats = useMemo(() => {
    let correct = 0;
    let skipped = 0;
    results.explanations.forEach((e) => {
      if (e.is_correct) correct++;
      else if (!e.selected || e.selected === "Not answered") skipped++;
    });
    const wrong = results.explanations.length - correct - skipped;
    return { correct, wrong, skipped };
  }, [results.explanations]);

  const categories = useMemo(
    () =>
      Object.entries(results.category_breakdown || {})
        .map(([id, c]) => ({ id, ...c, percentage: num(c.percentage), raw_score: num(c.raw_score) }))
        .sort((a, b) => a.percentage - b.percentage),
    [results.category_breakdown]
  );

  const review = results.explanations
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const skipped = !item.selected || item.selected === "Not answered";
      if (filter === "wrong") return !item.is_correct && !skipped;
      if (filter === "skipped") return skipped;
      return true;
    });

  const delta = avg !== undefined ? pct - avg : null;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className={`${card} p-5 text-center`}>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Quiz results</div>
        <div className={`mt-1 text-5xl font-bold tabular-nums ${t.text}`}>{shownPct.toFixed(1)}%</div>
        {pct < 0 && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            Actual score {pct.toFixed(1)}% (wrong answers cost more than correct ones earned)
          </p>
        )}
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {rawScore.toFixed(2)} / {total} points
        </p>
        {avg !== undefined && delta !== null && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your average {avg.toFixed(1)}% ·{" "}
            <span className={delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} vs average
            </span>
          </p>
        )}
        <p className="mt-2 text-[11px] text-gray-400">+1 correct · -0.33 wrong · 0 skipped</p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`${card} p-3 text-center`}>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.correct}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Correct</div>
        </div>
        <div className={`${card} p-3 text-center`}>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.wrong}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Wrong</div>
        </div>
        <div className={`${card} p-3 text-center`}>
          <div className="text-xl font-bold text-gray-700 dark:text-gray-200">{stats.skipped}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Skipped</div>
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className={`${card} p-3 sm:p-4`}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">By category · weakest first</h3>
          <div className="space-y-3">
            {categories.map((c) => {
              const ct = tone(c.percentage);
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200" title={c.category_name}>
                      {c.category_name}
                    </span>
                    <span className="shrink-0 text-gray-500 dark:text-gray-400">
                      <span className={`font-semibold ${ct.text}`}>{c.percentage.toFixed(0)}%</span> ·{" "}
                      {c.raw_score.toFixed(2)}/{c.question_count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ct.bar}`}
                      style={{ width: `${Math.max(2, Math.min(100, c.percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review */}
      <div className={`${card} p-3 sm:p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Question review</h3>
          <div className="flex gap-1.5">
            {(
              [
                ["all", `All ${results.explanations.length}`],
                ["wrong", `Wrong ${stats.wrong}`],
                ["skipped", `Skipped ${stats.skipped}`],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                  filter === k
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {review.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Nothing here.</p>
        ) : (
          <div className="space-y-3">
            {review.map(({ item, index }) => {
              const skipped = !item.selected || item.selected === "Not answered";
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${
                    item.is_correct
                      ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10"
                      : skipped
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40"
                      : "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                      Q{index + 1}
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.question}</p>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.is_correct
                          ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          : skipped
                          ? "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                          : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                      }`}
                    >
                      {item.is_correct ? "Correct" : skipped ? "Skipped" : "Wrong"}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs">
                    {!item.is_correct && (
                      <p className="text-gray-500 dark:text-gray-400">
                        Your answer:{" "}
                        <span className={skipped ? "italic" : "font-medium text-red-600 dark:text-red-400"}>
                          {skipped ? "Not answered" : item.selected}
                        </span>
                      </p>
                    )}
                    <p className="text-gray-500 dark:text-gray-400">
                      Correct answer:{" "}
                      <span className="font-medium text-green-600 dark:text-green-400">{item.correct}</span>
                    </p>
                  </div>

                  {item.explanation && (
                    <p className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">
                      {item.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions: sticky on mobile */}
      <div className="sticky bottom-0 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:static space-y-2">
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextLoading}
            className="w-full min-h-[48px] rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            {nextLoading ? "Loading..." : `${nextLabel ?? "Next quiz"} →`}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="flex-1 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            New quiz
          </button>
          <button
            onClick={onViewDetails}
            className="flex-1 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            History
          </button>
        </div>
      </div>
    </div>
  );
}