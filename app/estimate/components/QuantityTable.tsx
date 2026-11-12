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
import { adjustHeaders, compute, normAdjust, num, sortColumn, sortData } from "../quantityAdjust";

const NUMERIC = ["sum", "avg", "min", "max"];

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
  /** Provided only when the user may edit; persists merges, wastage and headings. */
  onSave?: (a: QuantityAdjust) => Promise<void>;
}

export default function QuantityTable({ data: rawData, title, meta, adjust, onSave }: Props) {
  const initial = useRef(JSON.stringify(normAdjust(adjust)));
  const [adj, setAdj] = useState<QuantityAdjust>(() => normAdjust(adjust));

  // rows in the chosen alphabetical order (merges, wastage and PDF all work on this order)
  const data = useMemo(() => sortData(rawData, adj.sort, adj.merges), [rawData, adj.sort, adj.merges]);
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
  const sortKey = sortColumn(data)?.key;
  const setSort = (s: "none" | "asc" | "desc") => {
    setOpen(new Set()); // row positions change, so collapse
    setAdj((a) => ({ ...a, sort: s }));
  };
  const cycleSort = () => setSort(adj.sort === "asc" ? "desc" : adj.sort === "desc" ? "none" : "asc");
  const sortArrow = adj.sort === "asc" ? " ▲" : adj.sort === "desc" ? " ▼" : "";

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
    if (!ids.every((v, j) => j === 0 || v === ids[j - 1] + 1)) return setNote("Rows must be next to each other.");
    if (ids.some((i) => calc.blockAt[i])) return setNote("Some of these rows are already in a merge.");
    setNote(null);
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

  const removeMerge = (id: string) => setAdj((a) => ({ ...a, merges: a.merges.filter((m) => m.id !== id) }));

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
        const start = !!b && b.start === i;
        cells.push(start ? String(b!.raw) : "");
        if (withWaste) cells.push(start ? String(b!.value) : "");
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
            <strong>Merge adjacent rows</strong>
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
            <strong>Display</strong>
            <div className="est-q-panel-row">
              <label>
                Sort{" "}
                <select
                  value={adj.sort ?? "none"}
                  disabled={!sortKey}
                  onChange={(e) => setSort(e.target.value as "none" | "asc" | "desc")}
                >
                  <option value="none">Original order</option>
                  <option value="asc">A to Z</option>
                  <option value="desc">Z to A</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showTotal}
                  onChange={(e) => setAdj((a) => ({ ...a, show_total: e.target.checked }))}
                />{" "}
                Show total
              </label>
            </div>
            {adj.sort !== "none" && adj.merges.length > 0 && (
              <span className="est-hint">Merged rows are sorted inside their block, and the block is placed by its first row.</span>
            )}
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
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cls(c)}
                  onClick={c.key === sortKey ? cycleSort : undefined}
                  style={{
                    ...(c.key === sortKey ? { cursor: "pointer", userSelect: "none" } : {}),
                    ...(dim(c.key) ?? {}),
                  }}
                  title={c.key === sortKey ? "Click to sort A to Z / Z to A" : undefined}
                >
                  {hchk(c.key)} {label(c)}
                  {c.key === sortKey ? sortArrow : ""}
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
                          {Array.from({ length: mergeCols }).map((_, k) => (
                            <td key={k} />
                          ))}
                        </>
                      ) : isStart ? (
                        <>
                          <td className="est-q-num est-q-merge" rowSpan={blockSpan(b.start, b.end)}>
                            <strong>
                              {fmtNum(b.raw, decimals)}
                              {unit}
                            </strong>
                            {b.label && <small>{b.label}</small>}
                          </td>
                          {withWaste && (
                            <td className="est-q-num est-q-merge" rowSpan={blockSpan(b.start, b.end)}>
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