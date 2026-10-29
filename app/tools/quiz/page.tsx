"use client";

import "./quiz.css";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  useGetExamsQuery,
  useGetScoreStatsQuery,
  useGetScoresByExamQuery,
  useGetScoresByCategoryQuery,
  useLazyGetFilteredScoresQuery,
  useGetUserStatsQuery,
  useGetProgressOverTimeQuery,
  useLazyGetAttemptQuery,
  useSaveAttemptMutation,
  useDeleteAttemptMutation,
} from "@/redux/features/quizApiSlice";
import type { AttemptPayload } from "@/redux/features/quizApiSlice";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import QuizSettings, { RANDOM_MAX } from "./components/QuizSettings";
import QuestionsList from "./components/QuestionList";
import ScoreDisplay from "./components/ScoreDisplay";
import ErrorDisplay from "./components/ErrorDisplay";
import QuizHeader from "./components/QuizHeader";
import ResumeCard from "./components/ResumeCard";
import PerformanceDashboard from "./components/PerformanceDashboard";
import { useQuiz } from "./hooks/useQuiz";
import { useQuizTimer } from "./hooks/useQuizTimer";
import ScoreDetailsModal from "./components/ScoreDetailsModal";
import { Question, QuizMetadata, ScoreRecord } from "./types/quiztypes";
import {
  SavedQuiz,
  StartParams,
  attemptToSaved,
  clearSavedQuiz,
  formatTime,
  isUnsynced,
  loadSavedQuiz,
  newest,
  saveQuiz,
  setUnsynced,
} from "./utils/quizSession";

interface Snap {
  quizState: string;
  questions: Question[];
  answers: Record<string, string>;
  metadata: QuizMetadata | null;
  quizExam: number | null;
  quizCategory: number | null;
  totalSeconds: number | null;
  owner: string;
}

type Sync = "idle" | "saving" | "saved" | "offline";

// Settings of the quiz that was just started (used by "Next quiz")
interface LastRun {
  params: StartParams;
  random: boolean;
}

