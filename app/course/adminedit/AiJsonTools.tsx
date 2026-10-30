"use client";

import { useState } from "react";
import type { AdminCourse } from "../api/adminApi";
import {
  applyChapterJson,
  applyCourseJson,
  chapterToAiJson,
  courseToAiJson,
  parseAiJson,
} from "./aiJson";

type Edit = (fn: (c: AdminCourse) => void) => void;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export default function AiJsonTools({
  course, chapterKey, edit,
}: { course: AdminCourse; chapterKey: string | null; edit: Edit }) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [scope, setScope] = useState<"chapter" | "course">("course");

  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(""), 3500);
  };

  async function copyChapter() {
    for (const m of course.modules) {
      const ch = m.chapters.find((x) => x._key === chapterKey);
      if (ch) {
        await copyText(JSON.stringify(chapterToAiJson(ch, m.title), null, 2));
        flash("✓ Chapter JSON copied");
        return;
      }
    }
  }

  async function copyCourse() {
    await copyText(JSON.stringify(courseToAiJson(course), null, 2));
    flash("✓ Course JSON copied");
  }

  function apply() {
    setErr("");
    try {
      const data = parseAiJson(text);
      const run = (c: AdminCourse) =>
        scope === "chapter" && chapterKey
          ? applyChapterJson(c, chapterKey, data)
          : applyCourseJson(c, data);

      run(structuredClone(course)); // dry run: throws before touching the editor
      let msg = "";
      edit((c) => { msg = run(c); });
      setOpen(false);
      setText("");
      flash(msg || "Applied. Review, then Save.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <button type="button" className="ae-btn light" disabled={!chapterKey} onClick={copyChapter}
        title={chapterKey ? "Copy selected chapter as JSON" : "Select a chapter first"}>
        ⧉ Chapter JSON
      </button>
      <button type="button" className="ae-btn light" onClick={copyCourse}>⧉ Course JSON</button>
      <button type="button" className="ae-btn light"
        onClick={() => { setScope(chapterKey ? "chapter" : "course"); setErr(""); setOpen(true); }}>
        ⇩ Paste AI JSON
      </button>
      {note && <span className="ae-status ok">{note}</span>}

      {open && (
        <div className="ae-modal-bg" onClick={() => setOpen(false)}>
          <div className="ae-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ae-h">Paste AI-enhanced JSON</h3>
            <div className="ae-row" style={{ marginBottom: 10 }}>
              <label className="ae-check">
                <input type="radio" checked={scope === "chapter"} disabled={!chapterKey}
                  onChange={() => setScope("chapter")} />
                Apply to selected chapter
              </label>
              <label className="ae-check">
                <input type="radio" checked={scope === "course"} onChange={() => setScope("course")} />
                Apply to whole course
              </label>
            </div>
            <textarea className="ae-input ae-raw" rows={16} spellCheck={false} value={text}
              placeholder="Paste JSON here (```json fences are fine)…"
              onChange={(e) => setText(e.target.value)} />
            {err && <p className="ae-error-inline">{err}</p>}
            <p className="ae-hint">
              Slugs of existing items are never changed. Items not in the JSON are left untouched.
              Nothing is saved until you press Save.
            </p>
            <div className="ae-row" style={{ marginTop: 12 }}>
              <button type="button" className="ae-save" style={{ color: "#0d2a1a" }}
                disabled={!text.trim()} onClick={apply}>Apply to editor</button>
              <button type="button" className="ae-btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}