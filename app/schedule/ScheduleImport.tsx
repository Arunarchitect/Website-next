"use client";

import { useRef, useState } from "react";
import { ApiError, importSchedule } from "./api";
import type { ScheduleDoc } from "./api";
import type { Sequence, Task } from "./data";

// ── The template that gets copied to the clipboard ──────────────────────
const JSON_TEMPLATE = `{
  "_instructions": [
    "Fill in tasks[] and sequences[]. Keep all field names as-is.",
    "id: any unique string (client id). Use short readable ids like 'a-excavation'.",
    "parentId: null for top-level, or the id of another task to nest under it.",
    "scheduleStart / scheduleFinish: ISO dates YYYY-MM-DD. Finish must be >= start.",
    "completion: 0-100. isMilestone: true for single-day markers.",
    "linkedElements: leave as [] unless you have IFC global ids.",
    "sequences[]: each entry links two task ids.",
    "  sequenceType: FINISH_START | START_START | FINISH_FINISH | START_FINISH",
    "  lagDays: integer; negative = lead.",
    "Group tasks (those with children) should NOT be linked — link leaves only.",
    "Delete this _instructions key before uploading if you want; the backend ignores unknown top-level keys."
  ],

  "calendar": {
    "weekly": [0, 6],
    "dates": [],
    "ranges": []
  },

  "tasks": [
    {
      "id": "g-phase1",
      "name": "Phase 1 — Substructure",
      "parentId": null,
      "scheduleStart": "2026-10-05",
      "scheduleFinish": "2026-10-30",
      "completion": 0,
      "isMilestone": false,
      "remarks": "",
      "workCode": "",
      "linkedElements": []
    },
    {
      "id": "a-excavation",
      "name": "Excavation",
      "parentId": "g-phase1",
      "scheduleStart": "2026-10-05",
      "scheduleFinish": "2026-10-12",
      "completion": 0,
      "isMilestone": false,
      "remarks": "Site cut to formation level",
      "workCode": "01-10",
      "linkedElements": []
    },
    {
      "id": "a-pcc",
      "name": "PCC bed",
      "parentId": "g-phase1",
      "scheduleStart": "2026-10-13",
      "scheduleFinish": "2026-10-16",
      "completion": 0,
      "isMilestone": false,
      "remarks": "",
      "workCode": "03-10",
      "linkedElements": []
    },
    {
      "id": "a-footing",
      "name": "Footing concrete",
      "parentId": "g-phase1",
      "scheduleStart": "2026-10-17",
      "scheduleFinish": "2026-10-24",
      "completion": 0,
      "isMilestone": false,
      "remarks": "",
      "workCode": "03-20",
      "linkedElements": []
    },
    {
      "id": "a-complete",
      "name": "Substructure complete",
      "parentId": "g-phase1",
      "scheduleStart": "2026-10-30",
      "scheduleFinish": "2026-10-30",
      "completion": 0,
      "isMilestone": true,
      "remarks": "",
      "workCode": "",
      "linkedElements": []
    }
  ],

  "sequences": [
    {
      "id": "s-exc-pcc",
      "relatingTask": "a-excavation",
      "relatedTask": "a-pcc",
      "sequenceType": "FINISH_START",
      "lagDays": 0
    },
    {
      "id": "s-pcc-footing",
      "relatingTask": "a-pcc",
      "relatedTask": "a-footing",
      "sequenceType": "FINISH_START",
      "lagDays": 1
    },
    {
      "id": "s-footing-milestone",
      "relatingTask": "a-footing",
      "relatedTask": "a-complete",
      "sequenceType": "FINISH_START",
      "lagDays": 0
    }
  ]
}
`;

interface Preview {
  tasks: number;
  sequences: number;
  hasCalendar: boolean;
  source: string;
  parsed: {
    tasks: Task[];
    sequences: Sequence[];
    calendar?: unknown;
  };
}

interface Props {
  scheduleId: number | null;
  canEdit: boolean;
  onImported: (doc: ScheduleDoc) => void;
}

type Tab = "file" | "paste";
type Rec = Record<string, unknown>;

