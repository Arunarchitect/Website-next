"use client";
// app/bills/ProjectFeesTab.tsx — pick project → set up fee → confirm → bill each stage
import { useCallback, useEffect, useState } from "react";
import * as bill from "./billsApi";
import * as fa from "./feeAdminApi";
import { InstalmentBlock } from "./BillsTab";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Card, Field, Msg, StatusPill, errText, input, money } from "./ui";

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const tidy = (m: string) => m.replace(/^\[['"]?/, "").replace(/['"]?\]$/, "");
const sorted = (t?: fa.FeeTpl) =>
  (t?.template_stages ?? []).slice().sort((a, b) => a.order - b.order);

function estimate(t: fa.FeeTpl | undefined, qty: number, disc: number) {
  if (!t || !qty) return null;
  const rate =
    t.billing_type === "quantity_rate"
      ? n(t.default_rate_per_unit)
      : t.billing_type === "percentage"
        ? n(t.default_percentage) / 100
        : n(t.default_hourly_rate);
  const base = qty * rate;
  return { base, final: base * (1 - disc / 100) };
}
function qtyLabel(t?: fa.FeeTpl) {
  if (!t) return "Quantity";
  if (t.billing_type === "quantity_rate")
    return `Quantity (${t.quantity_unit?.symbol ?? "units"})`;
  return t.billing_type === "percentage" ? "Project value" : "Estimated hours";
}

export default function ProjectFeesTab({
  orgId,
  onNavigate,
  active = true,
}: {
  orgId: number;
  onNavigate: (tab: string) => void;
  active?: boolean;
}) {
  const [projects, setProjects] = useState<bill.Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [calc, setCalc] = useState<fa.Calc | null | undefined>(undefined);
  const [tpls, setTpls] = useState<fa.FeeTpl[]>([]);
  const [billTpls, setBillTpls] = useState<bill.BillTemplate[]>([]);
  const [tplId, setTplId] = useState("");
  const [qty, setQty] = useState("");
  const [disc, setDisc] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProjectId("");
    setCalc(undefined);
    bill
      .fetchOrgProjects(orgId)
      .then(setProjects)
      .catch((e) => setErr(errText(e)));
    fa.fetchFeeTemplates(orgId)
      .then(setTpls)
      .catch((e) => setErr(errText(e)));
    bill
      .fetchTemplates(orgId)
      .then(setBillTpls)
      .catch(() => setBillTpls([]));
  }, [orgId]);

  // refresh templates each time this tab is shown again (e.g. after creating one)
  useEffect(() => {
    if (active)
      fa.fetchFeeTemplates(orgId)
        .then(setTpls)
        .catch(() => {});
  }, [active, orgId]);

  const load = useCallback(() => {
    if (!projectId) return;
    fa.fetchCalcs(Number(projectId))
      .then((l) => setCalc(l[0] ?? null))
      .catch((e) => setErr(errText(e)));
  }, [projectId]);
  useEffect(() => {
    setCalc(undefined);
    setErr(null);
    load();
  }, [load]);

  useEffect(() => {
    if (calc) {
      setTplId(String(calc.fee_template));
      setQty(calc.quantity);
      setDisc(calc.discount_percentage);
    } else if (calc === null) {
      setTplId("");
      setQty("");
      setDisc("0");
    }
  }, [calc]);

  const tpl = tpls.find((t) => String(t.id) === tplId);
  const stages = sorted(tpl);
  const stagesOk =
    !!tpl &&
    stages.length > 0 &&
    Math.abs(n(tpl.total_stage_percentage) - 100) < 0.005;
  const est = estimate(tpl, n(qty), n(disc));

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      load();
    } catch (e) {
      setErr(tidy(errText(e)));
    } finally {
      setBusy(false);
    }
  }
  function body(): fa.CalcBody {
    if (!tpl) throw new Error("Choose a fee template.");
    if (!n(qty)) throw new Error("Enter a quantity greater than 0.");
    return {
      fee_template: tpl.id,
      quantity: qty,
      discount_percentage: disc || "0",
      currency: tpl.currency,
    };
  }
  const save = () =>
    run(async () => {
      const b = body();
      if (calc) await fa.updateCalc(calc.id, b);
      else await fa.createCalc({ project: Number(projectId), ...b });
    });
  const confirmFee = () =>
    run(async () => {
      const b = body();
      if (!calc) return;
      if (
        !window.confirm(
          `Confirm this fee? It locks the amount and creates ${stages.length} payment stage(s).`,
        )
      )
        return;
      await fa.updateCalc(calc.id, b);
      await fa.confirmCalc(calc.id);
    });

  const editable = calc === null || calc?.status === "draft";
  const insts = calc?.instalments ?? [];
  const paid = insts.reduce((s, i) => s + n(i.paid_amount), 0);
  const total = n(calc?.final_fee);
  const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const cur = calc?.currency ?? tpl?.currency ?? "INR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <Field label="Project" htmlFor="pf-project">
          <select
            id="pf-project"
            name="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={input}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {err && <Msg>{err}</Msg>}
      {projectId && calc === undefined && !err && (
        <Card>
          <span style={{ fontSize: 13, color: C.t3 }}>Loading…</span>
        </Card>
      )}

      {projectId && calc !== undefined && editable && (
        <Card
          title={
            calc ? "Draft fee — not yet confirmed" : "Set up this project's fee"
          }
        >
          {tpls.filter((t) => t.is_active).length === 0 ? (
            <div style={{ fontSize: 13, color: C.t3 }}>
              No fee templates yet.{" "}
              <Btn onClick={() => onNavigate("templates")}>
                Create a fee template
              </Btn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                  gap: 10,
                }}
              >
                <Field label="Fee template" htmlFor="pf-tpl">
                  <select
                    id="pf-tpl"
                    name="fee_template"
                    value={tplId}
                    onChange={(e) => setTplId(e.target.value)}
                    style={input}
                  >
                    <option value="">Select…</option>
                    {tpls
                      .filter(
                        (t) =>
                          (t.is_active &&
                            t.template_stages.length > 0 &&
                            Math.abs(Number(t.total_stage_percentage) - 100) <
                              0.005) ||
                          String(t.id) === tplId,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={qtyLabel(tpl)} htmlFor="pf-qty">
                  <input
                    id="pf-qty"
                    name="quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="Discount %" htmlFor="pf-disc">
                  <input
                    id="pf-disc"
                    name="discount_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={disc}
                    onChange={(e) => setDisc(e.target.value)}
                    style={input}
                  />
                </Field>
              </div>

              {tpl && !stagesOk && (
                <Msg>
                  This template&apos;s stages{" "}
                  {stages.length === 0
                    ? "are missing"
                    : `add up to ${n(tpl.total_stage_percentage)}%, not 100%`}
                  , so the fee can&apos;t be confirmed.{" "}
                  <Btn onClick={() => onNavigate("templates")}>
                    Fix the stages
                  </Btn>
                </Msg>
              )}

              {est && (
                <div
                  style={{
                    background: C.surface,
                    borderRadius: 9,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: C.t2, marginBottom: 8 }}>
                    Estimated fee: <strong>{money(est.final, cur)}</strong>
                    {n(disc) > 0 && (
                      <span style={{ color: C.t4 }}>
                        {" "}
                        (after {disc}% discount from {money(est.base, cur)})
                      </span>
                    )}
                  </div>
                  {stages.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12.5,
                        color: C.t3,
                        padding: "2px 0",
                      }}
                    >
                      <span>
                        {s.fee_stage.name} · {s.fee_percentage}% · due{" "}
                        {s.payment_terms_days} days after billing
                      </span>
                      <span>
                        {money((est.final * n(s.fee_percentage)) / 100, cur)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn
                  kind={calc ? "ghost" : "primary"}
                  disabled={busy}
                  onClick={save}
                >
                  {calc ? "Save changes" : "Create fee"}
                </Btn>
                {calc && (
                  <Btn
                    kind="primary"
                    disabled={busy || !stagesOk}
                    onClick={confirmFee}
                  >
                    Confirm fee &amp; create stages
                  </Btn>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {calc && !editable && (
        <>
          <Card
            title={`Fee — ${tpl?.name ?? "template"}`}
            right={<StatusPill status={calc.status} />}
          >
            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {(
                [
                  ["Fee", total],
                  ["Paid", paid],
                  ["Outstanding", Math.max(total - paid, 0)],
                ] as const
              ).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 12, color: C.t4 }}>{l}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.t1 }}>
                    {money(v, cur)}
                  </div>
                </div>
              ))}
            </div>
            <div
              aria-label={`${pct}% paid`}
              style={{ height: 6, background: C.border, borderRadius: 99 }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: 6,
                  background: C.green,
                  borderRadius: 99,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: C.t4, marginTop: 8 }}>
              {calc.quantity} {calc.quantity_unit_snapshot} · discount{" "}
              {calc.discount_percentage}% · locked when confirmed
            </div>
          </Card>
          <Card title="Payment stages">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insts.length === 0 && (
                <div style={{ fontSize: 13, color: C.t3 }}>
                  No stages were generated for this fee.
                </div>
              )}
              {insts.map((i) => (
                <InstalmentBlock
                  key={i.id}
                  inst={i}
                  cur={calc.currency}
                  templates={billTpls}
                  onChanged={load}
                />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
