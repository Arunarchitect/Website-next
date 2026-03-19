// analysis/BarChart.tsx

import React from "react";
import { BARS, BORDER, MUTED, SURF, TEXT, TEXT2 } from "./tokens";

interface Props {
  data:      { label: string; hours: number }[];
  title:     string;
  colorIdx?: number;
}

export function BarChart({ data, title, colorIdx = 0 }: Props) {
  const max = Math.max(...data.map(d => d.hours), 1);
  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{title}</div>
      {data.length === 0
        ? <div style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "20px 0" }}>No data</div>
        : data.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: TEXT2, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>{d.label}</div>
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 99, height: 9, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(d.hours / max) * 100}%`, background: BARS[(colorIdx + i) % BARS.length], borderRadius: 99, transition: "width 0.5s ease", minWidth: d.hours > 0 ? 3 : 0 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, width: 34, textAlign: "right", flexShrink: 0 }}>{d.hours}h</div>
          </div>
        ))
      }
    </div>
  );
}