function QuizPageInner() {
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
    restoreQuiz,
    submitAnswers,
    handleAnswerSelect,
    resetQuiz,
    quizState,
    currentExam,
    currentCategory,
    quizExam,
    quizCategory,
    handleExamChange,
    metadata,
  } = useQuiz();

  const [questionsPerPage, setQuestionsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [shouldFetchStats, setShouldFetchStats] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedQuiz | null>(null);
  const [sync, setSync] = useState<Sync>("idle");
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  const owner = user?.email || "anon";

  const [getAttempt] = useLazyGetAttemptQuery();
  const [saveAttemptApi] = useSaveAttemptMutation();
  const [deleteAttemptApi] = useDeleteAttemptMutation();

  // ---- timer (auto-submit on expiry) ----
  const submitRef = useRef(submitAnswers);
  useEffect(() => {
    submitRef.current = submitAnswers;
  });
  const timer = useQuizTimer(() => {
    submitRef.current();
  });
  const { getRemaining, start: timerStart, stop: timerStop, pause: timerPause, resume: timerResume } = timer;

  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = timer.paused;
  });

  // ---- latest quiz snapshot (read by autosave without re-creating callbacks) ----
  const snapRef = useRef<Snap | null>(null);
  useEffect(() => {
    snapRef.current = { quizState, questions, answers, metadata, quizExam, quizCategory, totalSeconds, owner };
  });

  // ---- server calls run one at a time so a late save can never undo a delete ----
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((fn: () => Promise<unknown>) => {
    chainRef.current = chainRef.current.then(fn).catch(() => { });
  }, []);

  const persistLocal = useCallback(() => {
    const s = snapRef.current;
    if (!s || s.quizState !== "in-progress" || s.questions.length === 0) return;
    saveQuiz({
      v: 1,
      owner: s.owner,
      questions: s.questions,
      answers: s.answers,
      metadata: s.metadata,
      exam: s.quizExam,
      category: s.quizCategory,
      totalSeconds: s.totalSeconds,
      remainingSeconds: getRemaining(),
      savedAt: Date.now(),
    });
  }, [getRemaining]);

  // Build the payload NOW (synchronously), send it later
  const buildPayload = useCallback(
    (paused: boolean): AttemptPayload | null => {
      const s = snapRef.current;
      if (!s || s.quizState !== "in-progress" || s.questions.length === 0) return null;
      return {
        question_ids: s.questions.map((q) => q.id),
        answers: s.answers,
        metadata: s.metadata,
        exam: s.quizExam,
        category: s.quizCategory,
        total_seconds: s.totalSeconds,
        remaining_seconds: getRemaining(),
        paused,
      };
    },
    [getRemaining]
  );

  const sendPayload = useCallback(
    (p: AttemptPayload | null) => {
      if (!p) return;
      enqueue(async () => {
        setSync("saving");
        setUnsynced(true);
        try {
          await saveAttemptApi(p).unwrap();
          setUnsynced(false);
          setSync("saved");
        } catch {
          setSync("offline");
        }
      });
    },
    [enqueue, saveAttemptApi]
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // save on every answer (server save debounced 1.5s)
  useEffect(() => {
    if (quizState !== "in-progress") return;
    persistLocal();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sendPayload(buildPayload(pausedRef.current));
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [answers, quizState, totalSeconds, persistLocal, sendPayload, buildPayload]);

  // save every 15s while running
  useEffect(() => {
    if (quizState !== "in-progress" || timer.paused) return;
    const id = setInterval(() => {
      persistLocal();
      sendPayload(buildPayload(false));
    }, 15000);
    return () => clearInterval(id);
  }, [quizState, timer.paused, persistLocal, sendPayload, buildPayload]);

  // save when the tab is hidden or closed
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        persistLocal();
        sendPayload(buildPayload(pausedRef.current));
      }
    };
    const onPageHide = () => persistLocal();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [persistLocal, sendPayload, buildPayload]);

  // On the settings screen: find an unfinished quiz (server first, local as fallback)
  useEffect(() => {
    if (quizState !== "settings") return;
    let cancelled = false;
    const local = loadSavedQuiz(owner);
    setSaved(local);

    (async () => {
      await chainRef.current; // let any pending save finish first
      try {
        const res = await getAttempt(undefined, false).unwrap();
        if (cancelled) return;
        const server = res.attempt ? attemptToSaved(res.attempt, owner) : null;
        if (!server) {
          // finished/discarded elsewhere -> drop stale local copy (unless it never reached the server)
          if (local && !isUnsynced()) {
            clearSavedQuiz();
            setSaved(null);
          }
          return;
        }
        setSaved(newest(local, server));
      } catch {
        /* offline: keep local copy */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizState, owner, getAttempt]);

  // finished: stop clock + drop saved copies
  useEffect(() => {
    if (quizState === "results") {
      timerStop();
      clearSavedQuiz();
      setUnsynced(false);
      enqueue(() => deleteAttemptApi().unwrap());
      setSaved(null);
    }
  }, [quizState, timerStop, enqueue, deleteAttemptApi]);

  // ---- stats ----
  const {
    data: userStats,
    isLoading: userStatsLoading,
    error: userStatsError,
    refetch: refetchUserStats,
  } = useGetUserStatsQuery();

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchScoreStats,
  } = useGetScoreStatsQuery();

  const {
    data: examBreakdown = [],
    isLoading: examBreakdownLoading,
    refetch: refetchExamBreakdown,
  } = useGetScoresByExamQuery();

  const {
    data: categoryBreakdown = [],
    isLoading: categoryBreakdownLoading,
    refetch: refetchCategoryBreakdown,
  } = useGetScoresByCategoryQuery();

  const {
    data: progress = [],
    refetch: refetchProgress,
  } = useGetProgressOverTimeQuery();

  const [getFilteredScores, {
    data: scoreHistory,
    isLoading: historyLoading,
    error: historyError,
  }] = useLazyGetFilteredScoresQuery();

  // Accept both paginated ({results: []}) and plain-array responses
  const rawHistory: ScoreRecord[] = Array.isArray(scoreHistory)
    ? (scoreHistory as unknown as ScoreRecord[])
    : ((scoreHistory?.results as ScoreRecord[] | undefined) || []);

  // One row per quiz: /scores/ also returns per-exam and per-category rows
  const bySession = new Map<string, ScoreRecord>();
  for (const r of rawHistory) {
    const key = r.quiz_session ?? `id-${r.id}`;
    const cur = bySession.get(key);
    if (!cur || (r.is_primary && !cur.is_primary)) bySession.set(key, r);
  }

  // Django DecimalFields can arrive as strings; coerce so .toFixed etc. work
  const historyList: ScoreRecord[] = Array.from(bySession.values()).map((r) => ({
    ...r,
    score: Number(r.score),
  }));

  useEffect(() => {
    getFilteredScores({});
  }, [getFilteredScores]);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setCurrentPage(1);
    }
  }, [questions]);

  useEffect(() => {
    if (quizState === "results" && results) {
      setShouldFetchStats(true);
    }
  }, [quizState, results]);

  useEffect(() => {
    if (shouldFetchStats) {
      const refreshStats = async () => {
        try {
          await Promise.all([
            refetchUserStats(),
            refetchScoreStats(),
            refetchExamBreakdown(),
            refetchCategoryBreakdown(),
            refetchProgress(),
            getFilteredScores({}),
          ]);
        } catch (err) {
          console.error("Failed to refresh stats:", err);
        } finally {
          setShouldFetchStats(false);
        }
      };
      refreshStats();
    }
  }, [
    shouldFetchStats,
    refetchUserStats,
    refetchScoreStats,
    refetchExamBreakdown,
    refetchCategoryBreakdown,
    refetchProgress,
    getFilteredScores,
  ]);

  // ---- handlers ----
  const handleViewHistory = () => setShowScoreDetails(true);

  // Loads questions and sets up the timer. Used by Start and by Next quiz.
  const launchQuiz = async (params: StartParams) => {
    const n = await fetchQuestions(params);
    if (n > 0 && params.timer_per_question) {
      const total = n * params.timer_per_question;
      timerStart(total);
      setTotalSeconds(total);
    } else {
      timerStop();
      setTotalSeconds(null);
    }
    return n;
  };

  const handleStartQuiz = async (params: StartParams, meta?: { random: boolean }) => {
    if (saved && !window.confirm("You have an unfinished quiz. Starting a new one will discard it. Continue?")) return;
    setLastRun({ params, random: meta?.random ?? false });
    await launchQuiz(params);
  };

  // Same exam / category / count / timer.
  // Random stays random; a fixed set moves to the consecutive next set.
  const getNextRun = (): StartParams | null => {
    if (!lastRun) return null;
    const { params, random } = lastRun;
    const cur = params.set_number ?? 1;
    let set: number;

    if (random) {
      set = 1 + Math.floor(Math.random() * RANDOM_MAX);
      if (RANDOM_MAX > 1 && set === cur) set = (set % RANDOM_MAX) + 1; // never the same set twice in a row
    } else {
      const totalSets = metadata?.set_info?.total_sets;
      if (cur === -1) set = 1; // after "last" comes "first"
      else if (cur > 0 && totalSets && cur >= totalSets) set = 1; // past the final set: back to first
      else set = cur + 1; // 3 -> 4, -3 -> -2
    }
    return { ...params, set_number: set };
  };

  const handleNextQuiz = async () => {
    const next = getNextRun();
    if (!next || !lastRun) return;
    setLastRun({ ...lastRun, params: next });
    // No resetQuiz() here: fetchQuestions clears answers/results and switches to in-progress by itself,
    // and the loading screen shows in between.
    await launchQuiz(next);
  };

  const handleResumeSaved = () => {
    if (!saved) return;
    restoreQuiz({
      questions: saved.questions,
      answers: saved.answers,
      metadata: saved.metadata,
      exam: saved.exam,
      category: saved.category,
    });
    setTotalSeconds(saved.totalSeconds);
    if (saved.remainingSeconds !== null) timerStart(Math.max(1, saved.remainingSeconds));
    else timerStop();
    setSaved(null);
    setLastRun(null); // a resumed quiz has no remembered start settings
  };

  const discardEverywhere = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    clearSavedQuiz();
    setUnsynced(false);
    enqueue(() => deleteAttemptApi().unwrap());
    setSaved(null);
  };

  const handleDiscardSaved = () => {
    if (!window.confirm("Discard the unfinished quiz?")) return;
    discardEverywhere();
  };

  const handlePause = () => {
    timerPause();
    persistLocal();
    sendPayload(buildPayload(true));
  };

  const handleSaveExit = () => {
    persistLocal();
    sendPayload(buildPayload(true)); // payload is built now, sent after we leave this screen
    timerStop();
    setTotalSeconds(null);
    setLastRun(null);
    resetQuiz();
  };

  const handleQuitQuiz = () => {
    discardEverywhere();
    timerStop();
    setTotalSeconds(null);
    setLastRun(null);
    resetQuiz();
  };

  const handleSubmitQuiz = () => {
    submitAnswers();
  };

  const toggleScoreDetails = () => setShowScoreDetails((s) => !s);

  const safeQuestions = Array.isArray(questions) ? questions : [];
  const totalPages = Math.ceil(safeQuestions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const paginatedQuestions = safeQuestions.slice(startIndex, endIndex);

  const totalQ = safeQuestions.length;
  const answeredCount = safeQuestions.filter((q) => !!answers[`question_${q.id}`]).length;
  const unanswered = totalQ - answeredCount;

  const isHistoryLoading =
    userStatsLoading || statsLoading || examBreakdownLoading || categoryBreakdownLoading || historyLoading;

  // "Next quiz" button info (only on the results screen, only if we know the start settings)
  const nextRun = quizState === "results" ? getNextRun() : null;
  const nextLabel = !nextRun
    ? undefined
    : lastRun?.random
    ? "Next quiz · random set"
    : `Next quiz · set ${nextRun.set_number}`;

  const syncLabel =
    sync === "saving"
      ? "☁ Saving…"
      : sync === "saved"
        ? "☁ Saved"
        : sync === "offline"
          ? "⚠ Offline · saved on this device"
          : "";

  const scoreModal = showScoreDetails && (
    <ScoreDetailsModal
      averageScore={Number(userStats?.average_score || statsData?.average_score || 0)}
      examBreakdown={examBreakdown}
      categoryBreakdown={categoryBreakdown}
      hasAttempts={userStats?.has_attempts || false}
      overallStats={userStats?.overall_stats}
      scoreHistory={historyList}
      historyLoading={isHistoryLoading}
      historyError={userStatsError || historyError}
      onClose={() => setShowScoreDetails(false)}
    />
  );

  // ---- screens ----
  if (quizState === "settings") {
    return (
      <>
        <div className="max-w-7xl mx-auto mt-3 sm:mt-6 px-3 sm:px-6 lg:px-8 pb-10 grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Dashboard: left on desktop, below the settings on phones */}
          <section className="order-2 lg:order-1 min-w-0">
            {userError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded">
                Error loading user profile
              </div>
            )}
            <PerformanceDashboard
              user={user}
              userLoading={userLoading}
              stats={userStats}
              progress={progress}
              recent={historyList}
              loading={userStatsLoading}
              onViewHistory={handleViewHistory}
            />
          </section>

          {/* Start panel: right on desktop, fits the screen height so Start is always visible */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto self-start min-w-0 space-y-3 rounded-xl">
            {saved && <ResumeCard saved={saved} onResume={handleResumeSaved} onDiscard={handleDiscardSaved} />}
            {error && <ErrorDisplay error={error} onRetry={handleQuitQuiz} />}
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
          </aside>
        </div>
        {scoreModal}
      </>
    );
  }

  if (isQuestionsLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4 sm:px-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">
          Preparing your quiz{user ? `, ${user.first_name}` : ""}...
        </p>
        <button
          onClick={handleViewHistory}
          className="mt-4 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 py-2.5 px-4 rounded-lg transition-colors duration-200"
        >
          View History While Waiting
        </button>
        {scoreModal}
      </div>
    );
  }

  if (quizState === "results" && results) {
    return (
      <div className="max-w-2xl mx-auto mt-4 sm:mt-10 px-3 sm:px-6 pb-10">
        {/* shows e.g. "No questions found" if the next quiz could not be loaded */}
        {error && <ErrorDisplay error={error} />}
        <ScoreDisplay
          results={results}
          onRetry={handleQuitQuiz}
          averageScore={Number(userStats?.average_score || statsData?.average_score || 0)}
          onViewDetails={toggleScoreDetails}
          onNext={nextRun ? handleNextQuiz : undefined}
          nextLabel={nextLabel}
          nextLoading={isQuestionsLoading}
        />
        {scoreModal}
      </div>
    );
  }

  if (!Array.isArray(questions) || safeQuestions.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
        <ErrorDisplay error="No questions available. Please try different settings." />
        <button
          onClick={handleQuitQuiz}
          className="mt-4 w-full sm:w-auto bg-blue-600 dark:bg-blue-700 text-white py-2.5 px-4 rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-200"
        >
          Back to Settings
        </button>
      </div>
    );
  }

  const isLastPage = currentPage >= totalPages;

  // Paused: questions hidden, clock frozen
  if (timer.paused) {
    return (
      <div className="max-w-2xl mx-auto mt-3 sm:mt-6 px-3 sm:px-6 pb-6">
        <QuizHeader
          totalQuestions={totalQ}
          answeredCount={answeredCount}
          onQuit={handleQuitQuiz}
          userName={user?.first_name}
          setInfo={metadata?.set_info}
          timeLeft={timer.remaining}
          totalSeconds={totalSeconds}
        />
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <div className="text-4xl mb-2">⏸</div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Quiz paused</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {answeredCount} / {totalQ} answered
            {timer.remaining !== null ? ` · ${formatTime(timer.remaining)} left` : ""}
          </p>
          {syncLabel && <p className="mt-1 text-[11px] text-gray-400">{syncLabel}</p>}
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={timerResume}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={handleSaveExit}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Save &amp; exit (resume on any device)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-3 sm:mt-6 px-3 sm:px-6 pb-4">
      <QuizHeader
        totalQuestions={totalQ}
        answeredCount={answeredCount}
        onQuit={handleQuitQuiz}
        userName={user?.first_name}
        setInfo={metadata?.set_info}
        perPage={questionsPerPage}
        onPerPageChange={(n) => {
          setQuestionsPerPage(n);
          setCurrentPage(1);
        }}
        timeLeft={timer.remaining}
        totalSeconds={totalSeconds}
        onPause={handlePause}
      />

      {syncLabel && <p className="-mt-2 mb-3 text-right text-[11px] text-gray-400">{syncLabel}</p>}

      {error && <ErrorDisplay error={error} />}

      <QuestionsList
        questions={paginatedQuestions}
        answers={answers}
        onAnswerSelect={handleAnswerSelect}
      />

      {/* Session details (collapsed) */}
      {metadata && (
        <details className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 group">
          <summary className="cursor-pointer flex items-center justify-between gap-2 px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
            <span>Session details</span>
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="grid grid-cols-2 gap-3 text-xs px-3 pb-3">
            <div className="text-gray-500 dark:text-gray-400">
              Requested: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.requested_count}</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              Returned: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.returned_count}</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              Available: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.total_available}</span>
            </div>
            {metadata.set_info && (
              <>
                <div className="text-gray-500 dark:text-gray-400">
                  Per set: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.set_info.questions_per_set}</span>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  Current set: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.set_info.current_set}</span>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  Total sets: <span className="font-medium text-gray-800 dark:text-gray-200">{metadata.set_info.total_sets}</span>
                </div>
              </>
            )}
          </div>
        </details>
      )}

      {/* Nav bar: sticks to the bottom on mobile */}
      <div className="sticky bottom-0 z-10 -mx-3 sm:mx-0 mt-6 px-3 sm:px-0 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:static">
        {isLastPage && unanswered > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 text-center">
            {unanswered} unanswered. Unanswered questions score 0.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="min-h-[44px] bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors duration-200"
          >
            Previous
          </button>

          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Page {currentPage} / {Math.max(totalPages, 1)}
          </div>

          {!isLastPage ? (
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="min-h-[44px] bg-blue-600 dark:bg-blue-700 text-white py-2 px-6 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-200"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitQuiz}
              disabled={isEvaluationLoading}
              className="min-h-[44px] bg-green-600 dark:bg-green-700 text-white py-2 px-4 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-200"
            >
              {isEvaluationLoading ? "Submitting..." : "Submit Quiz"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <div className="quiz-root">
      <QuizPageInner />
    </div>
  );
}