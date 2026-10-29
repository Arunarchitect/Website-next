// components/QuizHeader.tsx
import { formatTime } from "../utils/quizSession";

interface QuizHeaderProps {
  totalQuestions: number;
  answeredCount: number;
  onQuit: () => void;
  userName?: string;
  setInfo?: { current_set: number; total_sets: number };
  perPage?: number;
  perPageOptions?: number[];
  onPerPageChange?: (n: number) => void;
  timeLeft?: number | null;
  totalSeconds?: number | null;
  onPause?: () => void;
}

export default function QuizHeader({
  totalQuestions,
  answeredCount,
  onQuit,
  userName,
  setInfo,
  perPage,
  perPageOptions = [1, 3, 5, 10, 20],
  onPerPageChange,
  timeLeft,
  totalSeconds,
  onPause,
}: QuizHeaderProps) {
  const pct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const timed = timeLeft !== null && timeLeft !== undefined && !!totalSeconds;
  const ratio = timed ? (timeLeft as number) / (totalSeconds as number) : 1;
  const low = timed && ((timeLeft as number) <= 60 || ratio <= 0.1);
  const warn = timed && ratio <= 0.25;
  const timeTone = low
    ? "text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-900 animate-pulse"
    : warn
    ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-900"
    : "text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600";
  const timeBar = low ? "bg-red-500" : warn ? "bg-amber-500" : "bg-emerald-500";

  const handleQuit = () => {
    if (answeredCount > 0 && !window.confirm("Quit this quiz? Your answers will be lost.")) return;
    onQuit();
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 mb-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {userName ? `${userName}'s quiz` : "Quiz"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {totalQuestions} questions
            {setInfo ? ` · Set ${setInfo.current_set} of ${setInfo.total_sets}` : ""}
          </div>
        </div>

        {timed && (
          <div className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-sm font-semibold tabular-nums ${timeTone}`}>
            ⏱ {formatTime(timeLeft as number)}
          </div>
        )}
        {onPause && (
          <button
            type="button"
            onClick={onPause}
            className="shrink-0 text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={handleQuit}
          className="shrink-0 text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          Quit
        </button>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
          <span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">{answeredCount}</span> / {totalQuestions} answered
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {timed && (
          <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${timeBar}`}
              style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
            />
          </div>
        )}
      </div>

      {perPage !== undefined && onPerPageChange && totalQuestions > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">Per page</span>
          <div className="flex gap-1.5 overflow-x-auto">
            {perPageOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPerPageChange(n)}
                className={`shrink-0 min-w-[36px] px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  perPage === n
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}