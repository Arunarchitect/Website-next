"use client";
// app/bills/FeeTemplatesTab.tsx — fee templates with their stages & deliverables in ONE form
import { useCallback, useEffect, useState } from "react";
import * as fa from "./feeAdminApi";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Card, Field, Msg, errText, input, money } from "./ui";

interface Row {
  key: string;
  id?: number;
  stage: string;
  pct: string;
  days: string;
  delivs: string;
  delivObjs: fa.DelivTpl[];
}
const uid = () => Math.random().toString(36).slice(2);
const n = (v: string | number | null | undefined) => Number(v ?? 0);
const TYPES: Record<fa.BillingType, string> = {
  quantity_rate: "Quantity × rate (e.g. per sq.ft)",
  percentage: "Percentage of project value",
  hourly: "Hourly",
};
const blank = {
  name: "",
  bt: "quantity_rate" as fa.BillingType,
  unit: "",
  rate: "",
  pct: "",
  hourly: "",
  currency: "INR",
  active: true,
};
const newRow = (): Row => ({
  key: uid(),
  stage: "",
  pct: "",
  days: "30",
  delivs: "",
  delivObjs: [],
});

function rateText(t: fa.FeeTpl) {
  if (t.billing_type === "quantity_rate")
    return `${money(t.default_rate_per_unit, t.currency)} / ${t.quantity_unit?.symbol ?? "unit"}`;
  if (t.billing_type === "percentage")
    return `${n(t.default_percentage)}% of project value`;
  return `${money(t.default_hourly_rate, t.currency)} / hour`;
}

