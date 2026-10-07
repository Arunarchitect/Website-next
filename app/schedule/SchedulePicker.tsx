"use client";

import { useEffect, useMemo, useState } from "react";
import { type MyProject } from "./api";

// ---------- Org → Project → Schedule picker ----------
// ---------- Org → Project → Schedule picker ----------
export default function SchedulePicker({
  projects,
  orgName,
  projectId,
  scheduleId,
  onPick,
}: {
  projects: MyProject[];
  orgName: string | null;
  projectId: number | null;
  scheduleId: number | null;
  onPick: (projectId: number, scheduleId: number | null) => void;
}) {
  const orgs = useMemo(() => {
    const m = new Map<string, MyProject[]>();
    for (const p of projects) {
      if (!m.has(p.organisation)) m.set(p.organisation, []);
      m.get(p.organisation)!.push(p);
    }
    return Array.from(m.entries());
  }, [projects]);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(orgName);

  useEffect(() => {
    setSelectedOrg(orgName);
  }, [orgName]);

  const visibleProjects = useMemo(
    () => projects.filter((p) => p.organisation === selectedOrg),
    [projects, selectedOrg]
  );

  const currentProject = visibleProjects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={selectedOrg ?? ""}
        onChange={(e) => setSelectedOrg(e.target.value || null)}
        className="rounded border bg-white px-2 py-1.5"
        title="Organisation"
      >
        {orgs.map(([name]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        value={projectId ?? ""}
        onChange={(e) => {
          const pid = Number(e.target.value);
          const p = projects.find((x) => x.id === pid);
          onPick(pid, p?.schedules[0]?.id ?? null);
        }}
        className="rounded border bg-white px-2 py-1.5"
        title="Project"
      >
        {visibleProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isCompleted ? " (completed)" : ""}
            {p.canEdit ? "" : " · read-only"}
          </option>
        ))}
      </select>

      {currentProject && currentProject.schedules.length > 1 && (
        <select
          value={scheduleId ?? ""}
          onChange={(e) => onPick(currentProject.id, Number(e.target.value))}
          className="rounded border bg-white px-2 py-1.5"
          title="Schedule"
        >
          {currentProject.schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.predefinedType})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}