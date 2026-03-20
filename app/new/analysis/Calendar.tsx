// analysis/Calendar.tsx

import React from "react";
import { workEntries as ALL_WORK, revenueEntries as ALL_REV, personSpends as ALL_SPENDS } from "./analysisData";
import { ACCENT, BG, BORDER, DAY_LABELS, MONTH_NAMES, MUTED, SURF, TEXT, TEXT2, pad } from "./tokens";

function hasDayData(d: string) {
  return ALL_WORK.some(w => w.date === d)
    || ALL_REV.some(r => r.date === d)
    || ALL_SPENDS.some(s => s.date === d);
}

interface Props {
  year:          number;
  month:         number;
  selectedDay:   string | null;
  onSelectDay:   (d: string) => void;
  onMonthChange: (y: number, m: number) => void;
}

export function Calendar({ year, month, selectedDay, onSelectDay, onMonthChange }: Props) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const nav: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: SURF, cursor: "pointer", fontSize: 16, color: TEXT2,
    fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 12px", userSelect: "none" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => { let m = month - 1, y = year; if (m < 0) { m = 11; y--; } onMonthChange(y, m); }} style={nav}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: TEXT, letterSpacing: "-0.02em" }}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={() => { let m = month + 1, y = year; if (m > 11) { m = 0; y++; } onMonthChange(y, m); }} style={nav}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 3 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: MUTED, paddingBottom: 3, textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds  = `${year}-${pad(month + 1)}-${pad(d)}`;
          const sel = selectedDay === ds;
          const has = hasDayData(ds);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(ds)}
              style={{ width: "100%", aspectRatio: "1", borderRadius: 7, border: sel ? `2px solid ${ACCENT}` : "1.5px solid transparent", background: sel ? ACCENT : "transparent", color: sel ? "#fff" : TEXT, fontSize: 12, fontWeight: sel ? 700 : 400, cursor: "pointer", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", touchAction: "manipulation" }}
              onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = BG; }}
              onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {d}
              {has && !sel && (
                <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: ACCENT }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
