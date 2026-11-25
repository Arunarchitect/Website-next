/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  fetchDeliverablesByProject,
  createDeliverable,
  bulkCreateDeliverables,
  renameDeliverable,
  mergeDeliverables,
  type MetaData,
  type DeliverableOption,
} from "@/app/new/manager_api";
import {
  DELIVERABLE_TEMPLATES,
  findSimilar,
  normName,
} from "@/app/new/deliverable_utils";

const T = {
  panel: "rgba(255,255,255,0.025)",
  panelB: "rgba(255,255,255,0.07)",
  panel2: "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.1)",
  divider: "rgba(255,255,255,0.06)",
  t2: "#f1f5f9",
  t3: "#94a3b8",
  t4: "#64748b",
  t5: "#475569",
  ac: "#6366f1",
  acLight: "rgba(99,102,241,0.12)",
  acMid: "rgba(99,102,241,0.55)",
  acText: "#818cf8",
  green: "#10b981",
  greenBg: "rgba(16,185,129,0.12)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.12)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.12)",
};

const inp: React.CSSProperties = {
  background: T.panel2,
  border: `1px solid ${T.panel2B}`,
  borderRadius: 7,
  padding: "8px 10px",
  fontSize: 12,
  color: T.t2,
  width: "100%",
  outline: "none",
  fontFamily: "'DM Sans',sans-serif",
  boxSizing: "border-box",
};
const sel: React.CSSProperties = {
  ...inp,
  cursor: "pointer",
  appearance: "none" as const,
};
const lbl: React.CSSProperties = {
  fontSize: 10,
  color: T.t5,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const btn = (
  bg: string,
  color: string,
  disabled = false,
): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontFamily: "'DM Sans',sans-serif",
});

const STAGES = ["1", "2", "3", "4", "5"];

