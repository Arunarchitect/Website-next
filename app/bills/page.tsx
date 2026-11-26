"use client";
// app/bills/page.tsx — tab hub for staff (org-wide admin / manager)
import { useEffect, useState } from "react";
import Link from "next/link";
import { C } from "../feecalc/feeCalcTypes";
import {
  fetchAdminOrganisations,
  type AdminOrganisation,
} from "../feecalc/create/feeCalcAdminApi";
import ProjectFeesTab from "./ProjectFeesTab";
import FeeTemplatesTab from "./FeeTemplatesTab";
import TemplatesTab from "./TemplatesTab";
import MembersTab from "./MembersTab";
import { BarLoader, Card, Msg, Skeleton, errText, input } from "./ui";

const TABS = [
  { id: "fees", label: "Project fees" },
  { id: "templates", label: "Fee templates" },
  { id: "billtpl", label: "Bill templates" },
  { id: "members", label: "Members" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function BillsHub() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [orgs, setOrgs] = useState<AdminOrganisation[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("fees");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const has = !!localStorage.getItem("access");
    setSignedIn(has);
    setReady(true);
    if (!has) return;
    fetchAdminOrganisations()
      .then((l) => {
        setOrgs(l);
        if (l.length === 1) setOrgId(l[0].id);
      })
      .catch((e) => setErr(errText(e)))
      .finally(() => setOrgsLoading(false));
  }, []);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
        <h2 style={{ color: C.t1 }}>Sign in required</h2>
        <Link href="/auth/login" style={{ color: C.amber, fontWeight: 600 }}>
          Go to login
        </Link>
      </div>
    );
  }

  const orgName = orgs.find((o) => o.id === orgId)?.name;

  return (
    <div
      style={{
        background: "#f9fafb",
        minHeight: "100vh",
        padding: "22px 20px 60px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, margin: 0 }}>
            Billing{orgName ? ` — ${orgName}` : ""}
          </h1>
          <Link href="/feecalc/create" style={{ fontSize: 13, color: C.t3 }}>
            Proposals (fee quotes)
          </Link>
        </div>

        {err && <Msg>{err}</Msg>}

        {orgsLoading && (
          <Card>
            <div role="status" aria-label="Loading organisations">
              <BarLoader />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                <Skeleton w={90} h={12} />
                <Skeleton h={36} r={8} />
              </div>
            </div>
          </Card>
        )}

        {!orgsLoading && orgs.length === 0 && !err && (
          <Card>
            <span style={{ fontSize: 13, color: C.t3 }}>
              You need an admin or manager role in an organisation to manage
              bills.
            </span>
          </Card>
        )}
        {orgs.length > 1 && (
          <Card>
            <label
              htmlFor="bills-org"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.t3,
                display: "block",
                marginBottom: 4,
              }}
            >
              Organisation
            </label>
            <select
              id="bills-org"
              name="organisation"
              value={orgId ?? ""}
              onChange={(e) =>
                setOrgId(e.target.value ? Number(e.target.value) : null)
              }
              style={input}
            >
              <option value="">Select organisation…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Card>
        )}

        {orgId && (
          <>
            <div
              role="tablist"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "9px 14px",
                    fontSize: 13.5,
                    cursor: "pointer",
                    fontWeight: tab === t.id ? 700 : 500,
                    color: tab === t.id ? C.amber : C.t3,
                    borderBottom: `2px solid ${tab === t.id ? C.amber : "transparent"}`,
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* kept mounted so the selected project survives tab switches */}
            <div style={{ display: tab === "fees" ? "block" : "none" }}>
              <ProjectFeesTab
                orgId={orgId}
                active={tab === "fees"}
                onNavigate={(t) => setTab(t as TabId)}
              />
            </div>
            {tab === "templates" && <FeeTemplatesTab orgId={orgId} />}
            {tab === "billtpl" && <TemplatesTab orgId={orgId} />}
            {tab === "members" && <MembersTab orgId={orgId} />}
          </>
        )}
      </div>
    </div>
  );
}