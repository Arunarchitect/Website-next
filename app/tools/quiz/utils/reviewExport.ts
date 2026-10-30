// utils/reviewExport.ts
import { QuestionExplanation } from "../types/quiztypes";

export interface EnhancedQuestion {
  id: number;
  options: Record<string, string>; // normalized option text -> note
  extra_explanation?: string;
  key_concepts?: string[];
  memory_tip?: string;
}

export type EnhancedMap = Record<number, EnhancedQuestion>;

const STORE_KEY = "modelflick_quiz_study_v1";
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

const isSkipped = (e: QuestionExplanation) => !e.selected || e.selected === "Not answered";

/** Options as shown in review: stored options + the correct answer if it is missing */
export const buildOptions = (opts: string[] | undefined, correct: string): string[] => {
  const list = [...(opts ?? [])];
  if (correct && !list.some((o) => norm(o) === norm(correct))) list.push(correct);
  return list;
};

export const INSTRUCTIONS = [
  "You are helping me study. Below is my quiz result as JSON.",
  "Return the SAME JSON structure with these fields filled in, and nothing else (valid JSON only, no markdown fences, no commentary):",
  "1. For EVERY option in every question, fill the \"note\" field: if it is the correct option, say briefly why it is right; if it is wrong, say what that option/term actually means and why it does not fit this question.",
  "2. Fill \"extra_explanation\" with a deeper explanation than the existing \"explanation\" (reasoning, context, how to tell the options apart).",
  "3. Fill \"key_concepts\" with 2-5 short terms worth revising.",
  "4. Fill \"memory_tip\" with one short mnemonic or tip.",
  "Do NOT change \"id\", \"number\", \"text\", \"label\", \"is_correct\", \"is_user_pick\", or \"question\". Keep every question in the list.",
].join("\n");

export function buildExportJson(
  explanations: QuestionExplanation[],
  summary: { score: number; percentage: number; total: number; correct: number; wrong: number; skipped: number }
): string {
  const payload = {
    instructions: INSTRUCTIONS,
    summary,
    questions: explanations.map((e, i) => {
      const skipped = isSkipped(e);
      return {
        number: i + 1,
        id: e.id,
        question: e.question,
        status: e.is_correct ? "correct" : skipped ? "skipped" : "wrong",
        user_answer: skipped ? null : e.selected,
        correct_answer: e.correct,
        explanation: e.explanation || "",
        options: buildOptions(e.options, e.correct).map((o, k) => ({
          label: LETTERS[k] ?? String(k + 1),
          text: o,
          is_correct: norm(o) === norm(e.correct),
          is_user_pick: !skipped && norm(o) === norm(e.selected),
          note: "",
        })),
        extra_explanation: "",
        key_concepts: [],
        memory_tip: "",
      };
    }),
  };
  return JSON.stringify(payload, null, 2);
}

/** Parses pasted JSON (tolerates ```json fences). Throws Error with a readable message. */
export function parseEnhanced(text: string): EnhancedMap {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    throw new Error("Not valid JSON. Ask the AI to return only the JSON.");
  }
  const qs = (data as { questions?: unknown })?.questions;
  if (!Array.isArray(qs)) throw new Error('JSON has no "questions" list.');

  const out: EnhancedMap = {};
  qs.forEach((q: Record<string, unknown>) => {
    const id = Number(q?.id);
    if (!Number.isFinite(id)) return;
    const options: Record<string, string> = {};
    if (Array.isArray(q.options)) {
      (q.options as Array<Record<string, unknown>>).forEach((o) => {
        const note = typeof o?.note === "string" ? o.note.trim() : "";
        if (note && o?.text !== undefined) options[norm(o.text)] = note;
      });
    }
    out[id] = {
      id,
      options,
      extra_explanation: typeof q.extra_explanation === "string" ? q.extra_explanation.trim() : "",
      key_concepts: Array.isArray(q.key_concepts) ? (q.key_concepts as unknown[]).map(String) : [],
      memory_tip: typeof q.memory_tip === "string" ? q.memory_tip.trim() : "",
    };
  });
  if (Object.keys(out).length === 0) throw new Error("No questions with an id found.");
  return out;
}

export const loadEnhanced = (): EnhancedMap => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as EnhancedMap) : {};
  } catch {
    return {};
  }
};

export const saveEnhanced = (m: EnhancedMap) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(m));
  } catch {
    /* storage full or blocked: ignore */
  }
};

export const clearEnhanced = () => {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}