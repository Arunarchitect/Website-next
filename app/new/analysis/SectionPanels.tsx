// analysis/SectionPanels.tsx
//
// Self-contained panels for Charts, Work Entries, Person Spends, Revenue.
// Each receives its data + state as props and renders accordingly.

import React from "react";
import { BarChart } from "./BarChart";
import { Bone, ChartRowSkeleton, RowSkeleton } from "./Skeletons";
import { SectionCard } from "./Atoms";
import { ACCENT, AMBER, BG, BORDER, GREEN, MUTED, SURF, TEXT, TEXT2 } from "./tokens";
import { formatINR, type WorkEntry, type PersonSpend } from "./analysisData";
import type { ChartsData, SectionState } from "./types";

// ── Charts panel ─────────────────────────────────────────
interface ChartsPanelProps {
  state:     SectionState;
  charts:    ChartsData | null;
  gran:      "day" | "month" | "year";
  onLoad:    () => void;
}

export function ChartsPanel({ state, charts, gran, onLoad }: ChartsPanelProps) {
  return (
    <SectionCard
      title="Charts"
      hint="Click Load Charts to visualise hours breakdown"
      onLoad={onLoad}
      loading={state === "loading"}
      loaded={state === "loaded"}
    >
      {state === "loading" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[85, 70, 55, 40].map((p, i) => (
            <div key={i} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
              <Bone h={10} w="50%" /><div style={{ height: 12 }} />
              {[p, p * 0.8, p * 0.6, p * 0.45].map((pct, j) => <ChartRowSkeleton key={j} pct={pct} />)}
            </div>
          ))}
        </div>
      )}
      {state === "loaded" && charts && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <BarChart data={charts.byPerson}      title="Hours · By Person"      colorIdx={0} />
          <BarChart data={charts.byProject}     title="Hours · By Project"     colorIdx={1} />
          <BarChart data={charts.byDeliverable} title="Hours · By Deliverable" colorIdx={2} />
          {gran !== "day" && charts.byDay.length > 0 && (
            <BarChart
              data={charts.byDay.map(d => ({ label: d.label.slice(5), hours: d.hours }))}
              title="Daily Trend"
              colorIdx={3}
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Work entries panel ───────────────────────────────────
interface WorkEntriesPanelProps {
  state:       SectionState;
  rows:        WorkEntry[];
  total:       number;
  page:        number;
  loadingMore: boolean;
  onLoad:      () => void;
  onLoadMore:  () => void;
}

export function WorkEntriesPanel({ state, rows, total, loadingMore, onLoad, onLoadMore }: WorkEntriesPanelProps) {
  const hasMore = rows.length < total;
  return (
    <SectionCard
      title="Work Entries"
      badge={state === "loaded" ? `${total} entries` : undefined}
      hint="Click Load Work Entries to see individual logs"
      onLoad={onLoad}
      loading={state === "loading"}
      loaded={state === "loaded"}
    >
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2, 3, 4].map(i => <RowSkeleton key={i} />)}
        </div>
      )}
      {state === "loaded" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map(w => (
              <div key={w.id} style={{ display: "grid", gridTemplateColumns: "85px 1fr 1fr 1fr 40px", gap: 8, alignItems: "center", background: BG, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <div style={{ color: TEXT2 }}>{w.date}</div>
                <div style={{ fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.person}</div>
                <div style={{ color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.projectName}</div>
                <div style={{ color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.deliverableName}</div>
                <div style={{ color: ACCENT, fontWeight: 700, textAlign: "right" }}>{w.hoursWorked}h</div>
              </div>
            ))}
          </div>
          {loadingMore && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <RowSkeleton /><RowSkeleton />
            </div>
          )}
          {hasMore && !loadingMore && (
            <button
              onClick={onLoadMore}
              style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 8, border: `1.5px solid ${BORDER}`, background: SURF, color: ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Load more ({total - rows.length} remaining)
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── Person spends panel ──────────────────────────────────
interface SpendsPanelProps {
  state:  SectionState;
  rows:   PersonSpend[];
  onLoad: () => void;
}

export function SpendsPanel({ state, rows, onLoad }: SpendsPanelProps) {
  return (
    <SectionCard
      title="Person Spends"
      badge={state === "loaded" ? `${rows.length} entries` : undefined}
      hint="Click Load Spends to see per-person expenditure"
      onLoad={onLoad}
      loading={state === "loading"}
      loaded={state === "loaded"}
    >
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2, 3].map(i => <RowSkeleton key={i} />)}
        </div>
      )}
      {state === "loaded" && (
        rows.length === 0
          ? <div style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "16px 0" }}>No spends in this period</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map(s => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "85px 95px 1fr 1fr 80px 80px", gap: 8, alignItems: "center", background: BG, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <div style={{ color: TEXT2 }}>{s.date}</div>
                <div style={{ fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.person.split(" ")[0]}</div>
                <div style={{ color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.projectName}</div>
                <div style={{ color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</div>
                <div style={{ textAlign: "right", fontWeight: 700, color: s.reimbursed ? GREEN : AMBER }}>{formatINR(s.amount)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: s.reimbursed ? "#dcfce7" : "#fef9c3", color: s.reimbursed ? GREEN : AMBER, textAlign: "center" }}>
                  {s.reimbursed ? "Reimburse" : "Own Cost"}
                </span>
              </div>
            ))}
          </div>
      )}
    </SectionCard>
  );
}

// ── Revenue panel ────────────────────────────────────────
interface RevenuePanelProps {
  state:        SectionState;
  rows:         ReturnType<typeof import("./analysisData").filterRevenue>;
  totalRevenue: number;
  onLoad:       () => void;
}

export function RevenuePanel({ state, rows, totalRevenue, onLoad }: RevenuePanelProps) {
  return (
    <SectionCard
      title="Revenue"
      badge={state === "loaded" ? `${rows.length} entries · ${formatINR(totalRevenue)}` : undefined}
      hint="Click Load Revenue to see payment records"
      onLoad={onLoad}
      loading={state === "loading"}
      loaded={state === "loaded"}
    >
      {state === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1].map(i => <RowSkeleton key={i} />)}
        </div>
      )}
      {state === "loaded" && (
        rows.length === 0
          ? <div style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "16px 0" }}>No revenue in this period</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: BG, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                <div style={{ color: TEXT2, flexShrink: 0, width: 82 }}>{r.date}</div>
                <div style={{ flex: 1, color: TEXT, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.projectName} · {r.from}</div>
                <div style={{ fontSize: 10, color: "#fff", background: GREEN, borderRadius: 4, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>{r.type}</div>
                <div style={{ fontWeight: 800, color: GREEN, flexShrink: 0 }}>{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
      )}
    </SectionCard>
  );
}
