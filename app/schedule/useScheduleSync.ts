"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createSchedule,
  getSchedule,
  listSchedules,
  saveSchedule,
  type ScheduleDoc,
  type ScheduleListItem,
} from "./api";
import type { Sequence, Task } from "./data";
import { emptyCalendar, serialize, type SerializedCalendar } from "./calendar";

export type SyncStatus =
  | "loading"
  | "saved"
  | "dirty"
  | "saving"
  | "error"
  | "conflict"
  | "readonly"
  | "empty"
  | "failed";

export interface SeedPayload {
  tasks: Task[];
  sequences: Sequence[];
  calendar: SerializedCalendar;
}

export interface UseScheduleSyncOptions {
  /** Pick ONE of these. If scheduleId is set it wins. */
  projectId?: number | null;
  scheduleId?: number | null;
  seed: SeedPayload;
  tasks: Task[];
  sequences: Sequence[];
  calendar: SerializedCalendar;
  onLoaded: (d: ScheduleDoc) => void;
}

export interface UseScheduleSyncResult {
  status: SyncStatus;
  canEdit: boolean;
  savedAt: string | null;
  message: string | null;
  saveNow: () => void;
  reload: () => void;
  /** Adopt a version returned by an out-of-band write (e.g. JSON import). */
  setVersion: (v: number) => void;
  /** Mark a payload as saved without issuing a PUT (for out-of-band writes). */
  markSaved: (payload: {
    tasks: Task[];
    sequences: Sequence[];
    calendar: SerializedCalendar;
  }) => void;
  /**
   * Manually create a schedule for the current project and upload the seed.
   * Resolves to the new schedule id, or null on failure / no permission.
   */
  createAndSeed: () => Promise<number | null>;
}

const debounceMs = 1500;
const DEBUG_SYNC = true; // set false once the unsaved issue is gone

const DEFAULT_CAL: SerializedCalendar = serialize(emptyCalendar());

// Key-sorted JSON. null / undefined object fields are dropped so that
// "field: null" (server) and "field missing" (client) compare equal.
function stableKey(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          if (obj[k] !== null && obj[k] !== undefined) acc[k] = obj[k];
          return acc;
        }, {});
    }
    return val;
  });
}

// Server may return calendar = null; the page then uses the default calendar.
// Normalise so both sides of every comparison look identical.
function normCal(c: SerializedCalendar | null | undefined): SerializedCalendar {
  const base = c ?? DEFAULT_CAL;
  return {
    ...base,
    weekly: [...(base.weekly ?? [])].sort((a, b) => a - b),
    dates: base.dates ?? [],
    ranges: base.ranges ?? [],
  };
}

function makeKey(
  tasks: Task[],
  sequences: Sequence[],
  calendar: SerializedCalendar | null | undefined
): string {
  return stableKey({ tasks, sequences, calendar: normCal(calendar) });
}

// Pre-flight: ONLY things the backend serializer rejects (would be a 400).
function findPayloadProblem(tasks: Task[], sequences: Sequence[]): string | null {
  const seen = new Set<string>();
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    const label = t.name || t.id;
    if (seen.has(t.id)) return `Duplicate task id "${t.id}".`;
    seen.add(t.id);
    if (!t.scheduleStart || !t.scheduleFinish) {
      return `Task "${label}" is missing a start or finish date.`;
    }
    if (t.scheduleFinish < t.scheduleStart) {
      return `Task "${label}" finishes before it starts.`;
    }
    if (t.actualStart && t.actualFinish && t.actualFinish < t.actualStart) {
      return `Task "${label}": actual finish is before actual start.`;
    }
    if (
      t.baselineStart &&
      t.baselineFinish &&
      t.baselineFinish < t.baselineStart
    ) {
      return `Task "${label}": baseline finish is before baseline start.`;
    }
    if (t.parentId && !ids.has(t.parentId)) {
      return `Task "${label}" has an unknown parent.`;
    }
  }
  return null;
}

// Warn only (never blocks a save): completion-rule violations in the data.
function logCompletionWarnings(tasks: Task[], sequences: Sequence[]) {
  if (!DEBUG_SYNC) return;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const s of sequences) {
    const pred = byId.get(s.relatingTask);
    const succ = byId.get(s.relatedTask);
    if (pred && succ && succ.completion >= 100 && pred.completion < 100) {
      console.warn(
        `[sync] completion rule: "${succ.name}" is 100% but predecessor "${pred.name}" is ${pred.completion}% (not blocking save)`
      );
    }
  }
}

