"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Sequence, Task } from "./data";
import type { WorkingCalendar } from "./calendar";

export type Snap = {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkingCalendar;
};

export function useUndo({
  tasks,
  sequences,
  calendar,
  apply,
  limit = 100,
  coalesceMs = 400,
}: {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkingCalendar;
  apply: (s: Snap) => void;
  limit?: number;
  coalesceMs?: number;
}) {
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const last = useRef<Snap | null>(null); // state at the last observed change
  const batchBase = useRef<Snap | null>(null); // state before the pending batch
  const timer = useRef<number | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const [, bump] = useState(0);

  const stopTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Close the pending batch: it becomes one undo step.
  const flush = useCallback(() => {
    stopTimer();
    if (batchBase.current) {
      past.current.push(batchBase.current);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
      batchBase.current = null;
      bump((n) => n + 1);
    }
  }, [limit]);

  // Observe changes.
  useEffect(() => {
    const cur: Snap = { tasks, sequences, calendar };
    const prev = last.current;
    if (!prev) {
      last.current = cur; // first state after mount / clear(): baseline
      return;
    }
    if (
      prev.tasks === tasks &&
      prev.sequences === sequences &&
      prev.calendar === calendar
    ) {
      return; // nothing changed (also true right after undo/redo)
    }
    if (!batchBase.current) batchBase.current = prev;
    last.current = cur;
    stopTimer();
    timer.current = window.setTimeout(flush, coalesceMs);
  }, [tasks, sequences, calendar, coalesceMs, flush]);

  useEffect(() => stopTimer, []);

  const undo = useCallback((): boolean => {
    flush();
    const snap = past.current.pop();
    if (!snap || !last.current) return false;
    future.current.push(last.current);
    last.current = snap; // so the observer sees "no change" after apply
    applyRef.current(snap);
    bump((n) => n + 1);
    return true;
  }, [flush]);

  const redo = useCallback((): boolean => {
    flush();
    const snap = future.current.pop();
    if (!snap || !last.current) return false;
    past.current.push(last.current);
    last.current = snap;
    applyRef.current(snap);
    bump((n) => n + 1);
    return true;
  }, [flush]);

  // Forget everything (use after loading a schedule from the server / import).
  const clear = useCallback(() => {
    stopTimer();
    past.current = [];
    future.current = [];
    batchBase.current = null;
    last.current = null; // next observed state becomes the new baseline
    bump((n) => n + 1);
  }, []);

  return {
    undo,
    redo,
    clear,
    canUndo: past.current.length > 0 || !!batchBase.current,
    canRedo: future.current.length > 0,
  };
}