export default function FeeTemplatesTab({ orgId }: { orgId: number }) {
  const [tpls, setTpls] = useState<fa.FeeTpl[]>([]);
  const [units, setUnits] = useState<fa.QUnit[]>([]);
  const [stages, setStages] = useState<fa.FeeStage[]>([]);
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [f, setF] = useState(blank);
  const [rows, setRows] = useState<Row[]>([]);
  const [newUnit, setNewUnit] = useState<{
    name: string;
    symbol: string;
  } | null>(null);
  const [newStage, setNewStage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fa.fetchFeeTemplates(orgId)
      .then(setTpls)
      .catch((e) => setErr(errText(e)));
    fa.fetchUnits(orgId)
      .then(setUnits)
      .catch(() => setUnits([]));
    fa.fetchStages(orgId)
      .then(setStages)
      .catch(() => setStages([]));
  }, [orgId]);
  useEffect(() => {
    setEditing(null);
    load();
  }, [load]);

  function start(t?: fa.FeeTpl) {
    setErr(null);
    setNewUnit(null);
    if (!t) {
      setF(blank);
      setRows([newRow()]);
      setEditing("new");
      return;
    }
    setF({
      name: t.name,
      bt: t.billing_type,
      unit: t.quantity_unit ? String(t.quantity_unit.id) : "",
      rate: t.default_rate_per_unit ?? "",
      pct: t.default_percentage ?? "",
      hourly: t.default_hourly_rate ?? "",
      currency: t.currency,
      active: t.is_active,
    });
    setRows(
      t.template_stages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          key: uid(),
          id: s.id,
          stage: String(s.fee_stage.id),
          pct: String(n(s.fee_percentage)),
          days: String(s.payment_terms_days),
          delivs: s.deliverable_templates
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((d) => d.name)
            .join("\n"),
          delivObjs: s.deliverable_templates,
        })),
    );
    setEditing(t.id);
  }

  const total = Math.round(rows.reduce((s, r) => s + n(r.pct), 0) * 100) / 100;
  const remaining = Math.round((100 - total) * 100) / 100;
  const upd = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function addUnit() {
    const name = newUnit?.name.trim() ?? "";
    const symbol = newUnit?.symbol.trim() ?? "";
    if (!name || !symbol) return setErr("Enter a unit name and symbol.");

    // A unit with this symbol already exists: just select it instead of creating a duplicate.
    const existing = units.find(
      (u) => u.symbol.toLowerCase() === symbol.toLowerCase(),
    );
    if (existing) {
      setF((x) => ({ ...x, unit: String(existing.id) }));
      setNewUnit(null);
      setErr(null);
      return;
    }

    try {
      const u = await fa.createUnit({ organisation: orgId, name, symbol });
      setUnits((l) => [...l, u]);
      setF((x) => ({ ...x, unit: String(u.id) }));
      setNewUnit(null);
      setErr(null);
    } catch (e) {
      setErr(errText(e));
    }
  }
  async function addStage() {
    if (!newStage.trim()) return;
    try {
      const s = await fa.createStage({
        organisation: orgId,
        name: newStage.trim(),
        order: Math.max(0, ...stages.map((x) => x.order)) + 1,
      });
      setStages((l) => [...l, s]);
      setNewStage("");
      setErr(null);
      setRows((rs) => {
        let done = false;
        return rs.map((r) =>
          !done && !r.stage
            ? ((done = true), { ...r, stage: String(s.id) })
            : r,
        );
      });
    } catch (e) {
      setErr(errText(e));
    }
  }

  async function save() {
    if (!f.name.trim()) return setErr("Give the template a name.");
    if (f.bt === "quantity_rate" && (!f.unit || !n(f.rate)))
      return setErr("Choose a unit and enter the rate per unit.");
    if (f.bt === "percentage" && !n(f.pct))
      return setErr("Enter the percentage.");
    if (f.bt === "hourly" && !n(f.hourly))
      return setErr("Enter the hourly rate.");
    if (rows.some((r) => !r.stage || !n(r.pct)))
      return setErr("Every stage needs a stage name and a percentage.");

    setBusy(true);
    setErr(null);
    try {
      const b = {
        organisation: orgId,
        name: f.name.trim(),
        billing_type: f.bt,
        currency: f.currency || "INR",
        is_active: f.active,
        quantity_unit: f.bt === "quantity_rate" ? Number(f.unit) : null,
        default_rate_per_unit: f.bt === "quantity_rate" ? f.rate : null,
        default_percentage: f.bt === "percentage" ? f.pct : null,
        default_hourly_rate: f.bt === "hourly" ? f.hourly : null,
      };
      const tid =
        editing === "new"
          ? (await fa.createFeeTemplate(b)).id
          : (await fa.updateFeeTemplate(editing as number, b)).id;
      const existing = tpls.find((t) => t.id === tid)?.template_stages ?? [];
      const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
      for (const s of existing)
        if (!keep.has(s.id)) await fa.deleteTplStage(s.id);
      for (const [i, r] of rows.entries()) {
        const sb = {
          fee_template: tid,
          fee_stage: Number(r.stage),
          fee_percentage: r.pct,
          order: i + 1,
          payment_terms_days: n(r.days),
        };
        const saved = r.id
          ? await fa.updateTplStage(r.id, sb)
          : await fa.createTplStage(sb);
        const lines = r.delivs
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
        for (const d of r.delivObjs)
          if (!lines.includes(d.name)) await fa.deleteDeliv(d.id);
        for (const [k, name] of lines.entries()) {
          if (!r.delivObjs.some((d) => d.name === name))
            await fa.createDeliv({
              fee_template_stage: saved.id,
              name,
              order: k + 1,
            });
        }
      }
      setEditing(null);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
      load();
    }
  }

  async function toggle(t: fa.FeeTpl) {
    try {
      await fa.updateFeeTemplate(t.id, { is_active: !t.is_active });
      load();
    } catch (e) {
      setErr(errText(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {err && <Msg>{err}</Msg>}

      {editing === null ? (
        <Card
          title="Fee templates"
          right={
            <Btn kind="primary" onClick={() => start()}>
              New template
            </Btn>
          }
        >
          {tpls.length === 0 && (
            <div style={{ fontSize: 13, color: C.t3 }}>
              No templates yet. A template says how a type of work is billed and
              how the fee splits into payment stages.
            </div>
          )}
          {tpls.map((t) => {
            const ok =
              Math.abs(n(t.total_stage_percentage) - 100) < 0.005 &&
              t.template_stages.length > 0;
            return (
              <div
                key={t.id}
                style={{
                  borderTop: `1px solid ${C.border}`,
                  padding: "11px 0",
                  opacity: t.is_active ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: C.t1, fontSize: 14 }}>
                    {t.name}
                  </strong>
                  <span style={{ fontSize: 12.5, color: C.t3 }}>
                    {rateText(t)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <Btn onClick={() => start(t)}>Edit</Btn>
                  <Btn onClick={() => toggle(t)}>
                    {t.is_active ? "Deactivate" : "Activate"}
                  </Btn>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    marginTop: 5,
                    color: ok ? C.t3 : C.red,
                  }}
                >
                  {t.template_stages.length === 0
                    ? "No stages yet"
                    : t.template_stages
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map(
                          (s) => `${s.fee_stage.name} ${n(s.fee_percentage)}%`,
                        )
                        .join(" · ")}
                  {!ok &&
                    t.template_stages.length > 0 &&
                    ` — total ${n(t.total_stage_percentage)}%, must be 100%`}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <>
          <Card
            title={editing === "new" ? "New fee template" : "Edit fee template"}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                gap: 10,
              }}
            >
              <Field label="Name" htmlFor="ft-name">
                <input
                  id="ft-name"
                  name="name"
                  autoComplete="off"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  style={input}
                  placeholder="e.g. Residential design"
                />
              </Field>
              <Field label="How is it billed?" htmlFor="ft-bt">
                <select
                  id="ft-bt"
                  name="billing_type"
                  value={f.bt}
                  onChange={(e) =>
                    setF({ ...f, bt: e.target.value as fa.BillingType })
                  }
                  style={input}
                >
                  {(Object.keys(TYPES) as fa.BillingType[]).map((k) => (
                    <option key={k} value={k}>
                      {TYPES[k]}
                    </option>
                  ))}
                </select>
              </Field>
              {f.bt === "quantity_rate" && (
                <>
                  <Field label="Unit" htmlFor="ft-unit">
                    <select
                      id="ft-unit"
                      name="unit"
                      value={f.unit}
                      onChange={(e) => setF({ ...f, unit: e.target.value })}
                      style={input}
                    >
                      <option value="">Select…</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                    {!newUnit && (
                      <Btn
                        style={{ marginTop: 6 }}
                        onClick={() => setNewUnit({ name: "", symbol: "" })}
                      >
                        Add a unit
                      </Btn>
                    )}
                  </Field>
                  <Field label="Rate per unit" htmlFor="ft-rate">
                    <input
                      id="ft-rate"
                      name="rate"
                      type="number"
                      min="0"
                      step="any"
                      value={f.rate}
                      onChange={(e) => setF({ ...f, rate: e.target.value })}
                      style={input}
                    />
                  </Field>
                </>
              )}
              {f.bt === "percentage" && (
                <Field label="Percentage of project value" htmlFor="ft-pct">
                  <input
                    id="ft-pct"
                    name="pct"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={f.pct}
                    onChange={(e) => setF({ ...f, pct: e.target.value })}
                    style={input}
                  />
                </Field>
              )}
              {f.bt === "hourly" && (
                <Field label="Default hourly rate" htmlFor="ft-hr">
                  <input
                    id="ft-hr"
                    name="hourly"
                    type="number"
                    min="0"
                    step="any"
                    value={f.hourly}
                    onChange={(e) => setF({ ...f, hourly: e.target.value })}
                    style={input}
                  />
                </Field>
              )}
              <Field label="Currency" htmlFor="ft-cur">
                <input
                  id="ft-cur"
                  name="currency"
                  maxLength={3}
                  value={f.currency}
                  onChange={(e) =>
                    setF({ ...f, currency: e.target.value.toUpperCase() })
                  }
                  style={input}
                />
              </Field>
            </div>
            {newUnit && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <Field label="Unit name" htmlFor="nu-name">
                  <input
                    id="nu-name"
                    name="unit_name"
                    autoComplete="off"
                    value={newUnit.name}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, name: e.target.value })
                    }
                    style={{ ...input, width: 180 }}
                    placeholder="Square feet"
                  />
                </Field>
                <Field label="Symbol" htmlFor="nu-sym">
                  <input
                    id="nu-sym"
                    name="unit_symbol"
                    autoComplete="off"
                    value={newUnit.symbol}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, symbol: e.target.value })
                    }
                    style={{ ...input, width: 100 }}
                    placeholder="sq.ft"
                  />
                </Field>
                <Btn kind="primary" onClick={addUnit}>
                  Save unit
                </Btn>
                <Btn onClick={() => setNewUnit(null)}>Cancel</Btn>
              </div>
            )}
          </Card>

          <Card
            title="Payment stages"
            right={
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: Math.abs(remaining) < 0.005 ? C.green : C.red,
                }}
              >
                {total}% of 100%
              </span>
            }
          >
            <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 10 }}>
              The fee is split across these stages in this order. Percentages
              must add up to exactly 100% before a fee can be confirmed. Each
              deliverable you list is created on the project when the fee is
              confirmed.
            </div>
            {rows.map((r, i) => (
              <div
                key={r.key}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr auto",
                    gap: 8,
                    alignItems: "end",
                  }}
                >
                  <Field label={`Stage ${i + 1}`} htmlFor={`st-${r.key}`}>
                    <select
                      id={`st-${r.key}`}
                      name="stage"
                      value={r.stage}
                      onChange={(e) => upd(r.key, { stage: e.target.value })}
                      style={input}
                    >
                      <option value="">Select…</option>
                      {stages
                        .filter(
                          (s) =>
                            s.is_active &&
                            (String(s.id) === r.stage ||
                              !rows.some((o) => o.stage === String(s.id))),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Percent" htmlFor={`pc-${r.key}`}>
                    <input
                      id={`pc-${r.key}`}
                      name="percent"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={r.pct}
                      onChange={(e) => upd(r.key, { pct: e.target.value })}
                      style={input}
                    />
                  </Field>
                  <Field label="Due after (days)" htmlFor={`dy-${r.key}`}>
                    <input
                      id={`dy-${r.key}`}
                      name="days"
                      type="number"
                      min="0"
                      value={r.days}
                      onChange={(e) => upd(r.key, { days: e.target.value })}
                      style={input}
                    />
                  </Field>
                  <Btn
                    kind="danger"
                    onClick={() =>
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                    }
                  >
                    Remove
                  </Btn>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Field
                    label="Deliverables (one per line, optional)"
                    htmlFor={`dl-${r.key}`}
                  >
                    <textarea
                      id={`dl-${r.key}`}
                      name="deliverables"
                      rows={2}
                      value={r.delivs}
                      onChange={(e) => upd(r.key, { delivs: e.target.value })}
                      style={{ ...input, resize: "vertical" }}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "flex-end",
                marginTop: 4,
              }}
            >
              <Btn onClick={() => setRows((rs) => [...rs, newRow()])}>
                Add stage
              </Btn>
              {rows.length > 0 && Math.abs(remaining) >= 0.005 && (
                <Btn
                  onClick={() =>
                    setRows((rs) =>
                      rs.map((r, i) =>
                        i === rs.length - 1
                          ? {
                              ...r,
                              pct: String(
                                Math.round((n(r.pct) + remaining) * 100) / 100,
                              ),
                            }
                          : r,
                      ),
                    )
                  }
                >
                  Put {remaining}% on the last stage
                </Btn>
              )}
              <span style={{ flex: 1 }} />
              <Field label="Need a new stage name?" htmlFor="ns-name">
                <input
                  id="ns-name"
                  name="new_stage"
                  autoComplete="off"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  style={{ ...input, width: 200 }}
                  placeholder="e.g. Working drawings"
                />
              </Field>
              <Btn onClick={addStage} disabled={!newStage.trim()}>
                Add to list
              </Btn>
            </div>
          </Card>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Btn kind="primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save template"}
            </Btn>
            <Btn disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <label style={{ fontSize: 13, color: C.t2 }}>
              <input
                type="checkbox"
                name="active"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />{" "}
              Active
            </label>
            <span style={{ fontSize: 12, color: C.t4 }}>
              Stages already used by a confirmed fee can&apos;t be removed.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
