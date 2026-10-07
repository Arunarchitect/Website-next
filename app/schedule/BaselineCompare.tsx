"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "./data";
import { durationDays, flatten, toDay } from "./scheduling";

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

function Var({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-400">—</span>;
  if (v === 0) return <span className="text-gray-500">0d</span>;
  return (
    <span
      className={
        v > 0 ? "font-semibold text-red-600" : "font-medium text-emerald-600"
      }
    >
      {v > 0 ? `+${v}d` : `${v}d`}
    </span>
  );
}

function Card({
  label,
  value,
  tone = "gray",
  sub,
}: {
  label: string;
  value: string;
  tone?: "gray" | "red" | "green" | "amber";
  sub?: string;
}) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;
  return (
    <div className={`rounded border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

/**
 * Baseline vs planned. `tasks` should be the ROLLED task list so group rows
 * already carry derived dates.
 * Variance = planned date − baseline date (days). + = later than baseline.
 */
export default function BaselineCompare({
  tasks,
  onClose,
  onJump,
}: {
  tasks: Task[];
  onClose: () => void;
  onJump?: (id: string) => void;
}) {
  const [changedOnly, setChangedOnly] = useState(true);
  const [sortBySlip, setSortBySlip] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(
    () =>
      flatten(tasks, new Set()).map(({ task, depth, hasChildren, wbs }) => {
        const has = !!task.baselineStart && !!task.baselineFinish;
        const sv = has
          ? toDay(task.scheduleStart) - toDay(task.baselineStart!)
          : null;
        const fv = has
          ? toDay(task.scheduleFinish) - toDay(task.baselineFinish!)
          : null;
        const baseDur = has
          ? toDay(task.baselineFinish!) - toDay(task.baselineStart!) + 1
          : null;
        const dc = baseDur === null ? null : durationDays(task) - baseDur;
        return { task, depth, hasChildren, wbs, has, sv, fv, dc };
      }),
    [tasks]
  );

  const summary = useMemo(() => {
    const leaves = rows.filter((r) => !r.hasChildren);
    const withBase = leaves.filter((r) => r.has);
    const late = withBase.filter((r) => (r.fv ?? 0) > 0).length;
    const early = withBase.filter((r) => (r.fv ?? 0) < 0).length;
    const shifted = withBase.filter(
      (r) => r.fv === 0 && (r.sv ?? 0) !== 0
    ).length;
    const unchanged = withBase.length - late - early - shifted;
    const noBase = leaves.length - withBase.length;

    const all = rows.filter((r) => r.has);
    let baseFinish: string | null = null;
    let planFinish: string | null = null;
    let baseStart: string | null = null;
    let planStart: string | null = null;
    for (const r of all) {
      const t = r.task;
      if (!baseFinish || t.baselineFinish! > baseFinish)
        baseFinish = t.baselineFinish!;
      if (!planFinish || t.scheduleFinish > planFinish)
        planFinish = t.scheduleFinish;
      if (!baseStart || t.baselineStart! < baseStart)
        baseStart = t.baselineStart!;
      if (!planStart || t.scheduleStart < planStart)
        planStart = t.scheduleStart;
    }
    const slip =
      baseFinish && planFinish ? toDay(planFinish) - toDay(baseFinish) : null;
    const worst = withBase.reduce(
      (m, r) => ((r.fv ?? 0) > (m?.fv ?? 0) ? r : m),
      null as (typeof withBase)[number] | null
    );
    return {
      late,
      early,
      shifted,
      unchanged,
      noBase,
      baseFinish,
      planFinish,
      baseStart,
      planStart,
      slip,
      worst: worst && (worst.fv ?? 0) > 0 ? worst : null,
      any: withBase.length > 0,
    };
  }, [rows]);

  const shown = useMemo(() => {
    let r = rows;
    if (changedOnly)
      r = r.filter(
        (x) => !x.has || (x.sv ?? 0) !== 0 || (x.fv ?? 0) !== 0 || (x.dc ?? 0) !== 0
      );
    if (sortBySlip)
      r = [...r].sort((a, b) => (b.fv ?? -9999) - (a.fv ?? -9999));
    return r;
  }, [rows, changedOnly, sortBySlip]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-800">
            Baseline vs planned
          </h2>
          <button
            onClick={onClose}
            className="rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!summary.any ? (
          <div className="p-6 text-sm text-gray-600">
            No baseline has been set yet. Use <b>Set baseline</b> in the header
            to freeze the current planned dates, then compare after the plan
            changes.
          </div>
        ) : (
          <>
            <div className="grid gap-2 border-b bg-gray-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
              <Card
                label="Project finish"
                value={summary.planFinish ? fmt(summary.planFinish) : "—"}
                sub={`Baseline ${summary.baseFinish ? fmt(summary.baseFinish) : "—"}`}
              />
              <Card
                label="Project slip"
                value={
                  summary.slip === null
                    ? "—"
                    : summary.slip > 0
                      ? `+${summary.slip}d`
                      : `${summary.slip}d`
                }
                tone={
                  summary.slip === null || summary.slip === 0
                    ? "gray"
                    : summary.slip > 0
                      ? "red"
                      : "green"
                }
                sub="planned finish − baseline finish"
              />
              <Card
                label="Late"
                value={String(summary.late)}
                tone={summary.late > 0 ? "red" : "gray"}
                sub="activities finishing later"
              />
              <Card
                label="Early"
                value={String(summary.early)}
                tone={summary.early > 0 ? "green" : "gray"}
                sub="activities finishing earlier"
              />
              <Card
                label="Unchanged"
                value={String(summary.unchanged)}
                sub={
                  [
                    summary.shifted ? `${summary.shifted} shifted` : "",
                    summary.noBase ? `${summary.noBase} added after baseline` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "same dates as baseline"
                }
              />
            </div>

            {summary.worst && (
              <div className="border-b bg-red-50/60 px-4 py-1.5 text-xs text-red-800">
                Biggest slip: <b>{summary.worst.task.name}</b> finishes{" "}
                {summary.worst.fv}d after its baseline.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 border-b px-4 py-2 text-xs text-gray-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={changedOnly}
                  onChange={(e) => setChangedOnly(e.target.checked)}
                />
                Changed only
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={sortBySlip}
                  onChange={(e) => setSortBySlip(e.target.checked)}
                />
                Sort by biggest slip
              </label>
              <span className="ml-auto text-gray-500">
                {shown.length} of {rows.length} rows
              </span>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs">
                  <tr>
                    <th className="w-12 px-2 py-2">#</th>
                    <th className="min-w-[220px] px-2 py-2">Task</th>
                    <th className="px-2 py-2">Baseline start</th>
                    <th className="px-2 py-2">Planned start</th>
                    <th className="px-2 py-2 text-right">Start var</th>
                    <th className="px-2 py-2">Baseline finish</th>
                    <th className="px-2 py-2">Planned finish</th>
                    <th className="px-2 py-2 text-right">Finish var</th>
                    <th className="px-2 py-2 text-right">Duration Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(
                    ({ task, depth, hasChildren, wbs, has, sv, fv, dc }) => (
                      <tr
                        key={task.id}
                        onClick={() => onJump?.(task.id)}
                        className={`border-t ${
                          onJump ? "cursor-pointer hover:bg-gray-50" : ""
                        } ${(fv ?? 0) > 0 ? "bg-red-50/30" : ""}`}
                      >
                        <td className="px-2 py-1.5 font-mono text-xs text-gray-500">
                          {wbs}
                        </td>
                        <td className="px-2 py-1.5">
                          <div
                            className="flex items-center gap-1"
                            style={{ paddingLeft: sortBySlip ? 0 : depth * 14 }}
                          >
                            <span className={hasChildren ? "font-semibold" : ""}>
                              {task.name}
                            </span>
                            {!has && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                no baseline
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-xs text-gray-600">
                          {task.baselineStart ? fmt(task.baselineStart) : "—"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-xs">
                          {fmt(task.scheduleStart)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                          <Var v={sv} />
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-xs text-gray-600">
                          {task.baselineFinish ? fmt(task.baselineFinish) : "—"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-xs">
                          {fmt(task.scheduleFinish)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                          <Var v={fv} />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                          <Var v={dc} />
                        </td>
                      </tr>
                    )
                  )}
                  {shown.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-6 text-center text-sm text-gray-500"
                      >
                        Nothing has moved from the baseline.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}