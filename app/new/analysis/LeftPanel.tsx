// analysis/LeftPanel.tsx
//
// Contains only: Calendar, Year nav, Date Range picker.
// Person filters and Hourly Rates have been removed.

import React from "react";
import { Calendar } from "./Calendar";
import { ACCENT, BORDER, RED, SURF, TEXT, TEXT2, pad } from "./tokens";
import type { Granularity } from "./types";

interface Props {
  calYear:        number;
  calMonth:       number;
  gran:           Granularity;
  selDay:         string | null;
  fromDate:       string;
  toDate:         string;
  onMonthChange:  (y: number, m: number) => void;
  onYearChange:   (y: number) => void;
  onSelectDay:    (d: string) => void;
  onFromDate:     (v: string) => void;
  onToDate:       (v: string) => void;
  onClearRange:   () => void;
}

export function LeftPanel({
  calYear, calMonth, gran, selDay,
  fromDate, toDate,
  onMonthChange, onYearChange, onSelectDay,
  onFromDate, onToDate, onClearRange,
}: Props) {
  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
    fontSize: 12, fontFamily: "inherit", outline: "none",
    color: TEXT, background: SURF, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ paddingRight: 20, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Calendar */}
      <Calendar
        year={calYear}
        month={calMonth}
        selectedDay={gran === "day" && !fromDate && !toDate ? selDay : null}
        onSelectDay={onSelectDay}
        onMonthChange={onMonthChange}
      />

      {/* Year nav */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Year</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => onYearChange(calYear - 1)}
            style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: SURF, cursor: "pointer", fontSize: 16, color: TEXT2, fontFamily: "inherit" }}
          >‹</button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 15 }}>{calYear}</div>
          <button
            onClick={() => onYearChange(calYear + 1)}
            style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: SURF, cursor: "pointer", fontSize: 16, color: TEXT2, fontFamily: "inherit" }}
          >›</button>
        </div>
      </div>

      {/* Date range */}
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em" }}>Date Range</div>

        <div>
          <label style={{ fontSize: 10, color: TEXT2, fontWeight: 600, display: "block", marginBottom: 3 }}>FROM</label>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={e => onFromDate(e.target.value)}
            style={{ ...inputStyle, borderColor: fromDate ? ACCENT : BORDER }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, color: TEXT2, fontWeight: 600, display: "block", marginBottom: 3 }}>TO</label>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={e => onToDate(e.target.value)}
            style={{ ...inputStyle, borderColor: toDate ? ACCENT : BORDER }}
          />
        </div>

        {/* Validation hint */}
        {fromDate && toDate && fromDate > toDate && (
          <div style={{ fontSize: 11, color: RED, fontWeight: 600 }}>⚠ "From" must be before "To"</div>
        )}

        {/* Active range badge */}
        {fromDate && toDate && fromDate <= toDate && (
          <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, background: "#eff6ff", borderRadius: 6, padding: "4px 10px" }}>
            {fromDate} → {toDate}
          </div>
        )}

        {(fromDate || toDate) && (
          <button
            onClick={onClearRange}
            style={{ padding: "6px 0", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fef2f2", color: RED, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            ✕ Clear range
          </button>
        )}
      </div>
    </div>
  );
}
