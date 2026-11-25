"use client";

/* app/inventory/plans/page.tsx */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, listMyProjects, money, type Project } from "../inventoryApi";
import {
  KINDS,
  PLAN_STATUSES,
  createPlan,
  deletePlan,
  listPlans,
  ghostBtn,
  primaryBtn,
  type Plan,
  type PlanInput,
} from "../planApi";
import { NewPlanDialog } from "./PlanDialogs";

const labelOf = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((o) => o.value === v)?.label ?? v;

const statusStyle: Record<string, string> = {
  PLANNING: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-amber-50 text-amber-900",
  DONE: "bg-emerald-50 text-emerald-900",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const organisations = useMemo(() => {
    const m = new Map<number, string>();
    projects.forEach((p) => m.set(p.organisation_id, p.organisation_name));
    return [...m].map(([id, name]) => ({ id, name }));
  }, [projects]);

  useEffect(() => {
    Promise.all([listPlans(), listMyProjects()])
      .then(([pl, pr]) => {
        setPlans(pl);
        setProjects(pr);
      })
      .catch((e) => setError(getApiErrorMessage(e, "Couldn’t load your plans.")))
      .finally(() => setLoading(false));
  }, []);

  async function create(v: PlanInput) {
    const plan = await createPlan(v);
    router.push(`/inventory/plans/${plan.id}`);
  }

  async function remove(p: Plan) {
    if (!window.confirm(`Delete the plan "${p.name}"? Your inventory is not changed.`)) return;
    try {
      await deletePlan(p.id);
      setPlans((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(getApiErrorMessage(e, "Couldn’t delete the plan."));
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Plans</h1>
          <p className="text-sm text-slate-600">Trips, moves and events: what to take and what to buy.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory" className={ghostBtn}>
            Back to inventory
          </Link>
          <button onClick={() => setNewOpen(true)} className={primaryBtn}>
            New plan
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">
          {error}{" "}
          <button className="underline" onClick={() => setError("")}>
            Dismiss
          </button>
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && plans.length === 0 && (
        <p className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No plans yet. Create one for your next trip.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const pct = p.total_lines ? Math.round((p.done_lines / p.total_lines) * 100) : 0;
          const dates = [fmtDate(p.start_date), fmtDate(p.end_date)].filter(Boolean).join(" – ");
          return (
            <li key={p.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/inventory/plans/${p.id}`}
                  className="text-base font-semibold text-slate-900 underline-offset-2 hover:underline"
                >
                  {p.name}
                </Link>
                <span className={`rounded px-2 py-0.5 text-xs ${statusStyle[p.status]}`}>
                  {labelOf(PLAN_STATUSES, p.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {labelOf(KINDS, p.kind)}
                {dates && ` · ${dates}`}
              </p>
              <p className="mt-3 text-sm text-slate-800">
                {p.done_lines} of {p.total_lines} ready
                {Number(p.est_total) > 0 && ` · to buy about ${money(p.est_total)}`}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-100" aria-hidden="true">
                <div className="h-full bg-slate-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex justify-end gap-3 text-sm">
                <Link href={`/inventory/plans/${p.id}`} className="text-slate-700 underline">
                  Open
                </Link>
                <button className="text-rose-700 underline" onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {newOpen && <NewPlanDialog organisations={organisations} onCreate={create} onClose={() => setNewOpen(false)} />}
    </main>
  );
}
