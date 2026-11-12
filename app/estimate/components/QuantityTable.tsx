"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { QuantityAdjust, QuantityCell, QuantityData } from "../types";
import {
  COL_COMBINED,
  COL_COMBINED_WASTE,
  COL_COUNT,
  COL_WASTE,
  QuantityPdfMeta,
  generateQuantityPdf,
} from "../quantityPdf";
import {
  Block,
  SortKey,
  adjustHeaders,
  compute,
  moveUnit,
  moveWithin,
  normAdjust,
  num,
  sortData,
  sortSpec,
} from "../quantityAdjust";

const NUMERIC = ["sum", "avg", "min", "max"];
const MAX_SORT = 5;

export const fmtNum = (v: QuantityCell | undefined, d = 2): string => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
};

const csvEsc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

interface Props {
  data: QuantityData;
  title: string;
  meta: QuantityPdfMeta;
  adjust?: QuantityAdjust | null;
  /** Provided only when the user may edit; persists merges, wastage, sort, order and headings. */
  onSave?: (a: QuantityAdjust) => Promise<void>;
}

export default function QuantityTable({ data: rawData, title, meta, adjust, onSave }: Props) {
  const initial = useRef(JSON.stringify(normAdjust(adjust)));
  const [adj, setAdj] = useState<QuantityAdjust>(() => normAdjust(adjust));

  // rows in display order: manual order -> multi-level sort -> merged rows gathered
  // (merges, wastage and PDF all work on this order)
  const data = useMemo(() => sortData(rawData, adj), [rawData, adj]);
  const { columns, rows, totals, final, decimals, show_count, grouped } = data;

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [printing, setPrinting] = useState(false);
  // columns the user has unticked in the header: left out of the PDF
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pct, setPct] = useState(adj.wastage.percent ? String(adj.wastage.percent) : "");
  const [mergeLabel, setMergeLabel] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const calc = useMemo(() => compute(data, adj), [data, adj]);
  const dirty = JSON.stringify(adj) !== initial.current;
  const selecting = panel && calc.hasFinal;
  const withWaste = calc.wasteOn;
  const hasMerge = calc.blocks.length > 0;

  const expandable = rows.some((r) => r.details && r.details.length > 0);
  const showCountCol = show_count && grouped;
  const finalCol = final ? columns.find((c) => c.key === final) : undefined;
  const unit = finalCol?.unit ? ` ${finalCol.unit}` : "";

  const toggle = (i: number) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const expandAll = () => setOpen(new Set(rows.map((_, i) => i)));
  const collapseAll = () => setOpen(new Set());

  const label = (c: QuantityData["columns"][number]) => (c.unit ? `${c.label} (${c.unit})` : c.label);
  const isNum = (role: string) => NUMERIC.includes(role);
  const cls = (c: QuantityData["columns"][number]) =>
    `${isNum(c.role) ? "est-q-num" : ""} ${c.key === final ? "est-q-final" : ""}`;

  const showTotal = adj.show_total !== false;

  // ── multi-level sort ─────────────────────────────────────────────────
  const levels: SortKey[] = useMemo(() => sortSpec(data, adj), [data, adj]);

  const setLevels = (lv: SortKey[]) => {
    setOpen(new Set()); // row positions change, so collapse
    setAdj((a) => ({ ...a, sort_by: lv.slice(0, MAX_SORT), sort: "none" }));
  };
  const addLevel = () => {
    const used = new Set(levels.map((l) => l.key));
    const c = columns.find((x) => !used.has(x.key));
    if (c && levels.length < MAX_SORT) setLevels([...levels, { key: c.key, dir: "asc" }]);
  };
  const changeLevelKey = (i: number, key: string) =>
    setLevels(levels.map((l, j) => (j === i ? { ...l, key } : l)));
  const changeLevelDir = (i: number, dir: "asc" | "desc") =>
    setLevels(levels.map((l, j) => (j === i ? { ...l, dir } : l)));
  const moveLevel = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= levels.length) return;
    const n = levels.slice();
    [n[i], n[j]] = [n[j], n[i]];
    setLevels(n);
  };
  const removeLevel = (i: number) => setLevels(levels.filter((_, j) => j !== i));

  /** Header click: make this column the main sort; clicking the main column cycles asc -> desc -> off. */
  const headerSort = (key: string) => {
    const cur = levels[0];
    if (cur && cur.key === key) {
      if (cur.dir === "asc") setLevels([{ key, dir: "desc" }, ...levels.slice(1)]);
      else setLevels(levels.slice(1));
    } else {
      setLevels([{ key, dir: "asc" }, ...levels.filter((l) => l.key !== key)]);
    }
  };
  const levelMark = (key: string) => {
    const i = levels.findIndex((l) => l.key === key);
    if (i < 0) return "";
    return ` ${levels[i].dir === "asc" ? "▲" : "▼"}${levels.length > 1 ? i + 1 : ""}`;
  };

  // ── manual row moves ─────────────────────────────────────────────────
  // Saves the current display order and drops the sort levels (a manual order and a sort cannot both rule).
  const applyOrder = (newKeys: string[] | null) => {
    if (!newKeys) return;
    const openKeys = Array.from(open, (i) => calc.keys[i]);
    setAdj((a) => ({ ...a, sort_by: [], sort: "none", order: newKeys }));
    setOpen(new Set(openKeys.map((k) => newKeys.indexOf(k)).filter((i) => i >= 0)));
  };
  const mvRow = (i: number, dir: -1 | 1) =>
    applyOrder(
      calc.blockAt[i]
        ? moveWithin(calc.keys, calc.blockAt, i, dir)
        : moveUnit(calc.keys, calc.blockAt, i, dir)
    );
  const mvBlock = (b: Block, dir: -1 | 1) => applyOrder(moveUnit(calc.keys, calc.blockAt, b.start, dir));
  const canUp = (i: number) => {
    const b = calc.blockAt[i];
    return b ? i > b.start : i > 0;
  };
  const canDown = (i: number) => {
    const b = calc.blockAt[i];
    return b ? i < b.end : i < rows.length - 1;
  };

  const toggleHide = (id: string) =>
    setHidden((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const hchk = (id: string) => (
    <input
      type="checkbox"
      className="est-q-hcheck"
      checked={!hidden.has(id)}
      onChange={() => toggleHide(id)}
      onClick={(e) => e.stopPropagation()}
      title="Tick to include this column in the PDF"
      aria-label="Include column in PDF"
    />
  );
  const dim = (id: string) => (hidden.has(id) ? { opacity: 0.45 } : undefined);

  const hd = adjustHeaders(data, adj, calc.percent);
  const wasteHead = hd.waste;
  const mergeCols = hasMerge ? (withWaste ? 2 : 1) : 0;
  const setLabel = (k: "waste_label" | "combined_label" | "combined_waste_label", v: string) =>
    setAdj((a) => ({ ...a, [k]: v.slice(0, 80) }));

  // ── selection / adjust actions ───────────────────────────────────────
  const toggleSel = (k: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allSelected = calc.keys.length > 0 && selected.size === calc.keys.length;

  const applyWastage = (toAll: boolean) => {
    const p = parseFloat(pct);
    if (!Number.isFinite(p) || p <= 0 || p > 100) return setNote("Enter a wastage between 0 and 100 %.");
    if (!toAll && selected.size === 0) return setNote("Tick the rows to apply wastage to, or use Apply to all.");
    setNote(null);
    setAdj((a) => ({
      ...a,
      wastage: {
        percent: Math.round(p * 100) / 100,
        all: toAll || selected.size === calc.keys.length,
        keys: toAll ? [] : Array.from(selected),
      },
    }));
  };

  const removeWastage = () => {
    setNote(null);
    setAdj((a) => ({ ...a, wastage: { percent: 0, all: false, keys: [] } }));
  };

  const addMerge = () => {
    const ids = calc.keys.map((k, i) => (selected.has(k) ? i : -1)).filter((i) => i >= 0);
    if (ids.length < 2) return setNote("Tick at least two rows to merge.");
    // rows do not need to be adjacent: sortData gathers them next to the first selected row
    if (ids.some((i) => calc.blockAt[i])) return setNote("Some of these rows are already in a merge.");
    setNote(null);
    setOpen(new Set()); // row positions change, so collapse
    setAdj((a) => ({
      ...a,
      merges: [
        ...a.merges,
        {
          id: Date.now().toString(36),
          label: mergeLabel.trim(),
          keys: ids.map((i) => calc.keys[i]),
        },
      ],
    }));
    setSelected(new Set());
    setMergeLabel("");
  };

  const removeMerge = (id: string) => {
    setOpen(new Set());
    setAdj((a) => ({ ...a, merges: a.merges.filter((m) => m.id !== id) }));
  };

  const resetAdj = () => {
    setAdj(JSON.parse(initial.current) as QuantityAdjust);
    setOpen(new Set());
    setNote(null);
  };

  const save = async () => {
    if (!onSave) return;
    try {
      setSaving(true);
      setNote(null);
      await onSave(adj);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
      setSaving(false);
    }
  };

  // ── export ───────────────────────────────────────────────────────────
  const exportCsv = () => {
    const head = [
      ...columns.map(label),
      ...(withWaste ? [wasteHead] : []),
      ...(showCountCol ? ["Rows"] : []),
      ...(hasMerge ? (withWaste ? [hd.combined, hd.combinedWaste] : [hd.combined]) : []),
    ];
    const lines = [head.map(csvEsc).join(",")];
    rows.forEach((r, i) => {
      const cells = columns.map((c) => String(r.cells[c.key] ?? ""));
      if (withWaste) cells.push(String(calc.eff[i]));
      if (showCountCol) cells.push(String(r.count));
      if (hasMerge) {
        const b = calc.blockAt[i];
        if (!b) {
          // unmerged row: its own value
          cells.push(String(calc.base[i]));
          if (withWaste) cells.push(String(calc.eff[i]));
        } else {
          const start = b.start === i;
          cells.push(start ? String(b.raw) : "");
          if (withWaste) cells.push(start ? String(b.value) : "");
        }
      }
      lines.push(cells.map(csvEsc).join(","));
    });
    const foot = columns.map((c, i) => (i === 0 ? "Total" : totals[c.key] != null ? String(totals[c.key]) : ""));
    if (withWaste) foot.push(String(calc.effTotal));
    if (showCountCol) foot.push(String(rows.reduce((s, r) => s + r.count, 0)));
    if (hasMerge) for (let k = 0; k < mergeCols; k++) foot.push("");
    if (showTotal) lines.push(foot.map(csvEsc).join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w.-]+/g, "_") || "quantities"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await generateQuantityPdf(meta, rawData, open, adj, hidden);
    } catch (e) {
      console.error("PDF export failed:", e);
      window.alert("Could not generate the PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const blockSpan = (start: number, end: number) => {
    let span = 0;
    for (let j = start; j <= end; j++) span += 1 + (open.has(j) ? rows[j].details?.length ?? 0 : 0);
    return span;
  };

  const usedKeys = new Set(levels.map((l) => l.key));

  return (
    <div className="est-tree">
      <div className="est-tree-toolbar">
        {expandable && (
          <>
            <button type="button" className="est-btn est-btn-sm" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="est-btn est-btn-sm" onClick={collapseAll}>
              Collapse
            </button>
          </>
        )}
        {calc.hasFinal && (
          <button
            type="button"
            className={`est-btn est-btn-sm ${panel ? "est-btn-primary" : ""}`}
            onClick={() => setPanel((v) => !v)}
          >
            <i className="ti ti-adjustments" /> Adjust{dirty ? " •" : ""}
          </button>
        )}
        <button type="button" className="est-btn est-btn-sm" onClick={exportCsv}>
          <i className="ti ti-download" /> Export CSV
        </button>
        <button type="button" className="est-btn est-btn-sm" onClick={handlePrint} disabled={printing}>
          <i className="ti ti-printer" /> {printing ? "Preparing…" : "Print PDF"}
        </button>
        {hidden.size > 0 && (
          <span className="est-hint">
            {hidden.size} column{hidden.size > 1 ? "s" : ""} left out of PDF{" "}
            <button type="button" className="est-btn est-btn-sm" onClick={() => setHidden(new Set())}>
              Show all
            </button>
          </span>
        )}
      </div>

      {selecting && (
        <div className="est-q-panel">
          <div className="est-q-panel-sec">
            <strong>Rows</strong>
            <div className="est-q-panel-row">
              <button type="button" className="est-btn est-btn-sm" onClick={() => setSelected(new Set(calc.keys))}>
                Select all
              </button>
              <button type="button" className="est-btn est-btn-sm" onClick={() => setSelected(new Set())}>
                Clear
              </button>
              <span className="est-hint">
                {selected.size} of {calc.keys.length} selected
              </span>
            </div>
            <span className="est-hint">
              Use the ▲ ▼ arrows on each row to move it. Rows in a merged group move only inside the group;
              the group has its own arrows. Moving a row switches the sort off.
            </span>
          </div>

          <div className="est-q-panel-sec">
            <strong>Wastage</strong>
            <div className="est-q-panel-row">
              <label className="est-q-pct">
                <input
                  inputMode="decimal"
                  value={pct}
                  placeholder="e.g. 5"
                  onChange={(e) => setPct(e.target.value)}
                />
                <span>%</span>
              </label>
              <button type="button" className="est-btn est-btn-sm" onClick={() => applyWastage(false)}>
                Apply to selected
              </button>
              <button type="button" className="est-btn est-btn-sm" onClick={() => applyWastage(true)}>
                Apply to all
              </button>
              {adj.wastage.percent > 0 && (
                <button type="button" className="est-btn est-btn-sm" onClick={removeWastage}>
                  Remove
                </button>
              )}
            </div>
            {withWaste && (
              <span className="est-hint">
                {adj.wastage.percent}% on {adj.wastage.all ? "all rows" : `${adj.wastage.keys.length} rows`}
              </span>
            )}
          </div>

          <div className="est-q-panel-sec">
            <strong>Merge rows</strong>
            <div className="est-q-panel-row">
              <input
                className="est-q-merge-label"
                value={mergeLabel}
                maxLength={80}
                placeholder="Label (optional), e.g. 4 inch total"
                onChange={(e) => setMergeLabel(e.target.value)}
              />
              <button type="button" className="est-btn est-btn-sm" onClick={addMerge}>
                Merge selected
              </button>
            </div>
            <span className="est-hint">Rows that are far apart are moved next to the first selected row.</span>
            {adj.merges.length > 0 && (
              <div className="est-q-chips">
                {adj.merges.map((m) => (
                  <span key={m.id} className="est-q-chip">
                    {m.label || `${m.keys.length} rows`}
                    <button type="button" onClick={() => removeMerge(m.id)} aria-label="Remove merge">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="est-q-panel-sec">
            <strong>Sort</strong>
            {levels.length === 0 && (
              <span className="est-hint">
                {adj.order && adj.order.length ? "Manual order." : "Original order."} Click a column heading or add a
                level.
              </span>
            )}
            {levels.map((l, i) => (
              <div key={l.key} className="est-q-panel-row est-q-sortlvl">
                <span className="est-q-sortno">{i === 0 ? "Sort by" : "Then by"}</span>
                <select value={l.key} onChange={(e) => changeLevelKey(i, e.target.value)}>
                  {columns
                    .filter((c) => c.key === l.key || !usedKeys.has(c.key))
                    .map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                </select>
                <select value={l.dir} onChange={(e) => changeLevelDir(i, e.target.value as "asc" | "desc")}>
                  <option value="asc">A to Z / low to high</option>
                  <option value="desc">Z to A / high to low</option>
                </select>
                <button
                  type="button"
                  className="est-q-mv"
                  disabled={i === 0}
                  onClick={() => moveLevel(i, -1)}
                  title="Higher priority"
                  aria-label="Higher priority"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="est-q-mv"
                  disabled={i === levels.length - 1}
                  onClick={() => moveLevel(i, 1)}
                  title="Lower priority"
                  aria-label="Lower priority"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="est-q-mv"
                  onClick={() => removeLevel(i)}
                  title="Remove this level"
                  aria-label="Remove sort level"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="est-q-panel-row">
              <button
                type="button"
                className="est-btn est-btn-sm"
                onClick={addLevel}
                disabled={levels.length >= MAX_SORT || levels.length >= columns.length}
              >
                + Add sort level
              </button>
              {levels.length > 0 && (
                <button type="button" className="est-btn est-btn-sm" onClick={() => setLevels([])}>
                  Clear sort
                </button>
              )}
            </div>
            {levels.length > 0 && adj.merges.length > 0 && (
              <span className="est-hint">Merged rows are sorted inside their block, and the block is placed by its first row.</span>
            )}
          </div>

          <div className="est-q-panel-sec">
            <strong>Display</strong>
            <div className="est-q-panel-row">
              <label>
                <input
                  type="checkbox"
                  checked={showTotal}
                  onChange={(e) => setAdj((a) => ({ ...a, show_total: e.target.checked }))}
                />{" "}
                Show total
              </label>
            </div>
          </div>

          <div className="est-q-panel-sec">
            <strong>Column headings</strong>
            <input
              value={adj.waste_label ?? ""}
              maxLength={80}
              placeholder={`With wastage heading (default: With wastage (${calc.percent}%))`}
              onChange={(e) => setLabel("waste_label", e.target.value)}
            />
            <input
              value={adj.combined_label ?? ""}
              maxLength={80}
              placeholder={`Combined heading (default: ${hd.combined})`}
              onChange={(e) => setLabel("combined_label", e.target.value)}
            />
            <input
              value={adj.combined_waste_label ?? ""}
              maxLength={80}
              placeholder={`Combined with wastage heading (default: ${hd.combinedWaste})`}
              onChange={(e) => setLabel("combined_waste_label", e.target.value)}
            />
          </div>

          {note && (
            <div className="est-form-error" role="alert">
              <i className="ti ti-alert-circle" /> {note}
            </div>
          )}

          <div className="est-q-panel-row">
            {onSave && (
              <button
                type="button"
                className="est-btn est-btn-sm est-btn-primary"
                onClick={save}
                disabled={!dirty || saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
            {dirty && (
              <button type="button" className="est-btn est-btn-sm" onClick={resetAdj} disabled={saving}>
                Reset
              </button>
            )}
            {!onSave && dirty && <span className="est-hint">Not saved: affects print and export only.</span>}
          </div>
        </div>
      )}

      <div className="est-table-scroll">
        <table className="est-q-table">
          <thead>
            <tr>
              {selecting && (
                <th className="est-q-selcol">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(calc.keys))}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {selecting && <th className="est-q-mvcol" />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cls(c)}
                  onClick={() => headerSort(c.key)}
                  style={{ cursor: "pointer", userSelect: "none", ...(dim(c.key) ?? {}) }}
                  title="Click: make this the main sort column (A to Z, Z to A, off). Other sort levels are kept as tie-breakers."
                >
                  {hchk(c.key)} {label(c)}
                  {levelMark(c.key)}
                </th>
              ))}
              {withWaste && (
                <th className="est-q-num est-q-final" style={dim(COL_WASTE)}>
                  {hchk(COL_WASTE)} {wasteHead}
                </th>
              )}
              {showCountCol && (
                <th className="est-q-num" style={dim(COL_COUNT)}>
                  {hchk(COL_COUNT)} Rows
                </th>
              )}
              {hasMerge && (
                <th className="est-q-num" style={dim(COL_COMBINED)}>
                  {hchk(COL_COMBINED)} {hd.combined}
                </th>
              )}
              {hasMerge && withWaste && (
                <th className="est-q-num" style={dim(COL_COMBINED_WASTE)}>
                  {hchk(COL_COMBINED_WASTE)} {hd.combinedWaste}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const hasKids = !!r.details && r.details.length > 0;
              const isOpen = open.has(i);
              const key = calc.keys[i];
              const b = calc.blockAt[i];
              const isStart = !!b && b.start === i;
              return (
                <Fragment key={i}>
                  <tr
                    className={`${hasKids ? "est-q-group est-q-click" : "est-q-group"} ${
                      selecting && selected.has(key) ? "est-q-sel" : ""
                    }`}
                    onClick={hasKids ? () => toggle(i) : undefined}
                  >
                    {selecting && (
                      <td className="est-q-selcol" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleSel(key)}
                          aria-label={`Select row ${i + 1}`}
                        />
                      </td>
                    )}
                    {selecting && (
                      <td className="est-q-mvcol" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="est-q-mv"
                          disabled={!canUp(i)}
                          onClick={() => mvRow(i, -1)}
                          title={b ? "Move up inside the merged group" : "Move up"}
                          aria-label={`Move row ${i + 1} up`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="est-q-mv"
                          disabled={!canDown(i)}
                          onClick={() => mvRow(i, 1)}
                          title={b ? "Move down inside the merged group" : "Move down"}
                          aria-label={`Move row ${i + 1} down`}
                        >
                          ▼
                        </button>
                      </td>
                    )}
                    {columns.map((c, ci) => (
                      <td key={c.key} className={cls(c)}>
                        {ci === 0 && expandable && (
                          <i className={`ti ti-chevron-right est-q-chev ${hasKids ? (isOpen ? "open" : "") : "hide"}`} />
                        )}
                        {isNum(c.role) ? fmtNum(r.cells[c.key], decimals) : r.cells[c.key]}
                      </td>
                    ))}
                    {withWaste && <td className="est-q-num est-q-final">{fmtNum(calc.eff[i], decimals)}</td>}
                    {showCountCol && <td className="est-q-num est-q-muted">{r.count}</td>}
                    {hasMerge &&
                      (!b ? (
                        <>
                          <td className="est-q-num">
                            {fmtNum(calc.base[i], decimals)}
                            {unit}
                          </td>
                          {withWaste && (
                            <td className="est-q-num">
                              {fmtNum(calc.eff[i], decimals)}
                              {unit}
                            </td>
                          )}
                        </>
                      ) : isStart ? (
                        <>
                          <td
                            className="est-q-num est-q-merge"
                            rowSpan={blockSpan(b.start, b.end)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <strong>
                              {fmtNum(b.raw, decimals)}
                              {unit}
                            </strong>
                            {b.label && <small>{b.label}</small>}
                            {selecting && (
                              <span className="est-q-bmv">
                                <button
                                  type="button"
                                  className="est-q-mv"
                                  disabled={b.start === 0}
                                  onClick={() => mvBlock(b, -1)}
                                  title="Move the whole merged group up"
                                  aria-label="Move merged group up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="est-q-mv"
                                  disabled={b.end >= rows.length - 1}
                                  onClick={() => mvBlock(b, 1)}
                                  title="Move the whole merged group down"
                                  aria-label="Move merged group down"
                                >
                                  ▼
                                </button>
                              </span>
                            )}
                          </td>
                          {withWaste && (
                            <td
                              className="est-q-num est-q-merge"
                              rowSpan={blockSpan(b.start, b.end)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <strong>
                                {fmtNum(b.value, decimals)}
                                {unit}
                              </strong>
                            </td>
                          )}
                        </>
                      ) : null)}
                  </tr>
                  {hasKids &&
                    isOpen &&
                    r.details!.map((d, di) => (
                      <tr key={`${i}-${di}`} className="est-q-detail">
                        {selecting && <td className="est-q-selcol" />}
                        {selecting && <td className="est-q-mvcol" />}
                        {columns.map((c, ci) => (
                          <td key={c.key} className={cls(c)}>
                            {ci === 0 && expandable && <span className="est-q-chev-gap" />}
                            {isNum(c.role) ? fmtNum(d[c.key], decimals) : d[c.key]}
                          </td>
                        ))}
                        {withWaste && (
                          <td className="est-q-num">
                            {fmtNum(num(final ? d[final] : null) * calc.factor[i], decimals)}
                          </td>
                        )}
                        {showCountCol && <td />}
                        {hasMerge && !b && Array.from({ length: mergeCols }).map((_, k) => <td key={k} />)}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          {showTotal && (
            <tfoot>
              <tr>
                {selecting && <td className="est-q-selcol" />}
                {selecting && <td className="est-q-mvcol" />}
                {columns.map((c, i) => (
                  <td key={c.key} className={cls(c)}>
                    {i === 0 && !isNum(c.role) ? "Total" : isNum(c.role) ? fmtNum(totals[c.key], decimals) : ""}
                  </td>
                ))}
                {withWaste && <td className="est-q-num est-q-final">{fmtNum(calc.effTotal, decimals)}</td>}
                {showCountCol && <td className="est-q-num">{rows.reduce((s, r) => s + r.count, 0)}</td>}
                {hasMerge && Array.from({ length: mergeCols }).map((_, k) => <td key={k} />)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}