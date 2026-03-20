// analysis/Skeletons.tsx

import React from "react";
import { BG, BORDER, SURF } from "./tokens";

export const shimmerStyle: React.CSSProperties = {
  background: "linear-gradient(90deg,#e8edf2 25%,#d4dbe4 50%,#e8edf2 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
  borderRadius: 8,
};

export function Bone({ h = 14, w = "100%" }: { h?: number; w?: number | string }) {
  return <div style={{ ...shimmerStyle, height: h, width: w, flexShrink: 0 }} />;
}

export function StatSkeleton() {
  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <Bone h={9} w="55%" />
      <Bone h={22} w="70%" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "85px 1fr 1fr 1fr 40px", gap: 8, background: BG, borderRadius: 8, padding: "10px 12px" }}>
      {[60, 100, 100, 100, 30].map((w, i) => <Bone key={i} h={11} w={w} />)}
    </div>
  );
}

export function ChartRowSkeleton({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <Bone h={10} w={90} />
      <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 99, height: 9, overflow: "hidden" }}>
        <div style={{ ...shimmerStyle, height: "100%", width: `${pct}%`, borderRadius: 99 }} />
      </div>
      <Bone h={10} w={28} />
    </div>
  );
}