// Drop sequences whose endpoints don't exist.
function pruneOrphanSequences(
  tasks: Task[],
  sequences: Sequence[]
): { sequences: Sequence[]; removed: number } {
  const ids = new Set(tasks.map((t) => t.id));
  const kept = sequences.filter(
    (s) => ids.has(s.relatingTask) && ids.has(s.relatedTask)
  );
  return { sequences: kept, removed: sequences.length - kept.length };
}

// Debug: say what differs between the last saved state and the current one.
function logFirstDiff(savedKey: string, curKey: string) {
  try {
    const A = JSON.parse(savedKey || "{}");
    const B = JSON.parse(curKey);
    const ta: Task[] = A.tasks ?? [];
    const tb: Task[] = B.tasks ?? [];
    if (ta.length !== tb.length) {
      console.log("[sync] dirty, task count differs", ta.length, "vs", tb.length);
      return;
    }
    for (let i = 0; i < tb.length; i++) {
      if (JSON.stringify(ta[i]) !== JSON.stringify(tb[i])) {
        console.log("[sync] dirty, first diff: task", i, "saved:", ta[i], "now:", tb[i]);
        return;
      }
    }
    if (JSON.stringify(A.sequences) !== JSON.stringify(B.sequences)) {
      console.log("[sync] dirty, sequences differ", A.sequences?.length, B.sequences?.length);
      return;
    }
    console.log("[sync] dirty, calendar differs", A.calendar, B.calendar);
  } catch (e) {
    console.log("[sync] diff failed", e);
  }
}

