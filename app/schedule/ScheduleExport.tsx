"use client";

import { useState } from "react";
import type { Sequence, Task, SchedulePerson } from "./data";
import type { SerializedCalendar } from "./calendar";
import { LINK_RULES } from "./JsonTool";

const INSTRUCTIONS = [
  "You are editing a whole construction schedule. Do what the user asks by changing tasks[] and sequences[], then reply with the COMPLETE JSON object only (no markdown fences, no commentary).",
  "Return EVERY task you want to keep. A task or link that is missing from your reply will be DELETED when the JSON is pasted back.",
  "Keep all field names exactly as they are. Do not add new top-level keys.",
  "id: unique string. Keep existing ids. New tasks get short readable unique ids, e.g. 'a-new-excavation'.",
  "parentId: null for top-level, or the id of another task in tasks[] (a group/phase).",
  "scheduleStart / scheduleFinish: ISO dates YYYY-MM-DD, finish >= start. Group rows (tasks that have children) get their dates and completion from their children automatically; do not try to set them.",
  "completion: 0-100. isMilestone: true for single-day markers. linkedElements: leave as [] unless you have IFC global ids.",
  "assigneeIds: list of person ids taken from people[] (id + name). Use only ids that exist in people[]; never invent ids. Only leaf tasks get assignees.",
  "baselineStart/baselineFinish/actualStart/actualFinish: leave exactly as given unless the user explicitly asks to change them.",
  ...LINK_RULES,
  "calendar and people are read-only context. Return them unchanged or omit them.",
];

interface Props {
  tasks: Task[];
  sequences: Sequence[];
  calendar: SerializedCalendar;
  people?: SchedulePerson[];
}

export default function ScheduleExport({
  tasks,
  sequences,
  calendar,
  people = [],
}: Props) {
  const [flash, setFlash] = useState<string | null>(null);

  const flashFor = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }
  };

  const peopleList = people.map((p) => ({ id: p.id, name: p.name }));

  const copyForAI = async () => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const groupIds = [
      ...new Set(tasks.map((t) => t.parentId).filter((x): x is string => !!x)),
    ];
    const payload = {
      _instructions: INSTRUCTIONS,
      calendar,
      people: peopleList,
      groupIds, // read-only: never link these
      tasks,
      sequences: sequences.map((s) => ({
        id: s.id,
        relatingTask: s.relatingTask, // predecessor
        relatedTask: s.relatedTask, // successor
        sequenceType: s.sequenceType,
        lagDays: s.lagDays,
      })),
      // read-only helper so the AI can see what each link means
      _linkMeanings: sequences.map(
        (s) =>
          `${s.id}: "${byId.get(s.relatingTask)?.name ?? s.relatingTask}" (predecessor) ${s.sequenceType} "${byId.get(s.relatedTask)?.name ?? s.relatedTask}" (successor), lag ${s.lagDays}d`
      ),
    };
    const ok = await copyText(JSON.stringify(payload, null, 2));
    flashFor(ok ? `Copied for AI (${tasks.length} tasks)` : "Copy failed");
  };

  const copyPlain = async () => {
    const payload = { calendar, people: peopleList, tasks, sequences };
    const ok = await copyText(JSON.stringify(payload, null, 2));
    flashFor(ok ? `Copied ${tasks.length} tasks` : "Copy failed");
  };

  return (
    <div className="relative flex items-center gap-2" data-print-hide>
      <button
        onClick={() => void copyForAI()}
        className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        title="Copy the current schedule as JSON with an inline _instructions block — paste into ChatGPT/Claude and ask it to modify or extend."
      >
        Copy for AI
      </button>

      <button
        onClick={() => void copyPlain()}
        className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        title="Copy the current schedule as clean JSON — no metadata, no instructions."
      >
        Copy JSON
      </button>

      {flash && (
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[11px] text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  );
}