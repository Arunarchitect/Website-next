"use client";

import { useEffect, useState } from "react";
import {
  emptyCalendar,
  isHoliday,
  type CalendarRange,
  type HolidayDate,
  type WorkingCalendar,
} from "./calendar";
import { fmtDate } from "./cpm";
import { toDay } from "./scheduling";

const WEEKDAYS = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
];

export function CalendarButton({
  calendar,
  onOpen,
}: {
  calendar: WorkingCalendar;
  onOpen: () => void;
}) {
  const weeklyCount = calendar.weekly.size;
  const holidaysCount = calendar.dates.length;
  const rangesCount = calendar.ranges.length;

  const summary =
    `${weeklyCount} weekly · ` +
    `${holidaysCount} single` +
    (rangesCount ? ` · ${rangesCount} ranges` : "");

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
      title="Configure working days, holidays and shutdowns"
      data-print-hide
    >
      <svg
        className="h-4 w-4 text-gray-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v1H2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm-4 6h16v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Zm4 3v2h2v-2H6Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z" />
      </svg>
      Calendar
      <span className="hidden text-[10px] text-gray-500 md:inline">{summary}</span>
    </button>
  );
}

export function CalendarModal({
  calendar,
  onChange,
  onClose,
}: {
  calendar: WorkingCalendar;
  onChange: (c: WorkingCalendar) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"weekly" | "dates" | "ranges">("weekly");

  const [newDate, setNewDate] = useState("");
  const [newDateName, setNewDateName] = useState("");

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeName, setRangeName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleWeekly = (v: number) => {
    const next = new Set(calendar.weekly);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange({ ...calendar, weekly: next });
  };

  const addDate = () => {
    if (!newDate) return;
    const holiday: HolidayDate = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newDateName.trim() || "Holiday",
      date: newDate,
    };
    onChange({ ...calendar, dates: [...calendar.dates, holiday] });
    setNewDate("");
    setNewDateName("");
  };

  const removeDate = (id: string) =>
    onChange({ ...calendar, dates: calendar.dates.filter((h) => h.id !== id) });

  const addRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const s = rangeStart;
    const e = rangeEnd < rangeStart ? rangeStart : rangeEnd;
    const range: CalendarRange = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: rangeName.trim() || "Shutdown",
      start: s,
      end: e,
    };
    onChange({ ...calendar, ranges: [...calendar.ranges, range] });
    setRangeStart("");
    setRangeEnd("");
    setRangeName("");
  };

  const removeRange = (id: string) =>
    onChange({ ...calendar, ranges: calendar.ranges.filter((r) => r.id !== id) });

  const reset = () => {
    if (window.confirm("Reset the working calendar to default (Sat + Sun off)?")) {
      onChange(emptyCalendar());
    }
  };

  const previewStats = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let workdays = 0;
    let holidays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (isHoliday(toDay(iso), calendar)) holidays++;
      else workdays++;
    }
    return {
      workdays,
      holidays,
      month: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
    };
  })();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-800">
            Working calendar
          </h2>
          <button
            onClick={onClose}
            className="rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b text-sm">
          {(
            [
              ["weekly", "Weekly off"],
              ["dates", "Specific dates"],
              ["ranges", "Shutdown ranges"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 ${
                tab === key
                  ? "border-b-2 border-blue-500 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          {tab === "weekly" && (
            <div>
              <p className="mb-3 text-xs text-gray-600">
                Days of the week that are <strong>never</strong> working days.
                These repeat every week.
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = calendar.weekly.has(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => toggleWeekly(d.v)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        on
                          ? "border-red-300 bg-red-100 text-red-800"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {on ? "✕ " : "✓ "}
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-gray-500">
                Click a day to toggle it. Red = off (holiday). Default is Sat + Sun.
              </p>
            </div>
          )}

          {tab === "dates" && (
            <div>
              <p className="mb-3 text-xs text-gray-600">
                Single-day holidays (festivals, national holidays, etc.).
              </p>
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 rounded border bg-gray-50 p-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="rounded border px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  value={newDateName}
                  onChange={(e) => setNewDateName(e.target.value)}
                  placeholder="Name (e.g. Diwali)"
                  className="rounded border px-2 py-1 text-xs"
                />
                <button
                  onClick={addDate}
                  disabled={!newDate}
                  className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="mt-3">
                {calendar.dates.length === 0 ? (
                  <p className="rounded border border-dashed px-3 py-6 text-center text-xs text-gray-500">
                    No holiday dates yet.
                  </p>
                ) : (
                  <ul className="divide-y rounded border">
                    {[...calendar.dates]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((h) => (
                        <li
                          key={h.id}
                          className="flex items-center justify-between px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="tabular-nums text-gray-500">
                              {fmtDate(toDay(h.date))}
                            </span>
                            <span className="font-medium text-gray-800">
                              {h.name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeDate(h.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "ranges" && (
            <div>
              <p className="mb-3 text-xs text-gray-600">
                Multi-day shutdowns (monsoon, festival weeks, site closures).
              </p>
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-2 rounded border bg-gray-50 p-2">
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="rounded border px-2 py-1 text-xs"
                />
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="rounded border px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  value={rangeName}
                  onChange={(e) => setRangeName(e.target.value)}
                  placeholder="Name (e.g. Onam)"
                  className="rounded border px-2 py-1 text-xs"
                />
                <button
                  onClick={addRange}
                  disabled={!rangeStart || !rangeEnd}
                  className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="mt-3">
                {calendar.ranges.length === 0 ? (
                  <p className="rounded border border-dashed px-3 py-6 text-center text-xs text-gray-500">
                    No shutdown ranges yet.
                  </p>
                ) : (
                  <ul className="divide-y rounded border">
                    {[...calendar.ranges]
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="tabular-nums text-gray-500">
                              {fmtDate(toDay(r.start))} → {fmtDate(toDay(r.end))}
                            </span>
                            <span className="font-medium text-gray-800">
                              {r.name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeRange(r.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 rounded border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
            <strong>{previewStats.month}:</strong> {previewStats.workdays} working
            days · {previewStats.holidays} non-working days.
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-gray-50 px-4 py-2.5">
          <button
            onClick={reset}
            className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            Reset to default
          </button>
          <button
            onClick={onClose}
            className="rounded bg-black px-4 py-1 text-sm text-white hover:bg-gray-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarChips({ calendar }: { calendar: WorkingCalendar }) {
  const wkOff = [...calendar.weekly]
    .sort()
    .map((v) => WEEKDAYS.find((w) => w.v === v)?.label)
    .filter(Boolean) as string[];

  if (
    wkOff.length === 0 &&
    calendar.dates.length === 0 &&
    calendar.ranges.length === 0
  ) {
    return (
      <span className="text-[11px] text-gray-500">
        No holidays — every day is a working day
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {wkOff.length > 0 && (
        <span
          className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700"
          title="Weekly non-working days"
        >
          Off: {wkOff.join(", ")}
        </span>
      )}
      {calendar.dates.length > 0 && (
        <span
          className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800"
          title="Specific date holidays"
        >
          {calendar.dates.length} holiday
          {calendar.dates.length === 1 ? "" : "s"}
        </span>
      )}
      {calendar.ranges.length > 0 && (
        <span
          className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-800"
          title="Shutdown ranges"
        >
          {calendar.ranges.length} shutdown
          {calendar.ranges.length === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}