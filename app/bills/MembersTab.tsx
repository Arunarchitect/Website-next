"use client";
// app/bills/MembersTab.tsx — org membership admin (org-wide admins only)
import { useCallback, useEffect, useState } from "react";
import * as api from "./billsApi";
import { C } from "../feecalc/feeCalcTypes";
import { Btn, Busy, Card, Field, ListSkeleton, Msg, errText, input } from "./ui";

const ROLES = ["admin", "manager", "member", "client"];
const who = (m: api.Member) =>
  m.user_email ?? m.email ?? (typeof m.user === "object" ? (m.user?.email ?? m.user?.username) : undefined) ?? `User ${String(m.user ?? m.id)}`;

export default function MembersTab({ orgId }: { orgId: number }) {
  const [rows, setRows] = useState<api.Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    return api.fetchMembers(orgId).then(setRows).catch((e) => setErr(errText(e))).finally(() => setLoading(false));
  }, [orgId]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  async function act(fn: () => Promise<unknown>, label: string, confirmMsg?: string) {
    if (busy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(label); setErr(null);
    try { await fn(); await load(); } catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  }

  return (
    <Busy on={!!busy} label={busy ?? ""}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card title="Add a member">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Field label="Email" htmlFor="mem-email">
              <input id="mem-email" name="email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, width: 260 }} />
            </Field>
            <Field label="Role" htmlFor="mem-role">
              <select id="mem-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} style={{ ...input, width: 140 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Btn kind="primary" disabled={!!busy || !email.trim()} onClick={() => act(async () => { await api.addMember(orgId, { email: email.trim(), role }); setEmail(""); }, "Adding member…")}>
              Add member
            </Btn>
          </div>
        </Card>
        {err && <Msg>{err}</Msg>}
        <Card title="Members">
          {loading && <ListSkeleton rows={3} />}
          {!loading && rows.length === 0 && !err && <div style={{ fontSize: 13, color: C.t4 }}>No members found.</div>}
          {!loading && rows.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", borderTop: `1px solid ${C.border}`, padding: "9px 0", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 13.5, color: C.t1 }}>
                {who(m)}
                {m.project_name && <span style={{ color: C.t4, fontSize: 12 }}> · limited to {m.project_name}</span>}
              </span>
              <select aria-label={`Role for ${who(m)}`} id={`role-${m.id}`} name={`role-${m.id}`} value={m.role} disabled={!!busy}
                onChange={(e) => act(() => api.updateMember(m.id, { role: e.target.value }), "Updating role…")} style={{ ...input, width: 130 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Btn kind="danger" disabled={!!busy} onClick={() => act(() => api.removeMember(m.id), "Removing member…", `Remove ${who(m)} from this organisation?`)}>Remove</Btn>
            </div>
          ))}
        </Card>
      </div>
    </Busy>
  );
}