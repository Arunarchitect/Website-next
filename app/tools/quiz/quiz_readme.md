# Quiz Frontend (`app/tools/quiz`)

Next.js (App Router) + Redux Toolkit Query + Tailwind. Mobile-first, dark-mode aware.
Features: performance dashboard, set-based quizzes with random set, per-question timer, pause and resume on any device, detailed results and history.

## Screens (all in `page.tsx`)

| State | What shows |
|---|---|
| `settings` | `PerformanceDashboard` (left) + `ResumeCard` + `QuizSettings` (right, sticky on desktop) |
| loading | spinner while questions load |
| `in-progress` | `QuizHeader` + `QuestionsList` + sticky Previous/Next/Submit bar + sync label |
| paused | header + Resume / "Save & exit" card (questions hidden) |
| `results` | `ScoreDisplay` |
| modal | `ScoreDetailsModal` (bottom sheet on phones, dialog on desktop) |

`page.tsx` exports a wrapper that puts everything inside `<div className="quiz-root">`, so `quiz.css` applies to every screen.

## Files

```
app/tools/quiz/
  page.tsx                      screens, stats fetching, timer, autosave + server sync
  quiz.css                      shared layout safety net (zero-specificity :where rules)
  hooks/
    useQuiz.ts                  questions, answers, scoring, submit, restoreQuiz
    useQuizTimer.ts             countdown (end-timestamp based), pause / resume / stop
  utils/
    quizSession.ts              local backup, unsynced flag, server<->local merge, formatTime, StartParams
    quizUtils.ts                legacy helpers (shuffleArray, calculateScore)
  types/quiztypes.ts            shared types (ScoreRecord has quiz_session, is_primary)
  components/
    PerformanceDashboard.tsx    KPIs, trend, per-exam bars, weakest categories, recent attempts
    QuizSettings.tsx            exam/category chips, count, timer, set (random/first/last)
    QuizHeader.tsx              title, timer, pause, quit, progress, per-page chips
    ResumeCard.tsx              "Unfinished quiz" card
    QuestionList.tsx            wraps QuestionCard
    QuestionCard.tsx            one question + options (not restyled yet)
    ScoreDisplay.tsx            results: hero score, tiles, category bars, filterable review
    ScoreDetailsModal.tsx       history and breakdowns (number-safe)
    QuestionUploader.tsx        CSV upload UI
    ErrorDisplay.tsx
redux/features/quizApiSlice.ts  all endpoints incl. /attempt/ (get, save, delete)
```

## Data flow

1. Settings -> `handleStartQuiz(params)` -> `fetchQuestions` -> `POST /get-quiz/`.
2. Answers are stored as `answers["question_<id>"] = optionText`. Click the selected option again to deselect.
3. Submit (or timer hits 0) -> `submitAnswers` computes the score locally for the results screen, then `POST /evaluate/` (the server recomputes, saves, and deletes the saved attempt).
4. After results, stats queries are refetched: user stats, progress, by-exam, by-category, history.

## Scoring

+1 correct, -0.33 wrong, 0 unanswered. Percentage = raw score / question count x 100 and can be negative. Display values are clamped at 0; the results screen also shows the actual negative value.

## Timer

- Chosen in `QuizSettings` as seconds per question (Off, 30s, 1m, 1.5m, 2m, custom 5-600s).
- Total time = per-question seconds x number of questions, one countdown for the whole quiz.
- Auto-submits at 0. Header turns amber under 25% and red/pulsing under 60s or 10%.
- It is a pool, not a hard per-question limit.

## Pause and resume (cross-device)

The server is the source of truth. One unfinished quiz per user.

- **Saved to** `PUT /attempt/`: question IDs, answers, metadata, exam, category, total seconds, remaining seconds, paused flag.
- **When:** immediately on Pause and Save & exit; 1.5s after each answer; every 15s while running; when the tab is hidden.
- **Ordering:** server calls run one at a time (`enqueue` in `page.tsx`), so a late save can never undo a delete.
- **Local backup:** every save is also written to `localStorage` (`modelflick_quiz_session_v1`). A flag (`modelflick_quiz_unsynced_v1`) records when the last server save failed.
- **Loading:** on the settings screen the app waits for pending saves, then calls `GET /attempt/`.
  - Server has a quiz -> shown, newer of local/server wins by timestamp.
  - Server has none and local is synced -> stale local copy is dropped.
  - Server has none and local is unsynced -> local copy is kept.
  - Server unreachable -> local copy is used.
- **Resume** restores answers and starts the clock from the remaining seconds. The clock is frozen while you are away (for strict exam mode, store a deadline timestamp instead).
- **Clearing:** finish, quit, or discard deletes the server copy and the local copy.
- **Sync label** on the quiz screen: Saving / Saved / Offline.
- **Two devices at once:** last write wins. Do not leave the quiz running on both.

## Tunables

| Where | What |
|---|---|
| `QuizSettings.tsx` `RANDOM_MAX` | upper bound for the random set roll (set near your smallest `total_sets`) |
| `QuizSettings.tsx` `PRESETS`, `TIMER_PRESETS` | quick-pick chips |
| `tone()` in dashboard / modal / results | colour thresholds (70 green, 40 amber) |
| `useQuiz.ts` `getCategoryNameById` | hard-coded fallback category names |
| `page.tsx` `questionsPerPage` | default 5 |
| `page.tsx` debounce (1500 ms) and interval (15000 ms) | autosave cadence |

## Gotchas

- **Decimals can arrive as strings** (`"85.00"`). Always coerce with `Number()` before `.toFixed()`. `page.tsx`, the modal and the results screen already do.
- **History has several rows per quiz.** `/scores/` returns per-exam and per-category rows too. `page.tsx` keeps one row per `quiz_session` (primary preferred). This needs `quiz_session` and `is_primary` in `ScoreSerializer`.
- **"By exam" is empty** when quizzes are taken with "All exams" (saved with `exam=None`). Pick an exam to populate it.
- **"Recent activity" is the last 30 days** (backend `user_stats`). The dashboard KPI label must say "Last 30 days", not 7.
- **Stale build errors** (old stack traces after a fix): stop the dev server, delete `.next`, restart, hard reload.
- **Layout overflow on phones:** fix it in `quiz.css`, not per component.
- **500 from `/evaluate/` or `/scores/progress_over_time/`:** check the Django terminal. See the backend README.

## Run

```
npm install
npm run dev
```

Set the API base URL in `redux/services/apiSlice`.

## Not done yet

- `QuestionCard.tsx` still has the old option styling.
- Per-question hard time limit with auto-advance (only makes sense at 1 question per page).