function SimilarWarning({
  matches,
}: {
  matches: { item: DeliverableOption; kind: "same" | "similar" }[];
}) {
  if (!matches.length) return null;
  const hasSame = matches.some((m) => m.kind === "same");
  return (
    <div
      style={{
        background: T.amberBg,
        border: `1px solid rgba(245,158,11,0.35)`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 11,
        color: T.amber,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {hasSame
          ? "Same name already exists in this project"
          : "Similar deliverable already exists"}
      </div>
      {matches.slice(0, 5).map((m) => (
        <div key={m.item.id} style={{ color: "#fcd34d" }}>
          • {m.item.name}{" "}
          <span style={{ color: T.t4 }}>(Stage {m.item.stage})</span>
        </div>
      ))}
      <div style={{ marginTop: 4, color: T.t4 }}>
        If it`&apos;`s the same work, use Merge instead of creating another.
      </div>
    </div>
  );
}

export default function DeliverableManager({
  meta,
  onChanged,
}: {
  meta: MetaData;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(0);
  const [projId, setProjId] = useState(0);
  const [items, setItems] = useState<DeliverableOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  }

  // ── selection / merge ──
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [keepId, setKeepId] = useState(0);
  const [mergeName, setMergeName] = useState("");
  const [merging, setMerging] = useState(false);

  // ── rename ──
  const [renId, setRenId] = useState<number | null>(null);
  const [renVal, setRenVal] = useState("");
  const [renAck, setRenAck] = useState(false);

  // ── add one ──
  const [newName, setNewName] = useState("");
  const [newStage, setNewStage] = useState("1");
  const [dupAck, setDupAck] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── template ──
  const [tplId, setTplId] = useState(DELIVERABLE_TEMPLATES[0].id);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [showPick, setShowPick] = useState(false);
  const [applying, setApplying] = useState(false);

  async function load(pid: number) {
    if (!pid) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await fetchDeliverablesByProject(pid));
      setSelected(new Set());
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(projId);
  }, [projId]);

  useEffect(() => {
    setDupAck(false);
  }, [newName]);
  useEffect(() => {
    setRenAck(false);
  }, [renVal]);

  const projects = meta.projects.filter((p) => p.organisation_id === orgId);
  const selItems = items.filter((i) => selected.has(i.id));

  const grouped = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: s,
        rows: items
          .filter((i) => i.stage === s)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((g) => g.rows.length),
    [items],
  );

  // template preview
  const tpl = DELIVERABLE_TEMPLATES.find((t) => t.id === tplId)!;
  const existingNorm = useMemo(
    () => new Set(items.map((i) => normName(i.name))),
    [items],
  );
  const toAdd = tpl.items.filter((it) => !existingNorm.has(normName(it.name)));
  const skipCount = tpl.items.length - toAdd.length;

  // only the ticked items get added
  const chosen = toAdd.filter((it) => !unchecked.has(normName(it.name)));

  // as you type in "Add single", suggest matching items from ALL templates
  // that don't already exist in this project
  const tplSuggestions = useMemo(() => {
    const q = normName(newName);
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const pool: { id: number; name: string; stage: string }[] = [];
    DELIVERABLE_TEMPLATES.forEach((t) =>
      t.items.forEach((it) => {
        const k = normName(it.name);
        if (seen.has(k) || existingNorm.has(k)) return;
        seen.add(k);
        pool.push({ id: pool.length + 1, name: it.name, stage: it.stage });
      }),
    );
    const terms = q.split(" ");
    const out = pool.filter((p) => {
      const n = normName(p.name);
      return terms.every((t) => n.includes(t));
    });
    findSimilar(newName, pool).forEach((m) => {
      if (!out.some((o) => o.id === m.item.id)) out.push(m.item);
    });
    return out.slice(0, 6);
  }, [newName, existingNorm]);

  async function applyTemplate() {
    if (!projId || !chosen.length) return;
    setApplying(true);
    try {
      const r = await bulkCreateDeliverables(projId, chosen);
      setUnchecked(new Set());
      flash(
        true,
        `Added ${r.created.length}${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}.`,
      );
      await load(projId);
      onChanged?.();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setApplying(false);
    }
  }

  // add one
  const addMatches = useMemo(
    () => (newName.trim() ? findSimilar(newName, items) : []),
    [newName, items],
  );
  async function addOne() {
    if (!projId || !newName.trim()) return;
    if (addMatches.length && !dupAck) {
      setDupAck(true);
      return;
    }
    setAdding(true);
    try {
      const d = await createDeliverable({
        project: projId,
        name: newName.trim(),
        stage: newStage,
      });
      setItems((p) => [d, ...p]);
      setNewName("");
      setDupAck(false);
      flash(true, `Created "${d.name}".`);
      onChanged?.();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setAdding(false);
    }
  }
  async function addTemplateItem(it: { name: string; stage: string }) {
    if (!projId) return;
    setAdding(true);
    try {
      const d = await createDeliverable({
        project: projId,
        name: it.name,
        stage: it.stage,
      });
      setItems((p) => [d, ...p]);
      setNewName("");
      setDupAck(false);
      flash(true, `Created "${d.name}".`);
      onChanged?.();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setAdding(false);
    }
  }
  // rename
  const renMatches = useMemo(
    () => (renId && renVal.trim() ? findSimilar(renVal, items, renId) : []),
    [renId, renVal, items],
  );
  async function saveRename() {
    if (!renId || !renVal.trim()) return;
    if (renMatches.length && !renAck) {
      setRenAck(true);
      return;
    }
    try {
      const u = await renameDeliverable(renId, { name: renVal.trim() });
      setItems((p) =>
        p.map((i) => (i.id === renId ? { ...i, name: u.name } : i)),
      );
      setRenId(null);
      flash(true, "Renamed.");
      onChanged?.();
    } catch (e: any) {
      flash(false, e.message);
    }
  }

  // merge
  function toggleSel(id: number) {
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setMergeOpen(false);
  }
  function openMerge() {
    const first = selItems[0];
    if (!first) return;
    setKeepId(first.id);
    setMergeName(first.name);
    setMergeOpen(true);
  }
  async function doMerge() {
    if (!keepId || !mergeName.trim()) return;
    setMerging(true);
    try {
      const r = await mergeDeliverables({
        target: keepId,
        sources: selItems.filter((i) => i.id !== keepId).map((i) => i.id),
        name: mergeName.trim(),
      });
      flash(
        true,
        `Merged ${r.merged + 1} into "${r.deliverable.name}" (${r.worklogs} worklogs, ${r.assignments} assignments moved).`,
      );
      setMergeOpen(false);
      await load(projId);
      onChanged?.();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setMerging(false);
    }
  }

  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.panelB}`,
        borderRadius: 14,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "13px 16px",
          background: "transparent",
          border: "none",
          color: T.acText,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        Manage Deliverables
        <span style={{ fontSize: 10, color: T.t5, fontWeight: 400 }}>
          templates · rename · merge
        </span>
        <svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="none"
          style={{
            marginLeft: "auto",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* project picker */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <div style={lbl}>Organisation</div>
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(Number(e.target.value));
                  setProjId(0);
                }}
                style={sel}
              >
                <option value={0}>— select —</option>
                {meta.organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={lbl}>Project</div>
              <select
                value={projId}
                onChange={(e) => setProjId(Number(e.target.value))}
                style={sel}
                disabled={!orgId}
              >
                <option value={0}>— select —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {msg && (
            <div
              style={{
                fontSize: 12,
                padding: "7px 10px",
                borderRadius: 7,
                background: msg.ok ? T.greenBg : T.redBg,
                color: msg.ok ? T.green : T.red,
              }}
            >
              {msg.ok ? "✓ " : "⚠ "}
              {msg.text}
            </div>
          )}

          {!projId && (
            <div style={{ fontSize: 12, color: T.t5 }}>
              Select a project to manage its deliverables.
            </div>
          )}

          {projId > 0 && (
            <>
              {/* ── Template ── */}
              <div
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: `1px solid ${T.acMid}`,
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.acText,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Add from template
                </div>
                <select
                  value={tplId}
                  onChange={(e) => {
                    setTplId(e.target.value);
                    setUnchecked(new Set());
                  }}
                  style={sel}
                >
                  {DELIVERABLE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: T.t4 }}>
                  {tpl.description}.{" "}
                  <b style={{ color: T.t2 }}>{chosen.length}</b> of{" "}
                  {toAdd.length} selected
                  {skipCount > 0 && (
                    <>, {skipCount} already exist and are skipped</>
                  )}
                  .
                </div>

                {toAdd.length > 0 && (
                  <button
                    onClick={() => setShowPick((s) => !s)}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.acText,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    {showPick ? "▾ Hide list" : "▸ Choose which to add"}
                  </button>
                )}

                {showPick && toAdd.length > 0 && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => setUnchecked(new Set())}
                        style={{
                          background: "none",
                          border: "none",
                          color: T.acText,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Select all
                      </button>
                      <button
                        onClick={() =>
                          setUnchecked(
                            new Set(toAdd.map((i) => normName(i.name))),
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: T.t4,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Select none
                      </button>
                    </div>
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {toAdd.map((it) => {
                        const k = normName(it.name);
                        return (
                          <label
                            key={k}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                              fontSize: 12,
                              color: T.t2,
                              cursor: "pointer",
                              padding: "3px 0",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!unchecked.has(k)}
                              style={{ marginTop: 2 }}
                              onChange={() =>
                                setUnchecked((p) => {
                                  const n = new Set(p);
                                  n.has(k) ? n.delete(k) : n.add(k);
                                  return n;
                                })
                              }
                            />
                            <span style={{ flex: 1 }}>{it.name}</span>
                            <span
                              style={{
                                color: T.t5,
                                fontSize: 10,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Stage {it.stage}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={applyTemplate}
                  disabled={applying || loading || !chosen.length}
                  style={btn(
                    T.ac,
                    "#fff",
                    applying || loading || !chosen.length,
                  )}
                >
                  {applying
                    ? "Adding…"
                    : chosen.length
                      ? `Add ${chosen.length} deliverable${chosen.length > 1 ? "s" : ""}`
                      : "Nothing selected"}
                </button>
              </div>

              {/* ── Add one ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={lbl}>Add single deliverable</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px",
                    gap: 8,
                  }}
                >
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Deliverable name…"
                    style={inp}
                  />
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    style={sel}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        Stage {s}
                      </option>
                    ))}
                  </select>
                </div>
                <SimilarWarning matches={addMatches} />
                {tplSuggestions.length > 0 && (
                  <div
                    style={{
                      background: T.acLight,
                      border: `1px solid ${T.acMid}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: T.acText,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      From templates, click to add
                    </div>
                    {tplSuggestions.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => addTemplateItem(s)}
                        disabled={adding}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "transparent",
                          border: "none",
                          color: T.t2,
                          fontSize: 12,
                          padding: "4px 0",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        <span style={{ color: T.green, fontWeight: 700 }}>
                          +
                        </span>
                        <span style={{ flex: 1 }}>{s.name}</span>
                        <span style={{ color: T.t5, fontSize: 10 }}>
                          Stage {s.stage}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={addOne}
                  disabled={adding || !newName.trim()}
                  style={btn(
                    addMatches.length ? T.amberBg : T.greenBg,
                    addMatches.length ? T.amber : T.green,
                    adding || !newName.trim(),
                  )}
                >
                  {adding
                    ? "Creating…"
                    : addMatches.length
                      ? dupAck
                        ? "Create anyway"
                        : "Create (similar exists)"
                      : "Create"}
                </button>
              </div>

              {/* ── Merge bar ── */}
              {selItems.length >= 2 && (
                <div
                  style={{
                    background: T.panel2,
                    border: `1px solid ${T.panel2B}`,
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: T.t2 }}>
                      {selItems.length} selected
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          setSelected(new Set());
                          setMergeOpen(false);
                        }}
                        style={btn("transparent", T.t4)}
                      >
                        Clear
                      </button>
                      {!mergeOpen && (
                        <button
                          onClick={openMerge}
                          style={btn(T.acLight, T.acText)}
                        >
                          Merge…
                        </button>
                      )}
                    </div>
                  </div>
                  {mergeOpen && (
                    <>
                      <div style={lbl}>Keep which one?</div>
                      {selItems.map((i) => (
                        <label
                          key={i.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            color: T.t2,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="keep"
                            checked={keepId === i.id}
                            onChange={() => {
                              setKeepId(i.id);
                              setMergeName(i.name);
                            }}
                          />
                          {i.name}{" "}
                          <span style={{ color: T.t5, fontSize: 10 }}>
                            Stage {i.stage}
                          </span>
                        </label>
                      ))}
                      <div>
                        <div style={lbl}>Final name</div>
                        <input
                          value={mergeName}
                          onChange={(e) => setMergeName(e.target.value)}
                          style={inp}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: T.amber }}>
                        Worklogs, assignments and pins from the others move into
                        the kept one; the others are deleted. This cannot be
                        undone.
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={doMerge}
                          disabled={merging || !mergeName.trim()}
                          style={{
                            ...btn(T.ac, "#fff", merging || !mergeName.trim()),
                            flex: 1,
                          }}
                        >
                          {merging
                            ? "Merging…"
                            : `Merge ${selItems.length} into one`}
                        </button>
                        <button
                          onClick={() => setMergeOpen(false)}
                          style={btn("transparent", T.t4)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── List ── */}
              {loading ? (
                <div style={{ fontSize: 12, color: T.t5 }}>Loading…</div>
              ) : grouped.length === 0 ? (
                <div style={{ fontSize: 12, color: T.t5 }}>
                  No deliverables yet. Add from a template above.
                </div>
              ) : (
                grouped.map((g) => (
                  <div
                    key={g.stage}
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: T.t5,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        marginTop: 4,
                      }}
                    >
                      Stage {g.stage} · {g.rows.length}
                    </div>
                    {g.rows.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: selected.has(d.id) ? T.acLight : T.panel2,
                          border: `1px solid ${selected.has(d.id) ? T.acMid : T.panel2B}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSel(d.id)}
                          style={{ marginTop: 3 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {renId === d.id ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <input
                                autoFocus
                                value={renVal}
                                onChange={(e) => setRenVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRename();
                                  if (e.key === "Escape") setRenId(null);
                                }}
                                style={inp}
                              />
                              <SimilarWarning matches={renMatches} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={saveRename}
                                  style={btn(
                                    renMatches.length ? T.amberBg : T.greenBg,
                                    renMatches.length ? T.amber : T.green,
                                  )}
                                >
                                  {renMatches.length
                                    ? renAck
                                      ? "Save anyway"
                                      : "Save (similar exists)"
                                    : "Save"}
                                </button>
                                <button
                                  onClick={() => setRenId(null)}
                                  style={btn("transparent", T.t4)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: 12,
                                color: T.t2,
                                wordBreak: "break-word",
                              }}
                            >
                              {d.name}
                            </div>
                          )}
                        </div>
                        {renId !== d.id && (
                          <>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 20,
                                background: T.panel2B,
                                color: T.t4,
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {d.status?.replace("_", " ")}
                            </span>
                            <button
                              onClick={() => {
                                setRenId(d.id);
                                setRenVal(d.name);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: T.acText,
                                fontSize: 11,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              Rename
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
              {items.length > 1 && selItems.length < 2 && (
                <div style={{ fontSize: 11, color: T.t5 }}>
                  Tick 2 or more deliverables to merge them.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
