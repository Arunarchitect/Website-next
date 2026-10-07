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
import type { SerializedCalendar } from "./calendar";

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
   * Only meaningful when `status === "empty"` and the user can edit.
   * Never called automatically — an empty project stays empty until the
   * user explicitly asks for a new schedule.
   *
   * The created schedule is BLANK (no tasks/sequences); the default calendar
   * is still attached so weekend/holiday shading works out of the box.
   */
  createAndSeed: () => Promise<void>;
}

const debounceMs = 1500;

// Key-sorted JSON so Postgres jsonb reordering doesn't make the page think
// it's dirty right after a load or save.
function stableKey(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

// Cheap pre-flight: catch what the backend serializer would reject so we
// never send a payload that gets 400. Keeps the retry loop from starting.
function findPayloadProblem(tasks: Task[]): string | null {
  const seen = new Set<string>();
  for (const t of tasks) {
    if (seen.has(t.id)) return `Duplicate task id "${t.id}".`;
    seen.add(t.id);
    if (!t.scheduleStart || !t.scheduleFinish) {
      return `Task "${t.name || t.id}" is missing a start or finish date.`;
    }
    if (t.scheduleFinish < t.scheduleStart) {
      return `Task "${t.name || t.id}" finishes before it starts.`;
    }
  }
  return null;
}

// Drop sequences whose endpoints don't exist. Mirrors the backend's
// DocumentIn.validate() so an inconsistent local state never turns into a
// 400 on save.
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

  // ── LOAD ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    pausedRef.current = false;
    lastAttemptedRef.current = "";
    try {
      // Explicit schedule id (from the picker)
      if (scheduleId != null) {
        const doc = await getSchedule(scheduleId);
        const { sequences: cleanSeqs, removed } = pruneOrphanSequences(
          doc.tasks,
          doc.sequences
        );
        if (removed > 0) {
          console.warn(`[schedule] Pruned ${removed} orphan sequence(s) on load.`);
        }
        idRef.current = doc.id;
        verRef.current = doc.version;
        canEditRef.current = !!doc.canEdit;
        setCanEdit(!!doc.canEdit);
        const clean: ScheduleDoc = { ...doc, sequences: cleanSeqs };
        lastSavedRef.current = stableKey({
          tasks: clean.tasks,
          sequences: clean.sequences,
          calendar: clean.calendar,
        });
        onLoaded(clean);
        setStatus(doc.canEdit ? "saved" : "readonly");
        return;
      }

      // No schedule and no project → caller must show a picker
      if (projectId == null) {
        setStatus("empty");
        return;
      }

      const { canEdit: ce, results } = await listSchedules(projectId);
      setCanEdit(ce);
      canEditRef.current = ce;

      if (results.length === 0) {
        // ⚠️ NO AUTOMATIC SEEDING.
        // An empty project stays empty until the user explicitly calls
        // `createAndSeed()`.
        setStatus("empty");
        return;
      }

      const first: ScheduleListItem = results[0];
      const doc = await getSchedule(first.id);
      const { sequences: cleanSeqs, removed } = pruneOrphanSequences(
        doc.tasks,
        doc.sequences
      );
      if (removed > 0) {
        console.warn(`[schedule] Pruned ${removed} orphan sequence(s) on load.`);
      }
      idRef.current = doc.id;
      verRef.current = doc.version;
      const clean: ScheduleDoc = { ...doc, sequences: cleanSeqs };
      lastSavedRef.current = stableKey({
        tasks: clean.tasks,
        sequences: clean.sequences,
        calendar: clean.calendar,
      });
      onLoaded(clean);
      setStatus(ce ? "saved" : "readonly");
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
  }, [projectId, scheduleId, onLoaded]);

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
  // Only runs when the user explicitly asks. Creates a BLANK schedule —
  // no demo tasks, no demo sequences — and attaches it to the current
  // project. The default (empty) calendar is still uploaded so the schedule
  // starts with Sat+Sun off.
  const createAndSeed = useCallback(async () => {
    if (projectId == null) return;
    if (!canEditRef.current) return;
    setMessage(null);
    try {
      const created = await createSchedule(projectId, "Project Work Schedule");
      idRef.current = created.id;
      verRef.current = created.version;

      // ── Blank document ────────────────────────────────────────────────
      const blankTasks: Task[] = [];
      const blankSeqs: Sequence[] = [];
      const blankCalendar = seed.calendar; // default empty calendar

      const saved = await saveSchedule(created.id, {
        version: created.version,
        tasks: blankTasks,
        sequences: blankSeqs,
        calendar: blankCalendar,
      });
      verRef.current = saved.version;

      const doc: ScheduleDoc = {
        ...created,
        tasks: blankTasks,
        sequences: blankSeqs,
        calendar: blankCalendar,
        version: saved.version,
        canEdit: true,
      };
      lastSavedRef.current = stableKey({
        tasks: doc.tasks,
        sequences: doc.sequences,
        calendar: doc.calendar,
      });
      onLoaded(doc);
      setStatus("saved");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Failed to create schedule";
      setMessage(msg);
      setStatus("error");
    }
  }, [projectId, seed.calendar, onLoaded]);

  // ── SAVE ────────────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (idRef.current == null) return;
    if (!canEditRef.current) return;
    if (inflightRef.current) {
      queuedRef.current = true;
      return;
    }

    // Normalize before hashing — same normalization the effect uses.
    const { sequences: cleanSeqs } = pruneOrphanSequences(tasks, sequences);
    const payload = { tasks, sequences: cleanSeqs, calendar };
    const key = stableKey(payload);
    if (key === lastSavedRef.current) return;

    // Pre-flight: never send what the server will reject.
    const problem = findPayloadProblem(tasks);
    if (problem) {
      setMessage(problem);
      setStatus("dirty");
      return;
    }

    // Paused after a 400 on this exact payload — don't retry it.
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
    const key = stableKey({ tasks, sequences: cleanSeqs, calendar });
    if (key === lastSavedRef.current) return;
    if (pausedRef.current && key === lastAttemptedRef.current) return;

    const problem = findPayloadProblem(tasks);
    if (problem) {
      setMessage(problem);
      setStatus("dirty");
      return;
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
      lastSavedRef.current = stableKey({
        tasks: payload.tasks,
        sequences: cleanSeqs,
        calendar: payload.calendar,
      });
      lastAttemptedRef.current = "";
      pausedRef.current = false;
      setSavedAt(new Date().toISOString());
      setStatus("saved");
    },
    createAndSeed,
  };
}