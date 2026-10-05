"use client";

import { useState } from "react";
import type { Sequence, Task } from "./data";
import type { SerializedCalendar } from "./calendar";

const INSTRUCTIONS = [
  "Fill in tasks[] and sequences[]. Keep all field names as-is.",
  "id: any unique string (client id). Use short readable ids like 'a-excavation'.",
  "parentId: null for top-level, or the id of another task to nest under it.",
  "scheduleStart / scheduleFinish: ISO dates YYYY-MM-DD. Finish must be >= start.",
  "completion: 0-100. isMilestone: true for single-day markers.",
  "linkedElements: leave as [] unless you have IFC global ids.",
  "sequences[]: each entry links two task ids.",
  "  sequenceType: FINISH_START | START_START | FINISH_FINISH | START_FINISH",
  "  lagDays: integer; negative = lead.",
  "Group tasks (those with children) should NOT be linked — link leaves only.",
  "Return ONLY valid JSON, no markdown fences, no commentary.",
];

interface Props {
  tasks: Task[];
  sequences: Sequence[];
  calendar: SerializedCalendar;
}

export default function ScheduleExport({ tasks, sequences, calendar }: Props) {
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

  const copyForAI = async () => {
    const payload = {
      _instructions: INSTRUCTIONS,
      calendar,
      tasks,
      sequences,
    };
    const ok = await copyText(JSON.stringify(payload, null, 2));
    flashFor(ok ? `Copied for AI (${tasks.length} tasks)` : "Copy failed");
  };

  const copyPlain = async () => {
    const payload = { calendar, tasks, sequences };
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