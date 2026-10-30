// components/ScoreDisplay.tsx
import { useEffect, useMemo, useState } from "react";
import { QuizEvaluation, ExamBreakdown, OverallScoreData } from "../types/quiztypes";
import {
  EnhancedMap,
  buildExportJson,
  buildOptions,
  clearEnhanced,
  copyText,
  loadEnhanced,
  norm,
  parseEnhanced,
  saveEnhanced,
} from "../utils/reviewExport";

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

const LETTERS = ["A", "B", "C", "D", "E", "F"];

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
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedMap>({});

  useEffect(() => {
    setEnhanced(loadEnhanced());
  }, []);

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

  const enhancedCount = results.explanations.filter((e) => enhanced[e.id]).length;

  const handleCopy = async () => {
    const json = buildExportJson(results.explanations, {
      score: parseFloat(rawScore.toFixed(2)),
      percentage: parseFloat(pct.toFixed(2)),
      total,
      correct: stats.correct,
      wrong: stats.wrong,
      skipped: stats.skipped,
    });
    const ok = await copyText(json);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2500);
  };

  const handleImport = () => {
    try {
      const parsed = parseEnhanced(importText);
      const merged = { ...enhanced, ...parsed };
      setEnhanced(merged);
      saveEnhanced(merged);
      const matched = results.explanations.filter((e) => parsed[e.id]).length;
      setImportMsg({
        ok: true,
        text: `Imported ${Object.keys(parsed).length} questions, ${matched} of ${results.explanations.length} match this quiz.`,
      });
      setImportText("");
    } catch (err) {
      setImportMsg({ ok: false, text: err instanceof Error ? err.message : "Import failed." });
    }
  };

  const handleClearStudy = () => {
    clearEnhanced();
    setEnhanced({});
    setImportMsg({ ok: true, text: "Saved study notes cleared." });
  };

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

        {/* AI study tools */}
        <div className="mb-3 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/60 dark:bg-purple-900/10 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
            >
              {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : "Copy for AI"}
            </button>
            <button
              type="button"
              onClick={() => {
                setImportOpen((v) => !v);
                setImportMsg(null);
              }}
              className="min-h-[36px] px-3 rounded-lg border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-200 text-xs font-semibold"
            >
              {importOpen ? "Hide import" : "Paste enhanced JSON"}
            </button>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {enhancedCount > 0
                ? `${enhancedCount}/${results.explanations.length} with study notes`
                : "Paste the copied JSON into an AI chat, then import its reply here."}
            </span>
          </div>

          {importOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder="Paste the AI's JSON reply here"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-mono text-gray-800 dark:text-gray-100"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className="min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold"
                >
                  Import
                </button>
                {Object.keys(enhanced).length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearStudy}
                    className="min-h-[36px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs"
                  >
                    Clear saved notes
                  </button>
                )}
              </div>
              {importMsg && (
                <p
                  className={`text-xs ${
                    importMsg.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {importMsg.text}
                </p>
              )}
            </div>
          )}
        </div>

        {review.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Nothing here.</p>
        ) : (
          <div className="space-y-3">
            {review.map(({ item, index }) => {
              const skipped = !item.selected || item.selected === "Not answered";
              const options = buildOptions(item.options, item.correct);
              const extra = enhanced[item.id];
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

                  <div className="mt-2 space-y-1.5">
                    {options.map((opt, i) => {
                      const isCorrectOpt = norm(opt) === norm(item.correct);
                      const isPicked = !skipped && norm(opt) === norm(item.selected);
                      const isWrongPick = isPicked && !isCorrectOpt;
                      const note = extra?.options[norm(opt)];
                      return (
                        <div
                          key={`${item.id}-${i}`}
                          className={`rounded-md border px-2.5 py-2 text-xs ${
                            isCorrectOpt
                              ? "border-green-300 dark:border-green-700 bg-green-100/70 dark:bg-green-900/30 text-green-900 dark:text-green-100"
                              : isWrongPick
                              ? "border-red-300 dark:border-red-700 bg-red-100/70 dark:bg-red-900/30 text-red-900 dark:text-red-100"
                              : "border-gray-200 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 font-semibold">{LETTERS[i] ?? i + 1}.</span>
                            <span className="min-w-0 flex-1 break-words">{opt}</span>
                            {isCorrectOpt && (
                              <span className="shrink-0 text-[10px] font-semibold text-green-700 dark:text-green-300">
                                ✓ Correct{isPicked ? " (yours)" : ""}
                              </span>
                            )}
                            {isWrongPick && (
                              <span className="shrink-0 text-[10px] font-semibold text-red-700 dark:text-red-300">
                                ✗ Your answer
                              </span>
                            )}
                          </div>
                          {note && (
                            <p className="mt-1.5 pl-5 text-[11px] leading-snug opacity-90 break-words">{note}</p>
                          )}
                        </div>
                      );
                    })}
                    {skipped && <p className="text-[11px] italic text-gray-500 dark:text-gray-400">Not answered</p>}
                  </div>

                  {item.explanation && (
                    <p className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">
                      {item.explanation}
                    </p>
                  )}

                  {extra && (extra.extra_explanation || extra.key_concepts?.length || extra.memory_tip) && (
                    <div className="mt-2 rounded-md border border-purple-200 dark:border-purple-900 bg-purple-50/70 dark:bg-purple-900/20 p-2.5 space-y-1.5 text-xs text-gray-700 dark:text-gray-200">
                      {extra.extra_explanation && <p className="break-words">{extra.extra_explanation}</p>}
                      {extra.key_concepts && extra.key_concepts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {extra.key_concepts.map((k, ki) => (
                            <span
                              key={ki}
                              className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 text-[10px] font-medium"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                      {extra.memory_tip && (
                        <p className="text-[11px] italic text-purple-800 dark:text-purple-200">💡 {extra.memory_tip}</p>
                      )}
                    </div>
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