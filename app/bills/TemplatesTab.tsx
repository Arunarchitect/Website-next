"use client";
// app/bills/TemplatesTab.tsx — upload / preview / delete SVG bill templates
import { useCallback, useEffect, useState } from "react";
import * as api from "./billsApi";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Card, Field, Msg, errText, input } from "./ui";

export default function TemplatesTab({ orgId }: { orgId: number }) {
  const [items, setItems] = useState<api.BillTemplate[]>([]);
  const [tokens, setTokens] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(() => {
    api.fetchTemplates(orgId).then(setItems).catch((e) => setErr(errText(e)));
  }, [orgId]);
  useEffect(load, [load]);
  useEffect(() => {
    api.fetchTokens().then((d) => {
      // GUESS: tokens come back as string[] or {tokens: string[]} or [{token, description}]
      const raw = Array.isArray(d) ? d : ((d as { tokens?: unknown[] })?.tokens ?? []);
      setTokens(raw.map((t) => (typeof t === "string" ? t : String((t as { token?: string }).token ?? JSON.stringify(t)))));
    }).catch(() => setTokens([]));
  }, []);

  async function upload() {
    if (!name.trim() || !file) return setErr("Enter a name and choose an SVG file.");
    const fd = new FormData();
    fd.append("organisation", String(orgId));   // GUESS: field name
    fd.append("name", name.trim());
    fd.append("svg_file", file);
    setBusy(true); setErr(null); setOk(null);
    try { await api.uploadTemplate(fd); setName(""); setFile(null); setOk("Template uploaded."); load(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setErr(null);
    try { await fn(); load(); } catch (e) { setErr(errText(e)); }
  }

  return (
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
        <div style={{ marginTop: 10 }}><Btn kind="primary" disabled={busy} onClick={upload}>{busy ? "Uploading…" : "Upload template"}</Btn></div>
        {err && <div style={{ marginTop: 10 }}><Msg>{err}</Msg></div>}
        {ok && <div style={{ marginTop: 10 }}><Msg kind="ok">{ok}</Msg></div>}
      </Card>

      <Card title="Your templates">
        {items.length === 0 && <div style={{ fontSize: 13, color: C.t4 }}>No templates yet. Upload an SVG based on sample_bill_template.svg.</div>}
        {items.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${C.border}`, padding: "9px 0" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{t.name}</span>
            <Btn onClick={() => act(() => api.previewTemplate(t.id))}>Preview PDF</Btn>
            <Btn kind="danger" onClick={() => act(() => api.deleteTemplate(t.id), `Delete template "${t.name}"?`)}>Delete</Btn>
          </div>
        ))}
      </Card>

      <Card title="Tokens you can use in the SVG">
        {tokens.length === 0 ? <div style={{ fontSize: 13, color: C.t4 }}>Token list unavailable.</div> : (
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
  );
}
