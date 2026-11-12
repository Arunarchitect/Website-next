"use client";

import { useRef, useState } from "react";
import { Estimate } from "../types";
import { AddonAssignment, AddonState, PRODUCT_SCOPES, ProductScope, money, summarizeAssignments } from "../estimateAddon";

interface Props {
  projectId: number;
  currentId: number;
  /** Estimates already loaded on the page; filtered here to the same project. */
  candidates: Estimate[];
  addon: AddonState;
  onChange: (a: AddonState) => void;
  /** e.g. getAssignments from the product service. Omit to hide the product list option. */
  loadAssignments?: (projectId: number) => Promise<AddonAssignment[]>;
}

export default function EstimateAddonPanel({
  projectId,
  currentId,
  candidates,
  addon,
  onChange,
  loadAssignments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const raw = useRef<AddonAssignment[] | null>(null);

  const others = candidates.filter(
    (e) => (e.kind ?? "estimate") === "estimate" && e.project_id === projectId && e.id !== currentId && e.status !== "archived"
  );
  const picked = new Set(addon.estimates.map((e) => e.id));
  const count = (addon.products ? 1 : 0) + addon.estimates.length;

  const fetchRaw = async () => {
    if (!loadAssignments) return [];
    if (!raw.current) raw.current = await loadAssignments(projectId);
    return raw.current;
  };

  const toggleProducts = async () => {
    if (addon.products) return onChange({ ...addon, products: null });
    try {
      setBusy(true);
      setErr(null);
      const list = await fetchRaw();
      onChange({ ...addon, products: summarizeAssignments(list, "non_declined") });
    } catch {
      setErr("Could not load the product list.");
    } finally {
      setBusy(false);
    }
  };

  const changeScope = (scope: ProductScope) => {
    if (!addon.products || !raw.current) return;
    onChange({ ...addon, products: summarizeAssignments(raw.current, scope) });
  };

  const toggleEstimate = (e: Estimate) => {
    if (picked.has(e.id)) return onChange({ ...addon, estimates: addon.estimates.filter((x) => x.id !== e.id) });
    onChange({
      ...addon,
      estimates: [...addon.estimates, { id: e.id, title: e.title, item_count: e.item_count, total: e.total_amount }],
    });
  };

  return (
    <div className="est-addon">
      <button type="button" className={`est-btn est-btn-sm ${open ? "est-btn-primary" : ""}`} onClick={() => setOpen((v) => !v)}>
        + Add{count ? ` (${count})` : ""}
      </button>

      {open && (
        <div className="est-addon-panel">
          {loadAssignments && (
            <div className="est-addon-sec">
              <strong>Products</strong>
              <label className="est-addon-opt">
                <input type="checkbox" checked={!!addon.products} disabled={busy} onChange={toggleProducts} />
                <span>Product list for this project{busy ? " (loading…)" : ""}</span>
              </label>
              {addon.products && (
                <label className="est-addon-sub">
                  <select value={addon.products.scope} onChange={(e) => changeScope(e.target.value as ProductScope)}>
                    {PRODUCT_SCOPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <div className="est-addon-sec">
            <strong>Other estimates in this project</strong>
            {others.length === 0 && <span className="est-hint">No other estimates in this project.</span>}
            {others.map((e) => (
              <label key={e.id} className="est-addon-opt">
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggleEstimate(e)} />
                <span>
                  {e.title} <small className="est-hint">({e.status})</small>
                </span>
                <span className="est-addon-amt">{money(e.total_amount)}</span>
              </label>
            ))}
          </div>

          {err && <div className="est-form-error">{err}</div>}
          <div className="est-addon-foot">
            <button
              type="button"
              className="est-btn est-btn-sm"
              disabled={count === 0}
              onClick={() => onChange({ products: null, estimates: [] })}
            >
              Clear all
            </button>
            <span className="est-hint">Shown below the estimate and included in the PDF. Not saved.</span>
          </div>
        </div>
      )}
    </div>
  );
}