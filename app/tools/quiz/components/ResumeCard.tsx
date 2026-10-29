import type { SavedQuiz } from "../utils/quizSession";
import { formatTime } from "../utils/quizSession";

interface Props {
  saved: SavedQuiz;
  onResume: () => void;
  onDiscard: () => void;
}

const ago = (ts: number) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

export default function ResumeCard({ saved, onResume, onDiscard }: Props) {
  const total = saved.questions.length;
  const answered = saved.questions.filter((q) => !!saved.answers[`question_${q.id}`]).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">Unfinished quiz</div>
        <div className="text-[11px] text-amber-700 dark:text-amber-300">saved {ago(saved.savedAt)}</div>
      </div>
      <div className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        {answered} / {total} answered
        {saved.remainingSeconds !== null ? ` · ${formatTime(saved.remainingSeconds)} left` : " · untimed"}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 overflow-hidden">
        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onResume}
          className="flex-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm px-4 py-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          Discard
        </button>
      </div>
    </div>
  );
}