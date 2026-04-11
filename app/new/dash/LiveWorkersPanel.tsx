"use client";
import { useState, useEffect, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_HOST;
function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface LiveEntry {
  user_id: number;
  user_name: string;
  org_name: string;
  org_id: number;
  role: string;
  is_active: boolean;
  current: {
    worklog_id: number;
    deliverable_name: string;
    project_name: string;
    org_name: string;
    start_time: string;
    elapsed_seconds: number;
    remarks: string;
  } | null;
  last: {
    worklog_id: number;
    deliverable_name: string;
    project_name: string;
    org_name: string;
    start_time: string;
    end_time: string | null;
  } | null;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LiveWorkersPanel({ orgId }: { orgId?: number }) {
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  const load = useCallback(async () => {
    const url = new URL(`${BASE}/api/v2/manager/worklogs/live/`);
    if (orgId) url.searchParams.set("org_id", String(orgId));
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  // Refresh from server every 30s
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  // Tick every second to update elapsed live
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const activeCount = entries.filter(e => e.is_active).length;

  if (loading) return (
    <div style={{ padding: "16px", fontSize: 12, color: "#999" }}>Loading…</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: activeCount > 0 ? "#1D9E75" : "#888" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Who`&apos;`s working now
        </span>
        <span style={{ fontSize: 10, color: "#999", background: "#F3F4F6", borderRadius: 99, padding: "1px 8px" }}>
          {activeCount} active · {entries.length - activeCount} idle
        </span>
        <button
          onClick={load}
          title="Refresh"
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#AAA", padding: 0 }}
        >↺</button>
      </div>

      {entries.length === 0 && (
        <div style={{ fontSize: 13, color: "#CCC", padding: "12px 0" }}>No members found.</div>
      )}

      {entries.map(entry => {
        const isActive = entry.is_active;
        const elapsed  = isActive && entry.current
          ? Math.floor((Date.now() - new Date(entry.current.start_time).getTime()) / 1000)
          : null;

        return (
          <div
            key={entry.user_id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px",
              background: isActive ? "#F0FDF4" : "#FAFAFA",
              border: `1px solid ${isActive ? "#BBF7D0" : "#E8E8E8"}`,
              borderLeft: `3px solid ${isActive ? "#22C55E" : "#D5D5D5"}`,
              borderRadius: "0 10px 10px 0",
              transition: "all 0.2s",
              opacity: isActive ? 1 : 0.75,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: isActive ? "#DCFCE7" : "#F0F0F0",
              border: `1.5px solid ${isActive ? "#22C55E" : "#D5D5D5"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
              color: isActive ? "#15803D" : "#999",
            }}>
              {initials(entry.user_name)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{entry.user_name}</span>
                {isActive
                  ? <span style={{ fontSize: 10, background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "1px 7px", fontWeight: 600 }}>● active</span>
                  : <span style={{ fontSize: 10, background: "#F3F4F6", color: "#999", borderRadius: 99, padding: "1px 7px" }}>idle</span>
                }
              </div>

              {isActive && entry.current ? (
                <>
                  <div style={{ fontSize: 12, color: "#333", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.current.deliverable_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                    {entry.org_name} · {entry.current.project_name}
                  </div>
                </>
              ) : entry.last ? (
                <div style={{ fontSize: 11, color: "#AAA", marginTop: 3 }}>
                  Last: {entry.last.deliverable_name} · {entry.last.project_name} · {timeAgo(entry.last.start_time)}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#CCC", marginTop: 3 }}>No recent activity</div>
              )}
            </div>

            {/* Elapsed */}
            {isActive && elapsed !== null && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                  {formatElapsed(elapsed + tick * 0)}
                </div>
                <div style={{ fontSize: 10, color: "#6EE7B7" }}>elapsed</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}