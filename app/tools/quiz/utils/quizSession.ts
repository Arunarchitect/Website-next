import type { ExtendedQuizParams, Question, QuizMetadata } from "../types/quiztypes";
import type { AttemptResponse } from "@/redux/features/quizApiSlice";

export interface StartParams extends ExtendedQuizParams {
  timer_per_question?: number; // seconds; 0/undefined = untimed
}

export interface SavedQuiz {
  v: 1;
  owner: string;
  questions: Question[];
  answers: Record<string, string>;
  metadata: QuizMetadata | null;
  exam: number | null;
  category: number | null;
  totalSeconds: number | null;
  remainingSeconds: number | null;
  savedAt: number;
}

const KEY = "modelflick_quiz_session_v1";
const UNSYNCED_KEY = "modelflick_quiz_unsynced_v1";

// ---- local backup (used when the server is unreachable / tab closes mid-request) ----
export const loadSavedQuiz = (owner: string): SavedQuiz | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedQuiz;
    if (s.v !== 1 || s.owner !== owner || !Array.isArray(s.questions) || s.questions.length === 0) return null;
    return s;
  } catch {
    return null;
  }
};

export const saveQuiz = (s: SavedQuiz) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / blocked: ignore */
  }
};

export const clearSavedQuiz = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

// true when the last server save failed, i.e. the local copy is the only up-to-date one
export const setUnsynced = (v: boolean) => {
  try {
    if (v) localStorage.setItem(UNSYNCED_KEY, "1");
    else localStorage.removeItem(UNSYNCED_KEY);
  } catch {
    /* ignore */
  }
};

export const isUnsynced = (): boolean => {
  try {
    return localStorage.getItem(UNSYNCED_KEY) === "1";
  } catch {
    return false;
  }
};

// ---- server <-> local ----
export const attemptToSaved = (
  a: NonNullable<AttemptResponse["attempt"]>,
  owner: string
): SavedQuiz => ({
  v: 1,
  owner,
  questions: a.questions,
  answers: a.answers || {},
  metadata: a.metadata ?? null,
  exam: a.exam ?? null,
  category: a.category ?? null,
  totalSeconds: a.total_seconds ?? null,
  remainingSeconds: a.remaining_seconds ?? null,
  savedAt: Date.parse(a.updated_at) || Date.now(),
});

export const newest = (a: SavedQuiz | null, b: SavedQuiz | null): SavedQuiz | null => {
  if (!a) return b;
  if (!b) return a;
  return a.savedAt >= b.savedAt ? a : b;
};

export const formatTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};