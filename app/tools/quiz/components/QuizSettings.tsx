import { useRef, useState } from "react";
import { Exam, Category } from "../types/quiztypes";
import QuestionUploader from "./QuestionUploader";
import { useDownloadQuestionsTemplateMutation, useUploadQuestionsCSVMutation } from "@/redux/features/quizApiSlice";
import { StartParams, formatTime } from "../utils/quizSession";

interface QuizSettingsProps {
  exams: Exam[];
  categories: Category[];
  // meta.random tells the page whether the set was random (used by "Next quiz")
  onStartQuiz: (params: StartParams, meta?: { random: boolean }) => void;
  isLoading: boolean;
  isCategoriesLoading?: boolean;
  currentExam?: number | null;
  currentCategory?: number | null;
  handleExamChange: (examId: number | null) => void;
}

const card = "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5";
const label = "text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400";
const PRESETS = [10, 20, 30, 50];
const TIMER_PRESETS = [0, 30, 60, 90, 120]; // seconds per question, 0 = off
const DEFAULT_TIMER = 60; // 1 minute per question
// Upper bound for random set pick. Set to roughly your smallest total_sets.
export const RANDOM_MAX = 20;

const timerLabel = (s: number) => (s === 0 ? "Off" : s < 60 ? `${s}s` : `${s / 60}m`);

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400"
      }`}
    >
      {children}
    </button>
  );
}

const stepBtn =
  "w-11 h-11 sm:w-9 sm:h-9 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 text-lg leading-none";

// text-base on mobile stops iOS Safari zooming the page on input focus
const numInput =
  "text-center text-base sm:text-sm font-semibold rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function QuizSettings({
  exams,
  categories,
  onStartQuiz,
  isLoading,
  isCategoriesLoading,
  handleExamChange,
}: QuizSettingsProps) {
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [questionCountInput, setQuestionCountInput] = useState("10");
  const [randomSet, setRandomSet] = useState(true);
  const [setNumber, setSetNumber] = useState(1);
  const [setNumberInput, setSetNumberInput] = useState("1");
  const [perQ, setPerQ] = useState(DEFAULT_TIMER); // seconds per question, 0 = untimed
  const [customTimer, setCustomTimer] = useState(false);
  const [customInput, setCustomInput] = useState("45");
  const [showUploader, setShowUploader] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSetOptions, setShowSetOptions] = useState(false); // set picker is tucked away by default
  const lastRandom = useRef<number | null>(null);
  const [downloadTemplate] = useDownloadQuestionsTemplateMutation();
  const [uploadCSV] = useUploadQuestionsCSVMutation();

  const rollSet = () => {
    let n = 1 + Math.floor(Math.random() * RANDOM_MAX);
    if (RANDOM_MAX > 1 && n === lastRandom.current) {
      n = (n % RANDOM_MAX) + 1; // avoid same set twice in a row
    }
    lastRandom.current = n;
    return n;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartQuiz(
      {
        count: questionCount,
        exam: selectedExam || undefined,
        category: selectedCategory || undefined,
        set_number: randomSet ? rollSet() : setNumber,
        timer_per_question: perQ > 0 ? perQ : undefined,
      },
      { random: randomSet }
    );
  };

  const applyCount = (n: number) => {
    const c = Math.max(1, Math.min(50, Math.round(n)));
    setQuestionCount(c);
    setQuestionCountInput(String(c));
  };

  const handleQuestionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuestionCountInput(value);
    if (value === "") return;
    const numValue = Number(value);
    if (!isNaN(numValue)) setQuestionCount(Math.max(1, Math.min(50, numValue)));
  };

  const handleQuestionCountBlur = () => {
    if (questionCountInput === "" || Number(questionCountInput) < 1 || isNaN(Number(questionCountInput))) {
      applyCount(10);
    } else {
      applyCount(Number(questionCountInput));
    }
  };

  // Timer
  const pickPreset = (s: number) => {
    setCustomTimer(false);
    setPerQ(s);
  };
  const pickCustom = () => {
    setCustomTimer(true);
    const n = Number(customInput);
    setPerQ(Number.isFinite(n) && n >= 5 ? Math.min(600, Math.round(n)) : 45);
  };
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setCustomInput(v);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 5) setPerQ(Math.min(600, Math.round(n)));
  };
  const handleCustomBlur = () => {
    const n = Number(customInput);
    const c = Number.isFinite(n) && n >= 5 ? Math.min(600, Math.round(n)) : 45;
    setCustomInput(String(c));
    setPerQ(c);
  };

  // Any manual set choice turns random off
  const applySet = (n: number) => {
    setRandomSet(false);
    setSetNumber(n);
    setSetNumberInput(String(n));
  };

  const handleSetNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRandomSet(false);
    setSetNumberInput(value);
    if (value === "" || value === "-") return;
    const numValue = Number(value);
    if (!isNaN(numValue) && Number.isInteger(numValue) && numValue !== 0) setSetNumber(numValue);
  };

  const handleSetNumberBlur = () => {
    if (randomSet) return;
    const n = Number(setNumberInput);
    if (setNumberInput === "" || setNumberInput === "-" || isNaN(n) || n === 0 || !Number.isInteger(n)) {
      applySet(1);
    }
  };

  // 0 is not a valid set: -1 (last) and 1 (first) are neighbours
  const prevSet = () => applySet(setNumber === 1 ? -1 : setNumber - 1);
  const nextSet = () => applySet(setNumber === -1 ? 1 : setNumber + 1);

  const setLabel = randomSet
    ? "Random set"
    : setNumber === 1
    ? "First set"
    : setNumber === -1
    ? "Last set"
    : setNumber > 0
    ? `${ordinal(setNumber)} set`
    : `${ordinal(-setNumber)} from last`;

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate().unwrap();
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "questions_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleUpload = async (formData: FormData) => {
    try {
      const response = await uploadCSV(formData).unwrap();
      return response;
    } catch (error) {
      throw error;
    }
  };

  if (showUploader) {
    return (
      <div className={card}>
        <QuestionUploader
          onBack={() => setShowUploader(false)}
          onDownloadTemplate={handleDownloadTemplate}
          onUpload={handleUpload}
        />
      </div>
    );
  }

  const examName = exams.find((e) => e.id === selectedExam)?.name;
  const catName = categories.find((c) => c.id === selectedCategory)?.name;
  const scope = catName || examName || "All exams";
  const totalTime = perQ > 0 ? formatTime(perQ * questionCount) : null;

  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Start a quiz</h2>
        <button
          type="button"
          onClick={() => setShowUploader(true)}
          className="ml-auto text-xs px-3 py-2 sm:py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Upload CSV
        </button>
        <button
          type="button"
          onClick={() => setShowInfo((s) => !s)}
          aria-label="How sets work"
          className="w-8 h-8 sm:w-7 sm:h-7 rounded-full border border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          i
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p>Questions are split into sets of your chosen size. Pick which set to take.</p>
          <p>Random picks a different set each time. 1 = first, 2 = second, -1 = last, -2 = second last.</p>
          <p>With &quot;All&quot; exams and categories, questions are spread evenly across categories.</p>
          <p>Timer: total time = time per question × number of questions. The quiz auto-submits at 0.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* Exam */}
        <div>
          <div className={`${label} mb-2`}>Exam</div>
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0">
            <Chip
              active={selectedExam === null}
              disabled={isLoading}
              onClick={() => {
                setSelectedExam(null);
                setSelectedCategory(null);
                handleExamChange(null);
              }}
            >
              All
            </Chip>
            {exams.map((exam) => (
              <Chip
                key={exam.id}
                active={selectedExam === exam.id}
                disabled={isLoading}
                onClick={() => {
                  setSelectedExam(exam.id);
                  setSelectedCategory(null);
                  handleExamChange(exam.id);
                }}
              >
                {exam.name}
              </Chip>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <div className={`${label} mb-2`}>Category</div>
          {!selectedExam ? (
            <p className="text-xs text-gray-400">Pick an exam to filter by category.</p>
          ) : isCategoriesLoading ? (
            <p className="text-xs text-gray-400">Loading categories...</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-28 sm:max-h-32 overflow-y-auto pr-1">
              <Chip active={selectedCategory === null} disabled={isLoading} onClick={() => setSelectedCategory(null)}>
                All
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  active={selectedCategory === c.id}
                  disabled={isLoading}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* Count */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={label}>Questions</div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={questionCountInput}
              onChange={handleQuestionCountChange}
              onBlur={handleQuestionCountBlur}
              disabled={isLoading}
              aria-label="Number of questions"
              className={`${numInput} w-16 py-1.5`}
            />
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={questionCount}
            onChange={(e) => applyCount(Number(e.target.value))}
            disabled={isLoading}
            className="w-full h-8 accent-blue-600"
          />
          <div className="flex gap-2 mt-1">
            {PRESETS.map((p) => (
              <Chip key={p} active={questionCount === p} disabled={isLoading} onClick={() => applyCount(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>

        {/* Timer (defaults to 1 min per question) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className={label}>Time per question</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {totalTime ? `Total ${totalTime}` : "Untimed"}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0">
            {TIMER_PRESETS.map((s) => (
              <Chip key={s} active={!customTimer && perQ === s} disabled={isLoading} onClick={() => pickPreset(s)}>
                {timerLabel(s)}
              </Chip>
            ))}
            <Chip active={customTimer} disabled={isLoading} onClick={pickCustom}>
              Custom
            </Chip>
          </div>
          {customTimer && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customInput}
                onChange={handleCustomChange}
                onBlur={handleCustomBlur}
                disabled={isLoading}
                aria-label="Seconds per question"
                className={`${numInput} w-20 py-2`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">seconds per question (5–600)</span>
            </div>
          )}
        </div>

        {/* Set (collapsed by default: Random is fine for most people) */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowSetOptions((s) => !s)}
            aria-expanded={showSetOptions}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className={label}>Set</span>
            <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {setLabel}
              <span className={`transition-transform ${showSetOptions ? "rotate-180" : ""}`}>▾</span>
            </span>
          </button>

          {showSetOptions && (
            <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <button type="button" className={stepBtn} onClick={prevSet} disabled={isLoading} aria-label="Previous set">
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="-?[0-9]*"
                  value={randomSet ? "" : setNumberInput}
                  placeholder="?"
                  onChange={handleSetNumberChange}
                  onBlur={handleSetNumberBlur}
                  disabled={isLoading}
                  aria-label="Set number"
                  className={`${numInput} w-16 py-2.5 sm:py-2`}
                />
                <button type="button" className={stepBtn} onClick={nextSet} disabled={isLoading} aria-label="Next set">
                  +
                </button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                <Chip active={randomSet} disabled={isLoading} onClick={() => setRandomSet(true)}>
                  Random
                </Chip>
                <Chip active={!randomSet && setNumber === 1} disabled={isLoading} onClick={() => applySet(1)}>
                  First
                </Chip>
                <Chip active={!randomSet && setNumber === -1} disabled={isLoading} onClick={() => applySet(-1)}>
                  Last
                </Chip>
              </div>
            </div>
          )}
        </div>

        {/* Footer: always visible (sticks to the bottom of the panel / screen) */}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 rounded-b-xl space-y-2 shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.15)]">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {questionCount} questions · {scope} · {setLabel.toLowerCase()}
            {totalTime ? ` · ${totalTime}` : ""}
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white text-base sm:text-sm font-semibold py-3.5 sm:py-3 transition-colors"
          >
            {isLoading ? "Loading..." : "Start Quiz"}
          </button>
        </div>
      </form>
    </div>
  );
}