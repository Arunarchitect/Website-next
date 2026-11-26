"use client";
// app/bills/my/page.tsx — client portal: issued bills for the signed-in client
import { useEffect, useState } from "react";
import Link from "next/link";
import { C } from "../feecalc/feeCalcTypes";
import { fetchMyBills, downloadBill, type MyBill } from "./billsApi";
import { Btn, Card, Msg, StatusPill, errText, money } from "./ui";

export default function MyBillsPage() {
  const [bills, setBills] = useState<MyBill[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const has = !!localStorage.getItem("access");
    setSignedIn(has);
    if (has) fetchMyBills().then(setBills).catch((e) => setErr(errText(e)));
  }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}><Link href="/login">Sign in to see your bills</Link></div>;

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", padding: "22px 20px 60px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, margin: 0 }}>My bills</h1>
        {err && <Msg>{err}</Msg>}
        {bills && bills.length === 0 && <Card><span style={{ fontSize: 13, color: C.t3 }}>No bills have been issued to you yet.</span></Card>}
        {bills?.map((b) => {
          const num = b.number ?? b.bill_number ?? `Bill ${b.id}`;
          return (
            <Card key={b.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ color: C.t1 }}>{num}</strong>
                <StatusPill status={b.status} />
                {b.project_name && <span style={{ fontSize: 12.5, color: C.t3 }}>{b.project_name}</span>}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 13.5, color: C.t2 }}>{money(b.amount, b.currency ?? "INR")}</span>
                <Btn onClick={() => downloadBill(b.id, String(num)).catch((e) => setErr(errText(e)))}>Download PDF</Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
