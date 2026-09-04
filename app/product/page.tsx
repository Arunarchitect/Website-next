"use client";

import { useMemo, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import {
  Role,
  Space,
  PROJECTS,
  SPACES,
  CATEGORIES,
  ITEMS,
  INITIAL_ASSIGNMENTS,
  Assignment,
} from "./data";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

function statusLabel(a: Assignment): string {
  if (a.clientConfirmed && a.architectConfirmed) return "Confirmed";
  const waitingOn = a.proposedBy === "client" ? "architect" : "client";
  return `Awaiting ${waitingOn} confirmation`;
}

export default function ProductPage() {
  const [role, setRole] = useState<Role>("client");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [spaceId, setSpaceId] = useState(
    SPACES.find((s) => s.projectId === PROJECTS[0].id)?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);

  const spacesForProject = useMemo(
    () => SPACES.filter((s) => s.projectId === projectId),
    [projectId]
  );
  const itemsForCategory = useMemo(
    () => ITEMS.filter((i) => i.categoryId === categoryId),
    [categoryId]
  );
  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.projectId === projectId && a.spaceId === spaceId),
    [assignments, projectId, spaceId]
  );
  const currentSpaceName = spacesForProject.find((s) => s.id === spaceId)?.name ?? "";

  // How much of a space's architect-defined requirement is met
  function spaceProgress(space: Space) {
    const req = space.requiredCategoryIds;
    if (req.length === 0) return { confirmed: 0, total: 0 };
    const confirmedCats = new Set(
      assignments
        .filter((a) => a.spaceId === space.id && a.clientConfirmed && a.architectConfirmed)
        .map((a) => ITEMS.find((i) => i.id === a.itemId)?.categoryId)
    );
    const confirmed = req.filter((c) => confirmedCats.has(c)).length;
    return { confirmed, total: req.length };
  }

  const fullySpecifiedCount = spacesForProject.filter((s) => {
    const p = spaceProgress(s);
    return p.total > 0 && p.confirmed === p.total;
  }).length;

  // Per-category requirement status for the selected space
  const requirements = useMemo(() => {
    const space = SPACES.find((s) => s.id === spaceId);
    if (!space) return [];
    return space.requiredCategoryIds.map((catId) => {
      const cat = CATEGORIES.find((c) => c.id === catId)!;
      const inCat = assignments.filter(
        (a) => a.spaceId === spaceId && ITEMS.find((i) => i.id === a.itemId)?.categoryId === catId
      );
      const confirmed = inCat.some((a) => a.clientConfirmed && a.architectConfirmed);
      const pending = !confirmed && inCat.length > 0;
      return {
        category: cat,
        status: confirmed ? "confirmed" : pending ? "pending" : "needed",
      } as const;
    });
  }, [spaceId, assignments]);

  // Usage stats per item, across every project/space
  const itemStats = useMemo(() => {
    const map = new Map<string, { projects: Set<string>; confirmed: number; pending: number }>();
    assignments.forEach((a) => {
      const entry = map.get(a.itemId) ?? { projects: new Set<string>(), confirmed: 0, pending: 0 };
      entry.projects.add(a.projectId);
      if (a.clientConfirmed && a.architectConfirmed) entry.confirmed += 1;
      else entry.pending += 1;
      map.set(a.itemId, entry);
    });
    return map;
  }, [assignments]);

  function handleProjectChange(id: string) {
    setProjectId(id);
    const first = SPACES.find((s) => s.projectId === id);
    setSpaceId(first?.id ?? "");
  }

  function proposeItem(itemId: string) {
    if (!spaceId) return;
    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      projectId,
      spaceId,
      itemId,
      proposedBy: role,
      clientConfirmed: role === "client",
      architectConfirmed: role === "architect",
      createdAt: new Date().toISOString(),
    };
    setAssignments((prev) => [...prev, newAssignment]);
  }

  function confirmAssignment(id: string) {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              clientConfirmed: role === "client" ? true : a.clientConfirmed,
              architectConfirmed: role === "architect" ? true : a.architectConfirmed,
            }
          : a
      )
    );
  }

  function removeAssignment(id: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-screen font-[var(--font-body)] bg-[#EDEFEA] text-[#1C2521]`}
    >
      {/* Header */}
      <header className="border-b border-[#DCE0D8] bg-[#EDEFEA]/90 backdrop-blur px-6 sm:px-10 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs tracking-wide text-[#6B7570]">Modelflick</p>
          <h1 className="font-[var(--font-display)] text-xl sm:text-2xl font-medium">
            Fixture & product assignment
          </h1>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#DCE0D8] rounded-full p-1">
          {(["client", "architect"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-4 py-1.5 rounded-full text-sm capitalize transition-colors ${
                role === r
                  ? "bg-[#2F6E62] text-white"
                  : "text-[#4B5650] hover:bg-[#EDEFEA]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-12">
        {/* Project */}
        <section>
          <p className="text-sm text-[#6B7570] mb-3">Project</p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {PROJECTS.map((p) => {
              const active = p.id === projectId;
              const spacesForP = SPACES.filter((s) => s.projectId === p.id);
              const fullyForP = spacesForP.filter((s) => {
                const prog = spaceProgress(s);
                return prog.total > 0 && prog.confirmed === prog.total;
              }).length;
              return (
                <button
                  key={p.id}
                  onClick={() => handleProjectChange(p.id)}
                  className={`text-left min-w-[220px] rounded-2xl border px-5 py-4 transition-colors ${
                    active
                      ? "border-[#2F6E62] bg-white"
                      : "border-[#DCE0D8] bg-white/60 hover:bg-white"
                  }`}
                >
                  <span className="font-[var(--font-display)] text-lg block">
                    {p.name}
                  </span>
                  <span className="text-xs text-[#6B7570]">
                    {spacesForP.length} spaces · {fullyForP} fully specified
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Space */}
        <section>
          <p className="text-sm text-[#6B7570] mb-3">
            Spaces · {fullySpecifiedCount} of {spacesForProject.length} fully specified
          </p>
          <div className="flex gap-3 flex-wrap">
            {spacesForProject.map((s) => {
              const active = s.id === spaceId;
              const prog = spaceProgress(s);
              return (
                <button
                  key={s.id}
                  onClick={() => setSpaceId(s.id)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm border transition-colors ${
                    active
                      ? "bg-[#2F6E62] border-[#2F6E62] text-white"
                      : "bg-white border-[#DCE0D8] text-[#1C2521] hover:border-[#2F6E62]"
                  }`}
                >
                  {s.name}
                  {prog.total > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        active ? "bg-white/20" : "bg-[#EDEFEA] text-[#6B7570]"
                      }`}
                    >
                      {prog.confirmed}/{prog.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Requirements checklist for selected space */}
        {requirements.length > 0 && (
          <section>
            <h2 className="font-[var(--font-display)] text-xl mb-3">
              What {currentSpaceName || "this space"} needs
            </h2>
            <div className="flex flex-wrap gap-2">
              {requirements.map((r) => {
                const style =
                  r.status === "confirmed"
                    ? "bg-[#E4EFEB] border-[#2F6E62] text-[#2F6E62]"
                    : r.status === "pending"
                    ? "bg-[#F3E9D8] border-[#B8802F] text-[#8A5E20]"
                    : "bg-white border-dashed border-[#C7CDC3] text-[#6B7570]";
                return (
                  <button
                    key={r.category.id}
                    onClick={() => setCategoryId(r.category.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${style}`}
                    title="Jump to catalog"
                  >
                    {r.category.label}
                    <span className="ml-2 text-xs opacity-80 capitalize">
                      {r.status === "needed" ? "not selected" : r.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Assigned items */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-[var(--font-display)] text-xl">
              Assigned to {currentSpaceName || "—"}
            </h2>
            <span className="text-sm text-[#6B7570]">
              {assignmentsForSpace.length} item{assignmentsForSpace.length === 1 ? "" : "s"}
            </span>
          </div>

          {assignmentsForSpace.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#C7CDC3] bg-white/50 px-6 py-10 text-center text-sm text-[#6B7570]">
              Nothing assigned yet. Choose an item from the catalog below.
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentsForSpace.map((a) => {
                const item = ITEMS.find((i) => i.id === a.itemId);
                if (!item) return null;
                const bothConfirmed = a.clientConfirmed && a.architectConfirmed;
                const canConfirm =
                  (role === "client" && !a.clientConfirmed) ||
                  (role === "architect" && !a.architectConfirmed);

                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-5 rounded-2xl border border-[#DCE0D8] bg-white px-5 py-4"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-[var(--font-display)] text-lg leading-tight truncate">
                        {item.label}
                      </div>
                      <div className="text-sm text-[#6B7570]">
                        {item.manufacturer} — {item.model}
                      </div>
                      <div className="text-xs text-[#8A938E] capitalize mt-0.5">
                        Proposed by {a.proposedBy}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${
                          bothConfirmed
                            ? "bg-[#E4EFEB] text-[#2F6E62]"
                            : "bg-[#F3E9D8] text-[#8A5E20]"
                        }`}
                      >
                        {statusLabel(a)}
                      </span>
                      <div className="flex gap-2">
                        {canConfirm && (
                          <button
                            onClick={() => confirmAssignment(a.id)}
                            className="text-xs bg-[#2F6E62] text-white rounded-full px-3 py-1.5"
                          >
                            Confirm
                          </button>
                        )}
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="text-xs border border-[#DCE0D8] rounded-full px-3 py-1.5 hover:bg-[#EDEFEA]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Catalog */}
        <section>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-[var(--font-display)] text-xl">Catalog</h2>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                    categoryId === c.id
                      ? "bg-[#1C2521] border-[#1C2521] text-white"
                      : "bg-white border-[#DCE0D8] text-[#1C2521] hover:border-[#1C2521]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {itemsForCategory.map((item) => {
              const stats = itemStats.get(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#DCE0D8] bg-white overflow-hidden hover:shadow-md transition-shadow"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-4">
                    <div className="font-[var(--font-display)] text-base">{item.label}</div>
                    <div className="text-sm text-[#6B7570]">
                      {item.manufacturer} — {item.model}
                    </div>
                    {item.productLink && (
                        <a
                      
                        href={item.productLink}
                        target="_blank"
                        className="text-xs text-[#2F6E62] underline underline-offset-2"
                      >
                        Product link
                      </a>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stats ? (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#EDEFEA] text-[#4B5650]">
                            {stats.projects.size} project{stats.projects.size === 1 ? "" : "s"}
                          </span>
                          {stats.confirmed > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E4EFEB] text-[#2F6E62]">
                              {stats.confirmed} confirmed
                            </span>
                          )}
                          {stats.pending > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3E9D8] text-[#8A5E20]">
                              {stats.pending} pending
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#8A938E]">Not yet used</span>
                      )}
                    </div>

                    <button
                      onClick={() => proposeItem(item.id)}
                      disabled={!spaceId}
                      className="mt-3 w-full text-sm bg-[#1C2521] text-white rounded-full py-2 disabled:opacity-40"
                    >
                      {role === "client" ? "Select for this space" : "Suggest for this space"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}