export default function ScheduleImport({
  scheduleId,
  canEdit,
  onImported,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("paste");
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  console.log("[import] RENDER", {
    open,
    tab,
    pasteLen: pasteText.length,
    preview: preview ? `${preview.tasks}t/${preview.sequences}s` : null,
    error,
    busy,
    canEdit,
    scheduleId,
  });

  if (!canEdit || scheduleId == null) {
    console.log("[import] RENDER BAIL", { canEdit, scheduleId });
    return null;
  }

  const reset = () => {
    console.log("[import] reset()");
    setPreview(null);
    setError(null);
    setPasteText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeAll = () => {
    console.log("[import] closeAll()");
    reset();
    setOpen(false);
  };

  // ── Validate raw JSON text ────────────────────────────────────────────
  const validateText = (text: string, source: string): Preview | null => {
    console.log("[import] validateText() START", { source, len: text.length });
    console.log("[import] validateText() first 80:", text.slice(0, 80));
    console.log("[import] validateText() last 80:", text.slice(-80));

    // Sanitize common paste artifacts.
    const clean = text
      .replace(/^\uFEFF/, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    console.log("[import] validateText() after sanitize len:", clean.length);

    let raw: unknown;
    try {
      raw = JSON.parse(clean);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "parse error";
      console.error("[import] validateText() JSON.parse FAILED:", msg);
      setError(`Invalid JSON: ${msg}`);
      return null;
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      console.error("[import] validateText() top-level not an object");
      setError("Top-level JSON must be an object.");
      return null;
    }

    const parsed = raw as Rec;
    console.log("[import] validateText() parsed OK, top keys:", Object.keys(parsed));

    const rawTasks = parsed.tasks;
    const rawSequences = parsed.sequences;

    if (!Array.isArray(rawTasks)) {
      console.error("[import] validateText() tasks is not an array");
      setError("JSON must contain a 'tasks' array.");
      return null;
    }
    if (!Array.isArray(rawSequences)) {
      console.error("[import] validateText() sequences is not an array");
      setError("JSON must contain a 'sequences' array.");
      return null;
    }

    const taskList = rawTasks as Rec[];
    const seqList = rawSequences as Rec[];

    console.log(
      `[import] validateText() tasks=${taskList.length}, sequences=${seqList.length}`
    );

    const ids = new Set<string>();
    for (const t of taskList) {
      const tid = t?.id;
      if (typeof tid !== "string" || !tid) {
        console.error("[import] validateText() task missing id:", t);
        setError("Every task needs a non-empty string `id`.");
        return null;
      }
      if (ids.has(tid)) {
        console.error("[import] validateText() duplicate task id:", tid);
        setError(`Duplicate task id "${tid}".`);
        return null;
      }
      ids.add(tid);
    }

    const seqIds = new Set<string>();
    for (const s of seqList) {
      const sid = s?.id;
      if (typeof sid !== "string" || !sid) {
        console.error("[import] validateText() sequence missing id:", s);
        setError("Every sequence needs a non-empty string `id`.");
        return null;
      }
      if (seqIds.has(sid)) {
        console.error("[import] validateText() duplicate sequence id:", sid);
        setError(`Duplicate sequence id "${sid}".`);
        return null;
      }
      seqIds.add(sid);

      const a = s.relatingTask;
      const b = s.relatedTask;
      if (
        typeof a !== "string" ||
        typeof b !== "string" ||
        !ids.has(a) ||
        !ids.has(b)
      ) {
        console.error("[import] validateText() bad sequence endpoints:", sid, a, "→", b);
        setError(
          `Sequence "${sid}" references a task that doesn't exist in the file.`
        );
        return null;
      }
      if (a === b) {
        console.error("[import] validateText() self-link:", sid);
        setError(`Sequence "${sid}" links a task to itself.`);
        return null;
      }
    }

    const result: Preview = {
      tasks: taskList.length,
      sequences: seqList.length,
      hasCalendar: !!parsed.calendar,
      source,
      parsed: {
        tasks: rawTasks as Task[],
        sequences: rawSequences as Sequence[],
        calendar: parsed.calendar,
      },
    };
    console.log("[import] validateText() PASSED, returning preview:", {
      tasks: result.tasks,
      sequences: result.sequences,
      hasCalendar: result.hasCalendar,
    });
    return result;
  };

  const handleFile = async (file: File) => {
    console.log("[import] handleFile()", file.name, file.size);
    setError(null);
    setPreview(null);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Only .json files are accepted. Use the Paste tab for raw text.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File is larger than 5 MB.");
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setError("Couldn't read the file.");
      return;
    }

    const p = validateText(text, file.name);
    console.log("[import] handleFile() got preview:", !!p);
    if (p) setPreview(p);
  };

  const handlePasteValidate = () => {
    console.log("[import] handlePasteValidate() CLICKED");
    console.log("[import] handlePasteValidate() pasteText length:", pasteText.length);
    setError(null);
    setPreview(null);

    if (!pasteText.trim()) {
      console.warn("[import] handlePasteValidate() pasteText is empty");
      setError("Paste some JSON first.");
      return;
    }

    const p = validateText(pasteText, "pasted JSON");
    console.log("[import] handlePasteValidate() got preview:", !!p);
    if (p) {
      console.log("[import] handlePasteValidate() calling setPreview");
      setPreview(p);
    } else {
      console.warn("[import] handlePasteValidate() preview null — not setting");
    }
  };

  const copyTemplate = async () => {
    console.log("[import] copyTemplate()");
    try {
      await navigator.clipboard.writeText(JSON_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = JSON_TEMPLATE;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Couldn't copy — your browser blocked clipboard access.");
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const loadTemplateIntoPaste = () => {
    console.log("[import] loadTemplateIntoPaste() CLICKED");
    console.log("[import] JSON_TEMPLATE length:", JSON_TEMPLATE.length);
    setPasteText(JSON_TEMPLATE);
    setError(null);
    setPreview(null);
  };

  const doImport = async () => {
    console.log("[import] doImport() CLICKED", {
      hasPreview: !!preview,
      preview: preview ? { tasks: preview.tasks, sequences: preview.sequences } : null,
      scheduleId,
    });
    if (!preview || scheduleId == null) {
      console.warn("[import] doImport() bailing — no preview or no scheduleId");
      return;
    }
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      tasks: preview.parsed.tasks,
      sequences: preview.parsed.sequences,
    };
    if (preview.parsed.calendar) payload.calendar = preview.parsed.calendar;

    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const fileName = preview.source.endsWith(".json")
      ? preview.source
      : "pasted-schedule.json";
    const file = new File([blob], fileName, { type: "application/json" });

    try {
      console.log("[import] doImport() calling importSchedule", { scheduleId, fileName });
      const doc = await importSchedule(scheduleId, file);
      console.log("[import] doImport() SUCCESS, doc:", {
        id: doc.id,
        version: doc.version,
        tasks: doc.tasks.length,
        sequences: doc.sequences.length,
      });
      onImported(doc);
      closeAll();
    } catch (e) {
      console.error("[import] doImport() FAILED:", e);
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Import failed"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          console.log("[import] OPEN modal");
          setOpen(true);
        }}
        className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        title="Import a schedule from JSON (file or paste)"
        data-print-hide
      >
        Import JSON…
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-lg font-semibold">Import schedule from JSON</h2>
              <button
                onClick={closeAll}
                className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b px-5 pt-3 text-sm">
              <button
                onClick={() => {
                  setTab("paste");
                  reset();
                }}
                className={`-mb-px border-b-2 px-3 py-2 ${
                  tab === "paste"
                    ? "border-blue-500 font-medium text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                Paste JSON
              </button>
              <button
                onClick={() => {
                  setTab("file");
                  reset();
                }}
                className={`-mb-px border-b-2 px-3 py-2 ${
                  tab === "file"
                    ? "border-blue-500 font-medium text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                Upload file
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {tab === "file" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Choose a <code className="rounded bg-gray-100 px-1">.json</code>{" "}
                    file containing the schedule document.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Choose file…
                  </button>
                  {preview && preview.source !== "pasted JSON" && (
                    <p className="text-xs text-green-700">
                      Loaded <strong>{preview.source}</strong> — {preview.tasks}{" "}
                      tasks, {preview.sequences} sequences.
                    </p>
                  )}
                </div>
              )}

              {tab === "paste" && (
                <div className="space-y-3">
                  <div className="rounded border bg-blue-50/60 p-3 text-xs text-gray-700">
                    <p className="mb-2">
                      <strong>Workflow with an AI chatbot:</strong>
                    </p>
                    <ol className="ml-4 list-decimal space-y-1">
                      <li>Click <strong>Copy template</strong> below.</li>
                      <li>
                        Paste it into ChatGPT / Claude / Gemini with a prompt like:{" "}
                        <em>&quot;Fill in this schedule JSON for a 3-bedroom house, keeping all field names. Return only the JSON.&quot;</em>
                      </li>
                      <li>Copy the JSON the AI returns.</li>
                      <li>
                        Paste it into the textarea below and click{" "}
                        <strong>Validate</strong>.
                      </li>
                      <li>
                        If valid, click <strong>Import and replace</strong> to overwrite the current schedule.
                      </li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copyTemplate}
                      className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      {copied ? "✓ Copied template" : "Copy template"}
                    </button>
                    <button
                      onClick={loadTemplateIntoPaste}
                      className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      Load template into editor
                    </button>
                  </div>

                  <textarea
                    value={pasteText}
                    onChange={(e) => {
                      console.log("[import] textarea onChange, new len:", e.target.value.length);
                      setPasteText(e.target.value);
                      setPreview(null);
                      setError(null);
                    }}
                    placeholder="Paste JSON here…"
                    spellCheck={false}
                    className="h-64 w-full resize-y rounded border bg-gray-50 p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handlePasteValidate}
                      disabled={!pasteText.trim() || busy}
                      className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      Validate
                    </button>
                  </div>

                  {preview && preview.source === "pasted JSON" && (
                    <p className="text-xs text-green-700">
                      Valid — {preview.tasks} tasks, {preview.sequences} sequences.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              {preview && (
                <dl className="mt-4 grid grid-cols-2 gap-y-1 rounded border bg-gray-50 p-3 text-sm">
                  <dt className="text-gray-500">Source</dt>
                  <dd className="font-medium">{preview.source}</dd>
                  <dt className="text-gray-500">Tasks</dt>
                  <dd className="font-medium">{preview.tasks}</dd>
                  <dt className="text-gray-500">Sequences</dt>
                  <dd className="font-medium">{preview.sequences}</dd>
                  <dt className="text-gray-500">Calendar</dt>
                  <dd className="font-medium">
                    {preview.hasCalendar ? "included" : "not included (kept as-is)"}
                  </dd>
                </dl>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3">
              <p className="text-xs text-gray-500">
                Importing <strong>replaces</strong> the current schedule.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={closeAll}
                  disabled={busy}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doImport}
                  disabled={!preview || busy}
                  className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy ? "Importing…" : "Import and replace"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}