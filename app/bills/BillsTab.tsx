"use client";
// app/bills/BillsTab.tsx — project → fee calculation → instalments → bills
import { useCallback, useEffect, useState } from "react";
import * as api from "./billsApi";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Card, Field, Msg, StatusPill, errText, input, money } from "./ui";

// today's date in the user's local timezone, as YYYY-MM-DD (toISOString would give the UTC date)
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

function PaymentLine({ p, billId, cur, onChanged }: {
  p: api.BillPayment; billId: number; cur: string; onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(p.paid_on);
  const [ref, setRef] = useState(p.reference ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      await api.updatePayment(billId, p.id, { paid_on: date, reference: ref });
      setEditing(false); onChanged();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div style={{ fontSize: 12.5, color: C.t3, padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span>{money(p.amount, cur)} · {p.paid_on}{p.reference ? ` · ${p.reference}` : ""}</span>
        {!editing && <Btn onClick={() => setEditing(true)}>Edit</Btn>}
      </div>
      {editing && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Date received" htmlFor={`ed-date-${p.id}`}>
            <input id={`ed-date-${p.id}`} name="paid_on" type="date" value={date} max={today()}
              onChange={(e) => setDate(e.target.value)} style={{ ...input, width: 160 }} />
          </Field>
          <Field label="Reference" htmlFor={`ed-ref-${p.id}`}>
            <input id={`ed-ref-${p.id}`} name="reference" autoComplete="off" value={ref}
              onChange={(e) => setRef(e.target.value)} style={{ ...input, width: 200 }} />
          </Field>
          <Btn kind="primary" disabled={busy || !date} onClick={save}>Save</Btn>
          <Btn disabled={busy} onClick={() => { setEditing(false); setDate(p.paid_on); setRef(p.reference ?? ""); }}>Cancel</Btn>
        </div>
      )}
      {err && <div style={{ marginTop: 6 }}><Msg>{err}</Msg></div>}
    </div>
  );
}

function BillRow({ bill, cur, onChanged }: { bill: api.Bill; cur: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [amt, setAmt] = useState("");
  const [ref, setRef] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const num = bill.bill_number ?? bill.number ?? `Bill ${bill.id}`;

  async function run(fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setErr(null);
    try { await fn(); onChanged(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: C.t1 }}>{num}</strong>
        <StatusPill status={bill.status} />
        <span style={{ fontSize: 13, color: C.t2 }}>{money(bill.amount, cur)}</span>
        {bill.paid_amount !== undefined && <span style={{ fontSize: 12, color: C.t3 }}>Paid {money(bill.paid_amount, cur)}</span>}
        <span style={{ flex: 1 }} />
        <Btn disabled={busy} onClick={() => run(() => api.downloadBill(bill.id, String(num)))}>Download</Btn>
        {bill.status === "draft" && <Btn disabled={busy} onClick={() => run(() => api.issueBill(bill.id))}>Issue</Btn>}
        {bill.status !== "draft" && bill.status !== "cancelled" && (
          <Btn disabled={busy} onClick={() => setPaying((v) => !v)}>Record payment</Btn>
        )}
        {bill.status !== "cancelled" && (
          <Btn kind="danger" disabled={busy} onClick={() => run(() => api.cancelBill(bill.id), "Cancel this bill? Its invoiced amount is reversed.")}>Cancel</Btn>
        )}
        <Btn kind="danger" disabled={busy} onClick={() => run(() => api.deleteBill(bill.id), "Delete this bill and its PDF?")}>Delete</Btn>
      </div>

      {(bill.payments ?? []).length > 0 && (
        <div style={{ marginTop: 6 }}>
          {(bill.payments ?? []).map((p) => (
            <PaymentLine key={p.id} p={p} billId={bill.id} cur={cur} onChanged={onChanged} />
          ))}
        </div>
      )}

      {paying && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Amount received" htmlFor={`pay-amt-${bill.id}`}>
            <input id={`pay-amt-${bill.id}`} name="amount" type="number" min="0" step="any" value={amt}
              onChange={(e) => setAmt(e.target.value)} style={{ ...input, width: 150 }} />
          </Field>
          <Field label="Date received" htmlFor={`pay-date-${bill.id}`}>
            <input id={`pay-date-${bill.id}`} name="paid_on" type="date" value={paidOn} max={today()}
              onChange={(e) => setPaidOn(e.target.value)} style={{ ...input, width: 160 }} />
          </Field>
          <Field label="Reference (optional)" htmlFor={`pay-ref-${bill.id}`}>
            <input id={`pay-ref-${bill.id}`} name="reference" autoComplete="off" value={ref}
              onChange={(e) => setRef(e.target.value)} style={{ ...input, width: 200 }} />
          </Field>
          <Btn kind="primary" disabled={busy || !Number(amt)} onClick={() =>
            run(async () => {
              await api.recordPayment(bill.id, { amount: amt, paid_on: paidOn || undefined, reference: ref || undefined });
              setPaying(false); setAmt(""); setRef(""); setPaidOn(today());
            })}>
            Save payment
          </Btn>
        </div>
      )}
      {err && <div style={{ marginTop: 8 }}><Msg>{err}</Msg></div>}
    </div>
  );
}

function NewBillForm({ inst, templates, onDone }: { inst: api.Instalment; templates: api.BillTemplate[]; onDone: () => void }) {
  const [mode, setMode] = useState<"template" | "upload">(templates.length ? "template" : "upload");
  const [tpl, setTpl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [issue, setIssue] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const id = `nb-${inst.id}`;

  async function submit() {
    if (mode === "template" && !tpl) return setErr("Pick a template.");
    if (mode === "upload" && !file) return setErr("Choose a PDF to upload.");
    const fd = new FormData();
    fd.append("instalment", String(inst.id));
    if (mode === "template") fd.append("template", tpl); else fd.append("pdf_file", file!);
    if (amount.trim()) fd.append("amount", amount.trim());
    fd.append("issue", issue ? "true" : "false");
    setBusy(true); setErr(null);
    try { await api.createBill(fd); onDone(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div style={{ background: C.surface, borderRadius: 9, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
        <label><input type="radio" name={`${id}-mode`} checked={mode === "template"} onChange={() => setMode("template")} /> From template</label>
        <label><input type="radio" name={`${id}-mode`} checked={mode === "upload"} onChange={() => setMode("upload")} /> Upload my own PDF</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        {mode === "template" ? (
          <Field label="Template" htmlFor={`${id}-tpl`}>
            <select id={`${id}-tpl`} name="template" value={tpl} onChange={(e) => setTpl(e.target.value)} style={input}>
              <option value="">Select…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="PDF file" htmlFor={`${id}-pdf`}>
            <input id={`${id}-pdf`} name="pdf_file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={input} />
          </Field>
        )}
        <Field label="Amount (blank = full remaining)" htmlFor={`${id}-amt`}>
          <input id={`${id}-amt`} name="amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
        </Field>
      </div>
      <label style={{ fontSize: 13 }}><input type="checkbox" name="issue" checked={issue} onChange={(e) => setIssue(e.target.checked)} /> Issue now (shows to the client)</label>
      {err && <Msg>{err}</Msg>}
      <div><Btn kind="primary" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create bill"}</Btn></div>
    </div>
  );
}

export function InstalmentBlock({ inst, cur, templates, onChanged }: {
  inst: api.Instalment; cur: string; templates: api.BillTemplate[]; onChanged?: () => void;
}) {
  const [bills, setBills] = useState<api.Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    api.fetchBills(inst.id).then(setBills).catch((e) => setErr(errText(e)));
  }, [inst.id]);
  useEffect(load, [load]);
  const changed = () => { load(); onChanged?.(); };

  const label = inst.stage_name_snapshot ?? inst.stage_name ?? inst.name ?? inst.label ?? `Instalment ${inst.id}`;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5, color: C.t1 }}>{label}</strong>
        {inst.status && <StatusPill status={inst.status} />}
        <span style={{ fontSize: 12.5, color: C.t3 }}>
          {money(inst.amount, cur)} · Invoiced {money(inst.invoiced_amount, cur)} · Paid {money(inst.paid_amount, cur)}
        </span>
        <span style={{ flex: 1 }} />
        <Btn onClick={() => setOpen((v) => !v)}>{open ? "Close" : "New bill"}</Btn>
      </div>
      {open && <div style={{ marginTop: 10 }}><NewBillForm inst={inst} templates={templates} onDone={() => { setOpen(false); changed(); }} /></div>}
      {err && <div style={{ marginTop: 8 }}><Msg>{err}</Msg></div>}
      {bills.length === 0 && !err && <div style={{ fontSize: 12.5, color: C.t4, marginTop: 8 }}>No bills yet. Create one to invoice this instalment.</div>}
      {bills.map((b) => <BillRow key={b.id} bill={b} cur={cur} onChanged={changed} />)}
    </div>
  );
}

// Legacy standalone tab (the hub now uses ProjectFeesTab, which reuses InstalmentBlock).
export default function BillsTab({ orgId }: { orgId: number }) {
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [calcs, setCalcs] = useState<api.FeeCalc[]>([]);
  const [templates, setTemplates] = useState<api.BillTemplate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProjectId(""); setCalcs([]);
    api.fetchOrgProjects(orgId).then(setProjects).catch((e) => setErr(errText(e)));
    api.fetchTemplates(orgId).then(setTemplates).catch(() => setTemplates([]));
  }, [orgId]);

  const loadCalcs = useCallback(() => {
    if (!projectId) return setCalcs([]);
    setLoading(true); setErr(null);
    api.fetchProjectFeeCalcs(Number(projectId)).then(setCalcs).catch((e) => setErr(errText(e))).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(loadCalcs, [loadCalcs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <Field label="Project" htmlFor="bills-project">
          <select id="bills-project" name="project" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={input}>
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </Card>
      {err && <Msg>{err}</Msg>}
      {loading && <Card><span style={{ fontSize: 13, color: C.t3 }}>Loading fee calculations…</span></Card>}
      {projectId && !loading && !err && calcs.length === 0 && (
        <Card><span style={{ fontSize: 13, color: C.t3 }}>This project has no fee calculation yet.</span></Card>
      )}
      {calcs.map((c) => (
        <Card key={c.id} title={c.name ?? `Fee calculation ${c.id}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(c.instalments ?? []).length === 0 && (
              <div style={{ fontSize: 13, color: C.t3 }}>
                This fee calculation has no payment stages (instalments) yet, so there is nothing to bill.
              </div>
            )}
            {(c.instalments ?? []).map((i) => (
              <InstalmentBlock key={i.id} inst={i} cur={c.currency ?? "INR"} templates={templates} onChanged={loadCalcs} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}