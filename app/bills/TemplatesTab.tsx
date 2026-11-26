"use client";
// app/bills/TemplatesTab.tsx — upload / preview / delete SVG bill templates
import { useCallback, useEffect, useState } from "react";
import * as api from "./billsApi";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Busy, Card, Field, ListSkeleton, Msg, Skeleton, errText, input } from "./ui";

export default function TemplatesTab({ orgId }: { orgId: number }) {
  const [items, setItems] = useState<api.BillTemplate[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // label of the running action
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(() => {
    return api.fetchTemplates(orgId).then(setItems).catch((e) => setErr(errText(e))).finally(() => setLoading(false));
  }, [orgId]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    api.fetchTokens().then((d) => {
      // GUESS: tokens come back as string[] or {tokens: string[]} or [{token, description}]
      const raw = Array.isArray(d) ? d : ((d as { tokens?: unknown[] })?.tokens ?? []);
      setTokens(raw.map((t) => (typeof t === "string" ? t : String((t as { token?: string }).token ?? JSON.stringify(t)))));
    }).catch(() => setTokens([])).finally(() => setTokensLoading(false));
  }, []);

  async function upload() {
    if (busy) return;
    if (!name.trim() || !file) return setErr("Enter a name and choose an SVG file.");
    const fd = new FormData();
    fd.append("organisation", String(orgId));   // GUESS: field name
    fd.append("name", name.trim());
    fd.append("svg_file", file);
    setBusy("Uploading template…"); setErr(null); setOk(null);
    try { await api.uploadTemplate(fd); setName(""); setFile(null); setOk("Template uploaded."); await load(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  }
  async function act(fn: () => Promise<unknown>, label: string, confirmMsg?: string, reload = true) {
    if (busy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(label); setErr(null); setOk(null);
    try { await fn(); if (reload) await load(); } catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  }

  return (
    <Busy on={!!busy} label={busy ?? ""}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card title="Upload a template">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <Field label="Name" htmlFor="tpl-name">
              <input id="tpl-name" name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} style={input} />
            </Field>
            <Field label="SVG file (A4, 210×297 mm)" htmlFor="tpl-svg">
              <input id="tpl-svg" name="svg_file" type="file" accept=".svg,image/svg+xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={input} />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}><Btn kind="primary" disabled={!!busy} onClick={upload}>{busy === "Uploading template…" ? "Uploading…" : "Upload template"}</Btn></div>
          {err && <div style={{ marginTop: 10 }}><Msg>{err}</Msg></div>}
          {ok && <div style={{ marginTop: 10 }}><Msg kind="ok">{ok}</Msg></div>}
        </Card>

        <Card title="Your templates">
          {loading && <ListSkeleton rows={2} />}
          {!loading && items.length === 0 && <div style={{ fontSize: 13, color: C.t4 }}>No templates yet. Upload an SVG based on sample_bill_template.svg.</div>}
          {!loading && items.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${C.border}`, padding: "9px 0" }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{t.name}</span>
              <Btn disabled={!!busy} onClick={() => act(() => api.previewTemplate(t.id), "Rendering preview…", undefined, false)}>Preview PDF</Btn>
              <Btn kind="danger" disabled={!!busy} onClick={() => act(() => api.deleteTemplate(t.id), "Deleting template…", `Delete template "${t.name}"?`)}>Delete</Btn>
            </div>
          ))}
        </Card>

        <Card title="Tokens you can use in the SVG">
          {tokensLoading ? (
            <div role="status" aria-label="Loading" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[90, 110, 80, 120, 100, 85, 130, 95].map((w, i) => <Skeleton key={i} w={w} h={22} r={5} />)}
            </div>
          ) : tokens.length === 0 ? <div style={{ fontSize: 13, color: C.t4 }}>Token list unavailable.</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tokens.map((t) => (
                <code key={t} style={{ fontSize: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "2px 7px" }}>{t}</code>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.t4, marginTop: 10 }}>
            SVG text doesn&apos;t wrap, so keep values short. Convert Malayalam or other complex-script text to paths.
          </div>
        </Card>
      </div>
    </Busy>
  );
}