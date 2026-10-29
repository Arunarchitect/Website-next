"use client";

import { useMemo } from "react";
import type { UserStatsResponse, ProgressData } from "@/redux/features/quizApiSlice";
import type { ScoreRecord } from "../types/quiztypes";

interface Props {
  user?: { first_name?: string; last_name?: string; email?: string } | null;
  userLoading: boolean;
  stats?: UserStatsResponse;
  progress: ProgressData[];
  recent: ScoreRecord[];
  loading: boolean;
  onViewHistory: () => void;
}

const fmt = (n: number | undefined | null) =>
  n === undefined || n === null || Number.isNaN(n) ? "–" : `${Math.round(n * 10) / 10}`;

const tone = (v: number) =>
  v >= 70
    ? { bar: "bg-green-500", text: "text-green-600 dark:text-green-400", hex: "#22c55e" }
    : v >= 40
    ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", hex: "#f59e0b" }
    : { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", hex: "#ef4444" };

const card =
  "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4";

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={card}>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-bold ${color || "text-gray-900 dark:text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function TrendChart({ data }: { data: ProgressData[] }) {
  const W = 400, H = 130, P = 10;
  if (data.length < 2) {
    return (
      <div className="h-[110px] flex items-center justify-center text-xs text-gray-400 text-center px-4">
        Take a few more quizzes to see your trend
      </div>
    );
  }
  const vals = data.map((d) => d.average_score);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(...vals, 1);
  const x = (i: number) => P + (i * (W - 2 * P)) / (data.length - 1);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.average_score)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  const last = vals[vals.length - 1];
  const c = tone(last).hex;
  const delta = last - vals[0];
  // thin out dots on long series so they don't blob together on small screens
  const showDots = data.length <= 30;

  return (
    <div>
      {/* no preserveAspectRatio="none": keeps dots round on narrow screens */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.3" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={P} x2={W - P} y1={H * t} y2={H * t} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeDasharray="3 4" />
        ))}
        <path d={area} fill="url(#trendfill)" />
        <path d={line} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {showDots &&
          data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.average_score)} r="3.5" fill={c}>
              <title>{`${d.period || d.week}: ${fmt(d.average_score)} (${d.attempt_count} quizzes)`}</title>
            </circle>
          ))}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 gap-2">
        <span className="truncate">{data[0].period || data[0].week}</span>
        <span className={`shrink-0 ${delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} overall
        </span>
        <span className="truncate text-right">{data[data.length - 1].period || data[data.length - 1].week}</span>
      </div>
    </div>
  );
}

function BarRow({ name, avg, attempts, best }: { name: string; avg: number; attempts: number; best?: number }) {
  const t = tone(avg);
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1 gap-2">
        <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200" title={name}>{name}</span>
        <span className="shrink-0 text-gray-500 dark:text-gray-400">
          <span className={`font-semibold ${t.text}`}>{fmt(avg)}</span> · {attempts}×
          {best !== undefined && <span className="hidden sm:inline"> · best {fmt(best)}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, Math.min(100, avg))}%` }} />
      </div>
    </div>
  );
}

export default function PerformanceDashboard({
  user, userLoading, stats, progress, recent, loading, onViewHistory,
}: Props) {
  const o = stats?.overall_stats;

  const categories = useMemo(
    () => [...(stats?.category_breakdown || [])].sort((a, b) => a.average_score - b.average_score),
    [stats]
  );
  const weakest = categories.slice(0, 6);
  const strongest = categories.length > 6 ? categories[categories.length - 1] : null;

  const recentSorted = useMemo(
    () => [...recent].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8),
    [recent]
  );

  // If the weekly endpoint has < 2 points, build a per-attempt trend from score history
  const trend: ProgressData[] = useMemo(() => {
    if (progress.length >= 2) return progress;
    const asc = [...recent]
      .filter((r) => r.date && typeof r.score === "number")
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .slice(-30);
    return asc.map((r) => {
      const lbl = new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return { week: lbl, period: lbl, average_score: r.score, attempt_count: 1 };
    });
  }, [progress, recent]);

  const hasExams = (stats?.exam_breakdown?.length ?? 0) > 0;

  const header = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
        {userLoading ? "" : `${user?.first_name?.charAt(0) || ""}${user?.last_name?.charAt(0) || ""}`}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-gray-900 dark:text-white truncate">
          {user ? `${user.first_name} ${user.last_name}` : "Your performance"}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
      </div>
      <button
        onClick={onViewHistory}
        className="ml-auto shrink-0 text-xs px-3 py-2 sm:py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        <span className="hidden sm:inline">Full history</span>
        <span className="sm:hidden">History</span> →
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 animate-pulse">
        {header}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />)}
        </div>
        <div className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (!stats?.has_attempts) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {header}
        <div className={`${card} text-center py-10 sm:py-12`}>
          <div className="text-3xl mb-2">📊</div>
          <p className="font-medium text-gray-800 dark:text-gray-100">No attempts yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete a quiz and your performance dashboard will appear here.
          </p>
        </div>
      </div>
    );
  }

  const avgTone = tone(o?.average_score ?? 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {header}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Kpi label="Average" value={fmt(o?.average_score)} color={avgTone.text} sub={`${stats.summary.total_quizzes_taken} quizzes`} />
        <Kpi label="Best" value={fmt(o?.highest_score)} color="text-green-600 dark:text-green-400" />
        <Kpi label="Lowest" value={fmt(o?.lowest_score)} color="text-red-600 dark:text-red-400" />
        <Kpi label="Last 7 days" value={`${o?.recent_activity ?? 0}`} sub="quizzes taken" />
      </div>

      {/* Trend (+ exams only when there is exam data) */}
      <div className={`grid gap-3 sm:gap-4 ${hasExams ? "md:grid-cols-2" : ""}`}>
        <div className={card}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {progress.length >= 2 ? "Weekly trend" : "Score trend"}
          </h3>
          <TrendChart data={trend} />
        </div>
        {hasExams && (
          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
              By exam <span className="font-normal text-gray-400">({stats.summary.exams_attempted})</span>
            </h3>
            <div className="space-y-3">
              {stats.exam_breakdown.map((e) => (
                <BarRow key={e.exam_id} name={e.exam_name} avg={e.average_score} attempts={e.attempt_count} best={e.highest_score} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className={card}>
        <div className="flex items-baseline justify-between mb-3 gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Focus areas · weakest first</h3>
          <span className="shrink-0 text-[11px] text-gray-400">{stats.summary.categories_attempted} categories</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {weakest.map((c) => (
            <BarRow key={c.category_id} name={c.category_name} avg={c.average_score} attempts={c.attempt_count} />
          ))}
        </div>
        {strongest && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Strongest: <span className="font-medium text-green-600 dark:text-green-400">{strongest.category_name}</span> ({fmt(strongest.average_score)})
          </p>
        )}
      </div>

      {/* Recent attempts */}
      {recentSorted.length > 0 && (
        <div className={card}>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Recent attempts</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentSorted.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-14 sm:w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                  {r.exam?.name || "All exams"}
                  {r.category?.name && <span className="text-gray-400"> · {r.category.name}</span>}
                </span>
                <span className={`shrink-0 font-semibold ${tone(r.score).text}`}>{fmt(r.score)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}