export function useScheduleSync({
  projectId,
  scheduleId,
  seed,
  tasks,
  sequences,
  calendar,
  onLoaded,
}: UseScheduleSyncOptions): UseScheduleSyncResult {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [canEdit, setCanEdit] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const idRef = useRef<number | null>(null);
  const verRef = useRef<number>(0);
  const lastSavedRef = useRef<string>("");
  const lastAttemptedRef = useRef<string>("");
  const canEditRef = useRef(false);
  const queuedRef = useRef(false);
  const inflightRef = useRef(false);
  const pausedRef = useRef(false);
  const startedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const problemShownRef = useRef(false);
  const lastLoggedRef = useRef<string>("");

  // Keep the latest onLoaded in a ref so `load` / `createAndSeed` stay stable
  // even if the parent passes a new callback identity.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const applyLoadedDoc = useCallback((doc: ScheduleDoc, ce: boolean) => {
    const { sequences: cleanSeqs, removed } = pruneOrphanSequences(
      doc.tasks,
      doc.sequences
    );
    if (removed > 0) {
      console.warn(`[schedule] Pruned ${removed} orphan sequence(s) on load.`);
    }
    idRef.current = doc.id;
    verRef.current = doc.version;
    canEditRef.current = ce;
    setCanEdit(ce);
    const clean: ScheduleDoc = { ...doc, sequences: cleanSeqs };
    lastSavedRef.current = makeKey(
      clean.tasks,
      clean.sequences,
      clean.calendar as SerializedCalendar | null
    );
    problemShownRef.current = false;
    onLoadedRef.current(clean);
    setStatus(ce ? "saved" : "readonly");
  }, []);

  // ── LOAD ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    pausedRef.current = false;
    lastAttemptedRef.current = "";
    try {
      if (scheduleId != null) {
        const doc = await getSchedule(scheduleId);
        applyLoadedDoc(doc, !!doc.canEdit);
        return;
      }

      if (projectId == null) {
        setStatus("empty");
        return;
      }

      const { canEdit: ce, results } = await listSchedules(projectId);
      setCanEdit(ce);
      canEditRef.current = ce;

      if (results.length === 0) {
        idRef.current = null;
        setStatus("empty");
        return;
      }

      const first: ScheduleListItem = results[0];
      const doc = await getSchedule(first.id);
      applyLoadedDoc(doc, ce);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Unknown error";
      setMessage(msg);
      setStatus("failed");
    }
  }, [projectId, scheduleId, applyLoadedDoc]);

  useEffect(() => {
    const key = `sched:${scheduleId ?? "p" + projectId}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    idRef.current = null;
    verRef.current = 0;
    lastSavedRef.current = "";
    lastAttemptedRef.current = "";
    pausedRef.current = false;
    void load();
  }, [scheduleId, projectId, load]);

  // ── MANUAL "CREATE SCHEDULE" ────────────────────────────────────────────
  const createAndSeed = useCallback(async (): Promise<number | null> => {
    if (projectId == null) return null;
    if (!canEditRef.current) return null;
    setMessage(null);
    try {
      const created = await createSchedule(projectId, "Project Work Schedule");

      const saved = await saveSchedule(created.id, {
        version: created.version,
        tasks: seed.tasks,
        sequences: seed.sequences,
        calendar: seed.calendar,
      });

      idRef.current = created.id;
      verRef.current = saved.version;
      startedFor.current = `sched:${created.id}`;

      const doc: ScheduleDoc = {
        ...created,
        tasks: seed.tasks,
        sequences: seed.sequences,
        calendar: seed.calendar,
        version: saved.version,
        canEdit: true,
      };
      lastSavedRef.current = makeKey(doc.tasks, doc.sequences, seed.calendar);
      lastAttemptedRef.current = "";
      pausedRef.current = false;
      problemShownRef.current = false;
      onLoadedRef.current(doc);
      setSavedAt(new Date().toISOString());
      setStatus("saved");
      return created.id;
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to create schedule";
      setMessage(msg);
      setStatus("empty");
      return null;
    }
  }, [projectId, seed]);

  // ── SAVE ────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (idRef.current == null) return;
    if (!canEditRef.current) return;
    if (inflightRef.current) {
      queuedRef.current = true;
      return;
    }

    const { sequences: cleanSeqs } = pruneOrphanSequences(tasks, sequences);
    const key = makeKey(tasks, cleanSeqs, calendar);
    if (key === lastSavedRef.current) return;

    const problem = findPayloadProblem(tasks, cleanSeqs);
    if (problem) {
      problemShownRef.current = true;
      setMessage(problem);
      setStatus("dirty");
      return;
    }

    if (pausedRef.current && key === lastAttemptedRef.current) return;

    lastAttemptedRef.current = key;
    inflightRef.current = true;
    setStatus("saving");
    setMessage(null);
    try {
      const res = await saveSchedule(idRef.current, {
        version: verRef.current,
        tasks,
        sequences: cleanSeqs,
        calendar,
      });
      verRef.current = res.version;
      lastSavedRef.current = key;
      pausedRef.current = false;
      setSavedAt(res.updatedAt);
      setStatus("saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setStatus("conflict");
        setMessage("Someone else saved first. Reload to see their changes.");
      } else if (e instanceof ApiError && e.status === 400) {
        pausedRef.current = true;
        const detail =
          typeof e.body === "object" && e.body !== null
            ? Object.entries(e.body as Record<string, unknown>)
              .map(([k, v]) =>
                `${k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`
              )
              .join(" | ")
            : e.message;
        setMessage(`Invalid schedule — ${detail}`);
        setStatus("error");
      } else {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Save failed";
        setMessage(msg);
        setStatus("error");
      }
    } finally {
      inflightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void doSave();
      }
    }
  }, [tasks, sequences, calendar]);

  // Debounced autosave on change.
  useEffect(() => {
    if (
      status === "loading" ||
      status === "readonly" ||
      status === "conflict" ||
      status === "empty" ||
      status === "failed"
    ) {
      return;
    }

    const { sequences: cleanSeqs } = pruneOrphanSequences(tasks, sequences);
    const key = makeKey(tasks, cleanSeqs, calendar);
    if (key === lastSavedRef.current) {
      // back in sync: drop any stale pre-flight message
      if (problemShownRef.current) {
        problemShownRef.current = false;
        setMessage(null);
      }
      return;
    }
    if (pausedRef.current && key === lastAttemptedRef.current) return;

    const problem = findPayloadProblem(tasks, cleanSeqs);
    if (problem) {
      if (DEBUG_SYNC && lastLoggedRef.current !== "p:" + problem) {
        lastLoggedRef.current = "p:" + problem;
        console.warn("[sync] blocked:", problem);
      }
      problemShownRef.current = true;
      setMessage(problem);
      setStatus("dirty");
      return;
    }
    if (problemShownRef.current) {
      problemShownRef.current = false;
      setMessage(null);
    }

    if (DEBUG_SYNC && lastLoggedRef.current !== key) {
      lastLoggedRef.current = key;
      logFirstDiff(lastSavedRef.current, key);
      logCompletionWarnings(tasks, cleanSeqs);
    }

    setStatus((s) => (s === "saving" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tasks, sequences, calendar, doSave, status]);

  // Warn before unload while unsaved
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving" || status === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  return {
    status,
    canEdit,
    savedAt,
    message,
    saveNow: () => void doSave(),
    reload: () => void load(),
    setVersion: (v: number) => {
      verRef.current = v;
    },
    markSaved: (payload) => {
      const { sequences: cleanSeqs } = pruneOrphanSequences(
        payload.tasks,
        payload.sequences
      );
      lastSavedRef.current = makeKey(payload.tasks, cleanSeqs, payload.calendar);
      lastAttemptedRef.current = "";
      pausedRef.current = false;
      problemShownRef.current = false;
      setMessage(null);
      setSavedAt(new Date().toISOString());
      setStatus("saved");
    },
    createAndSeed,
  };
}