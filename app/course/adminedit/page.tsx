"use client";

import "./adminedit.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  ApiError,
  blankChapter,
  blankCourse,
  blankModule,
  getAdminCourse,
  hydrateCourse,
  listAdminCourses,
  saveAdminCourse,
} from "../api/adminApi";
import type { AdminChapter, AdminCourse, AdminCourseRow, AdminModule } from "../api/adminApi";
import {
  BlocksEditor,
  Field,
  IconBtn,
  ReferencesEditor,
  RowTools,
  SubtitlesEditor,
  move,
  slugify,
} from "./editors";
import AiJsonTools from "./AiJsonTools";
import type { PrefaceSection } from "../types";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

type Edit = (fn: (c: AdminCourse) => void) => void;
type Sel =
  | { kind: "course" }
  | { kind: "preface" }
  | { kind: "module"; key: string }
  | { kind: "chapter"; key: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const SLUG_RE = /^[-a-zA-Z0-9_]+$/;

/** undo history: edits made within this many ms of each other are merged into one undo step */
const COALESCE_MS = 800;
const MAX_HISTORY = 100;

function findChapter(c: AdminCourse, key: string): { m: AdminModule; ch: AdminChapter } | undefined {
  for (const m of c.modules) {
    const ch = m.chapters.find((x) => x._key === key);
    if (ch) return { m, ch };
  }
  return undefined;
}

/** after undo/redo the selected module/chapter may no longer exist */
function selectionExists(c: AdminCourse, s: Sel): boolean {
  if (s.kind === "module") return c.modules.some((m) => m._key === s.key);
  if (s.kind === "chapter") return !!findChapter(c, s.key);
  return true;
}

/** keeps slug in sync with title, only for items that don't exist in the DB yet */
function setTitle(o: { id?: number; title: string; slug: string }, v: string) {
  const auto = !o.id && (o.slug === "" || o.slug === slugify(o.title));
  o.title = v;
  if (auto) o.slug = slugify(v);
}

function validate(c: AdminCourse): string[] {
  const errs: string[] = [];
  const slugErr = (label: string, s: string) => {
    if (!s.trim()) errs.push(`${label}: slug required`);
    else if (!SLUG_RE.test(s)) errs.push(`${label}: slug may only use letters, digits, - and _`);
    else if (s.length > 50) errs.push(`${label}: slug max 50 chars`);
  };
  if (!c.title.trim()) errs.push("Course: title required");
  slugErr("Course", c.slug);
  const seenM = new Set<string>();
  const seenC = new Set<string>();
  c.modules.forEach((m, mi) => {
    const mn = `Module ${mi + 1}`;
    if (!m.title.trim()) errs.push(`${mn}: title required`);
    slugErr(mn, m.slug);
    if (m.slug && seenM.has(m.slug)) errs.push(`${mn}: duplicate slug "${m.slug}"`);
    seenM.add(m.slug);
    m.chapters.forEach((ch, ci) => {
      const cn = `${mn} › chapter ${ci + 1}`;
      if (!ch.title.trim()) errs.push(`${cn}: title required`);
      slugErr(cn, ch.slug);
      if (ch.slug && seenC.has(ch.slug)) errs.push(`${cn}: duplicate slug "${ch.slug}" (unique across course)`);
      seenC.add(ch.slug);
    });
  });
  return errs;
}

/* =================================================================== page */

export default function CourseAdminEditPage() {
  const [auth, setAuth] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [loadErr, setLoadErr] = useState("");
  const [courses, setCourses] = useState<AdminCourseRow[]>([]);
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [sel, setSel] = useState<Sel>({ kind: "course" });
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "ok" | "error"; msg?: string }>({
    type: "idle",
  });

  /* ---------- course state + undo/redo history ---------- */

  // The ref is the source of truth for edits (so several edits in one event never clash);
  // `course` state only exists to re-render.
  const courseRef = useRef<AdminCourse | null>(null);
  const savedJson = useRef(""); // JSON of the last saved/loaded course, to know if undo returns to "clean"
  const past = useRef<AdminCourse[]>([]);
  const future = useRef<AdminCourse[]>([]);
  const lastEditAt = useRef(0);
  const [hist, setHist] = useState({ undo: false, redo: false });

  const syncHist = useCallback(() => {
    setHist({ undo: past.current.length > 0, redo: future.current.length > 0 });
  }, []);

  /** replace the whole course (open / new / after save). Clears history. */
  const load = useCallback(
    (c: AdminCourse | null) => {
      courseRef.current = c;
      setCourse(c);
      savedJson.current = c?.id ? JSON.stringify(c) : "";
      past.current = [];
      future.current = [];
      lastEditAt.current = 0;
      syncHist();
    },
    [syncHist]
  );

  const edit: Edit = useCallback(
    (fn) => {
      const prev = courseRef.current;
      if (!prev) return;
      const next = structuredClone(prev);
      fn(next);

      const now = Date.now();
      if (past.current.length === 0 || now - lastEditAt.current > COALESCE_MS) {
        past.current.push(prev);
        if (past.current.length > MAX_HISTORY) past.current.shift();
      }
      lastEditAt.current = now;
      future.current = [];

      courseRef.current = next;
      setCourse(next);
      setDirty(true);
      setStatus({ type: "idle" });
      syncHist();
    },
    [syncHist]
  );

  const applySnapshot = useCallback(
    (snap: AdminCourse) => {
      courseRef.current = snap;
      setCourse(snap);
      lastEditAt.current = 0;
      setDirty(JSON.stringify(snap) !== savedJson.current);
      setStatus({ type: "idle" });
      setSel((s) => (selectionExists(snap, s) ? s : { kind: "course" }));
      syncHist();
    },
    [syncHist]
  );

  const undo = useCallback(() => {
    const cur = courseRef.current;
    const prev = past.current.pop();
    if (!cur || !prev) return;
    future.current.push(cur);
    applySnapshot(prev);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const cur = courseRef.current;
    const nxt = future.current.pop();
    if (!cur || !nxt) return;
    past.current.push(cur);
    applySnapshot(nxt);
  }, [applySnapshot]);

  const refreshList = useCallback(async () => {
    setCourses(await listAdminCourses());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listAdminCourses();
        setCourses(rows);
        setAuth("ok");
        if (rows.length === 1) load(await getAdminCourse(rows[0].id));
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setAuth("denied");
        else {
          setAuth("error");
          setLoadErr(errText(e));
        }
      }
    })();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  async function openCourse(id: number) {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    try {
      load(await getAdminCourse(id));
      setSel({ kind: "course" });
      setDirty(false);
      setStatus({ type: "idle" });
    } catch (e) {
      setStatus({ type: "error", msg: errText(e) });
    }
  }

  function newCourse() {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    load(blankCourse());
    setSel({ kind: "course" });
    setDirty(true);
    setStatus({ type: "idle" });
  }

  async function save() {
    const cur = courseRef.current;
    if (!cur || status.type === "saving") return;
    const errs = validate(cur);
    if (errs.length) {
      setStatus({ type: "error", msg: errs.join("\n") });
      return;
    }
    setStatus({ type: "saving" });
    try {
      const raw = await saveAdminCourse(cur);
      // New ids come back from the server, so older history snapshots (without ids)
      // must not be restored — history is cleared on save.
      load(hydrateCourse(raw, cur));
      setDirty(false);
      setStatus({ type: "ok", msg: "Saved" });
      refreshList().catch(() => {});
    } catch (e) {
      setStatus({ type: "error", msg: errText(e) });
    }
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  /* keyboard: Ctrl/Cmd+S save · Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();

      if (k === "s") {
        e.preventDefault();
        saveRef.current();
        return;
      }

      if (k === "z" || k === "y") {
        // raw-JSON boxes keep their own native browser undo
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(".ae-raw")) return;
        e.preventDefault();
        if (k === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  /** only for a brand-new, never-saved course */
  function discardNewCourse() {
    if (dirty && !confirm("Discard this new course?")) return;
    load(null);
    setDirty(false);
    setStatus({ type: "idle" });
  }

  function addModule() {
    const m = blankModule();
    edit((c) => {
      c.modules.push(m);
    });
    setSel({ kind: "module", key: m._key });
  }
  function addChapter(moduleKey: string) {
    const ch = blankChapter();
    edit((c) => {
      c.modules.find((x) => x._key === moduleKey)?.chapters.push(ch);
    });
    setSel({ kind: "chapter", key: ch._key });
  }

  /* ---------------- gates ---------------- */

  const shell = (children: React.ReactNode) => (
    <div className={`${display.variable} ${mono.variable} ae-page`}>{children}</div>
  );

  if (auth === "checking") return shell(<p className="ae-gate">Checking access…</p>);
  if (auth === "denied")
    return shell(
      <div className="ae-gate">
        <h1>Staff only</h1>
        <p>Log in with a Django admin (is_staff) account to edit courses.</p>
        <Link href="/course" className="ae-back dark">← Back to courses</Link>
      </div>
    );
  if (auth === "error")
    return shell(
      <div className="ae-gate">
        <h1>Couldn’t reach the API</h1>
        <pre className="ae-error">{loadErr}</pre>
        <p>Check NEXT_PUBLIC_API_URL and CORS.</p>
      </div>
    );

  /* ---------------- main ---------------- */

  let chapterNo = 0;

  return shell(
    <>
      <div className="ae-bar">
        <Link href="/course" className="ae-back">← Courses</Link>
        <select
          className="ae-input ae-course-select"
          value={course?.id ?? ""}
          onChange={(e) => e.target.value && openCourse(Number(e.target.value))}
        >
          <option value="">{course && !course.id ? "New course (unsaved)" : "Select course…"}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.is_published ? "" : " (draft)"}
            </option>
          ))}
        </select>
        <button type="button" className="ae-btn light" onClick={newCourse}>+ New course</button>
        {course?.id && (
          <Link href={`/course/${course.slug}`} className="ae-btn light" target="_blank">View ↗</Link>
        )}
        {course && (
          <>
            <button
              type="button"
              className="ae-btn light"
              disabled={!hist.undo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              className="ae-btn light"
              disabled={!hist.redo}
              onClick={redo}
              title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
              aria-label="Redo"
            >
              ↷ Redo
            </button>
            <AiJsonTools
              course={course}
              chapterKey={sel.kind === "chapter" ? sel.key : null}
              edit={edit}
            />
          </>
        )}
        <span className="ae-spacer" />
        {status.type === "ok" && <span className="ae-status ok">✓ Saved</span>}
        {dirty && status.type !== "saving" && <span className="ae-status">Unsaved changes</span>}
        <button
          type="button"
          className="ae-save"
          disabled={!course || !dirty || status.type === "saving"}
          onClick={save}
        >
          {status.type === "saving" ? "Saving…" : "Save (Ctrl+S)"}
        </button>
      </div>

      {status.type === "error" && <pre className="ae-error ae-error-bar">{status.msg}</pre>}

      {!course ? (
        <p className="ae-gate">Pick a course above, or create a new one.</p>
      ) : (
        <div className="ae-layout">
          <aside className="ae-side">
            <button type="button" className={`ae-node${sel.kind === "course" ? " on" : ""}`}
              onClick={() => setSel({ kind: "course" })}>
              ⚙ Course settings
            </button>
            <button type="button" className={`ae-node${sel.kind === "preface" ? " on" : ""}`}
              onClick={() => setSel({ kind: "preface" })}>
              ¶ Preface {course.preface ? "" : "(none)"}
            </button>

            <div className="ae-side-label">Curriculum</div>
            {course.modules.map((m, mi) => (
              <div className="ae-mod" key={m._key}>
                <div className="ae-node-row">
                  <button type="button"
                    className={`ae-node ae-node-mod${sel.kind === "module" && sel.key === m._key ? " on" : ""}`}
                    onClick={() => setSel({ kind: "module", key: m._key })}>
                    {m.title || "(untitled module)"}
                  </button>
                  <IconBtn title="Move module up" disabled={mi === 0}
                    onClick={() => edit((c) => { c.modules = move(c.modules, mi, -1); })}>▲</IconBtn>
                  <IconBtn title="Move module down" disabled={mi === course.modules.length - 1}
                    onClick={() => edit((c) => { c.modules = move(c.modules, mi, 1); })}>▼</IconBtn>
                </div>
                {m.chapters.map((ch, ci) => {
                  chapterNo += 1;
                  return (
                    <div className="ae-node-row ae-ch" key={ch._key}>
                      <button type="button"
                        className={`ae-node${sel.kind === "chapter" && sel.key === ch._key ? " on" : ""}`}
                        onClick={() => setSel({ kind: "chapter", key: ch._key })}>
                        <span className="ae-num">{String(chapterNo).padStart(2, "0")}</span>
                        {ch.title || "(untitled chapter)"}
                      </button>
                      <IconBtn title="Move up" disabled={ci === 0}
                        onClick={() => edit((c) => {
                          const mm = c.modules[mi];
                          mm.chapters = move(mm.chapters, ci, -1);
                        })}>▲</IconBtn>
                      <IconBtn title="Move down" disabled={ci === m.chapters.length - 1}
                        onClick={() => edit((c) => {
                          const mm = c.modules[mi];
                          mm.chapters = move(mm.chapters, ci, 1);
                        })}>▼</IconBtn>
                    </div>
                  );
                })}
                <button type="button" className="ae-add ae-add-ch" onClick={() => addChapter(m._key)}>
                  + chapter
                </button>
              </div>
            ))}
            <button type="button" className="ae-add" onClick={addModule}>+ module</button>
          </aside>

          <main className="ae-main">
            {sel.kind === "course" && (
              <CourseForm course={course} edit={edit} onDiscard={discardNewCourse} />
            )}
            {sel.kind === "preface" && <PrefaceForm course={course} edit={edit} />}
            {sel.kind === "module" && (
              <ModuleForm course={course} moduleKey={sel.key} edit={edit}
                onDeleted={() => setSel({ kind: "course" })} />
            )}
            {sel.kind === "chapter" && (
              <ChapterForm course={course} chapKey={sel.key} edit={edit}
                onDeleted={() => setSel({ kind: "course" })} />
            )}
          </main>
        </div>
      )}
    </>
  );
}

/* =================================================================== forms */

function CourseForm({
  course, edit, onDiscard,
}: { course: AdminCourse; edit: Edit; onDiscard: () => void }) {
  return (
    <section className="ae-card">
      <h2 className="ae-h">Course settings</h2>
      <Field label="Title">
        <input className="ae-input" value={course.title} onChange={(e) => edit((c) => setTitle(c, e.target.value))} />
      </Field>
      <Field label="Slug" hint={course.id ? "Changing this changes the course URL." : "URL: /course/<slug>. “adminedit” is reserved."}>
        <input className="ae-input" value={course.slug} onChange={(e) => edit((c) => { c.slug = e.target.value; })} />
      </Field>
      <Field label="Description">
        <textarea className="ae-input" rows={3} value={course.description}
          onChange={(e) => edit((c) => { c.description = e.target.value; })} />
      </Field>
      <Field label="Thumbnail path / URL">
        <input className="ae-input" value={course.thumbnail}
          onChange={(e) => edit((c) => { c.thumbnail = e.target.value; })} />
      </Field>
      <label className="ae-check">
        <input type="checkbox" checked={course.is_published}
          onChange={(e) => edit((c) => { c.is_published = e.target.checked; })} />
        Published (visible on the public site)
      </label>

      {!course.id && (
        <div className="ae-danger-zone">
          <button type="button" className="ae-btn danger" onClick={onDiscard}>
            Discard new course
          </button>
        </div>
      )}
    </section>
  );
}

function PrefaceForm({ course, edit }: { course: AdminCourse; edit: Edit }) {
  const p = course.preface;
  if (!p) {
    return (
      <section className="ae-card">
        <h2 className="ae-h">Preface</h2>
        <p className="ae-muted">This course has no preface.</p>
        <button type="button" className="ae-btn"
          onClick={() => edit((c) => {
            c.preface = { eyebrow: "Preface", title: c.title, intro: "", sections: [], references: [] };
          })}>
          Add preface
        </button>
      </section>
    );
  }
  const upd = (fn: (pp: NonNullable<AdminCourse["preface"]>) => void) =>
    edit((c) => { if (c.preface) fn(c.preface); });

  return (
    <section className="ae-card">
      <h2 className="ae-h">Preface</h2>
      <div className="ae-grid2">
        <Field label="Eyebrow">
          <input className="ae-input" value={p.eyebrow ?? ""} onChange={(e) => upd((x) => { x.eyebrow = e.target.value; })} />
        </Field>
        <Field label="Title">
          <input className="ae-input" value={p.title} onChange={(e) => upd((x) => { x.title = e.target.value; })} />
        </Field>
      </div>
      <Field label="Intro">
        <textarea className="ae-input" rows={4} value={p.intro} onChange={(e) => upd((x) => { x.intro = e.target.value; })} />
      </Field>

      <h3 className="ae-h3">Sections</h3>
      {p.sections.map((s: PrefaceSection, i: number) => (
        <div className="ae-block" key={i}>
          <div className="ae-block-head">
            <span className="ae-tag">section {i + 1}</span>
            <RowTools i={i} n={p.sections.length}
              onMove={(d) => upd((x) => { x.sections = move(x.sections, i, d); })}
              onRemove={() => upd((x) => { x.sections = x.sections.filter((_, k) => k !== i); })} />
          </div>
          <div className="ae-grid2">
            <Field label="Heading">
              <input className="ae-input" value={s.heading}
                onChange={(e) => upd((x) => {
                  const sec = x.sections[i];
                  const auto = sec.id === "" || sec.id === slugify(sec.heading);
                  sec.heading = e.target.value;
                  if (auto) sec.id = slugify(e.target.value);
                })} />
            </Field>
            <Field label="Anchor id">
              <input className="ae-input" value={s.id} onChange={(e) => upd((x) => { x.sections[i].id = e.target.value; })} />
            </Field>
          </div>
          <BlocksEditor blocks={s.blocks} onChange={(b) => upd((x) => { x.sections[i].blocks = b; })} />
        </div>
      ))}
      <button type="button" className="ae-add"
        onClick={() => upd((x) => { x.sections.push({ id: "", heading: "", blocks: [] }); })}>
        + section
      </button>

      <h3 className="ae-h3">Preface references</h3>
      <ReferencesEditor refs={p.references ?? []} onChange={(r) => upd((x) => { x.references = r; })} />

      <div className="ae-danger-zone">
        <button type="button" className="ae-btn danger"
          onClick={() => { if (confirm("Remove the whole preface?")) edit((c) => { c.preface = null; }); }}>
          Remove preface
        </button>
      </div>
    </section>
  );
}

function ModuleForm({
  course, moduleKey, edit, onDeleted,
}: { course: AdminCourse; moduleKey: string; edit: Edit; onDeleted: () => void }) {
  const m = course.modules.find((x) => x._key === moduleKey);
  if (!m) return null;
  const upd = (fn: (mm: AdminModule) => void) =>
    edit((c) => { const f = c.modules.find((x) => x._key === moduleKey); if (f) fn(f); });
  return (
    <section className="ae-card">
      <h2 className="ae-h">Module</h2>
      <Field label="Title">
        <input className="ae-input" value={m.title} onChange={(e) => upd((x) => setTitle(x, e.target.value))} />
      </Field>
      <Field label="Slug">
        <input className="ae-input" value={m.slug} onChange={(e) => upd((x) => { x.slug = e.target.value; })} />
      </Field>
      <p className="ae-muted">{m.chapters.length} chapter(s). Order is set by position in the sidebar.</p>
      <div className="ae-danger-zone">
        <button type="button" className="ae-btn danger"
          onClick={() => {
            if (!confirm(`Delete module and its ${m.chapters.length} chapter(s)? Learner progress on them is lost on save. (You can still Undo before saving.)`)) return;
            edit((c) => { c.modules = c.modules.filter((x) => x._key !== moduleKey); });
            onDeleted();
          }}>
          Delete module
        </button>
      </div>
    </section>
  );
}

function ChapterForm({
  course, chapKey, edit, onDeleted,
}: { course: AdminCourse; chapKey: string; edit: Edit; onDeleted: () => void }) {
  const found = findChapter(course, chapKey);
  if (!found) return null;
  const { m, ch } = found;
  const upd = (fn: (c: AdminChapter) => void) =>
    edit((c) => { const f = findChapter(c, chapKey); if (f) fn(f.ch); });

  return (
    <section className="ae-card">
      <h2 className="ae-h">Chapter</h2>
      <Field label="Title">
        <input className="ae-input" value={ch.title} onChange={(e) => upd((x) => setTitle(x, e.target.value))} />
      </Field>
      <div className="ae-grid2">
        <Field label="Slug" hint={ch.id ? "Changing this changes the chapter URL." : "Must be unique across the course."}>
          <input className="ae-input" value={ch.slug} onChange={(e) => upd((x) => { x.slug = e.target.value; })} />
        </Field>
        <Field label="Module">
          <select className="ae-input" value={m._key}
            onChange={(e) => {
              const toKey = e.target.value;
              edit((c) => {
                const f = findChapter(c, chapKey);
                const to = c.modules.find((x) => x._key === toKey);
                if (!f || !to || to === f.m) return;
                f.m.chapters = f.m.chapters.filter((x) => x._key !== chapKey);
                to.chapters.push(f.ch);
              });
            }}>
            {course.modules.map((mm) => (
              <option key={mm._key} value={mm._key}>{mm.title || "(untitled module)"}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea className="ae-input" rows={2} value={ch.description}
          onChange={(e) => upd((x) => { x.description = e.target.value; })} />
      </Field>

      <h3 className="ae-h3">Video</h3>
      <div className="ae-grid2">
        <Field label="Video path / URL (empty = text-only)">
          <input className="ae-input" value={ch.video} onChange={(e) => upd((x) => { x.video = e.target.value; })} />
        </Field>
        <Field label="Poster image">
          <input className="ae-input" value={ch.poster} onChange={(e) => upd((x) => { x.poster = e.target.value; })} />
        </Field>
      </div>
      <SubtitlesEditor subs={ch.subtitles} onChange={(s) => upd((x) => { x.subtitles = s; })} />

      <h3 className="ae-h3">Content</h3>
      <BlocksEditor blocks={ch.content} onChange={(b) => upd((x) => { x.content = b; })} />

      <h3 className="ae-h3">References</h3>
      <ReferencesEditor refs={ch.references} onChange={(r) => upd((x) => { x.references = r; })} />

      <div className="ae-danger-zone">
        <button type="button" className="ae-btn danger"
          onClick={() => {
            if (!confirm("Delete this chapter? Learner progress on it is lost on save. (You can still Undo before saving.)")) return;
            edit((c) => {
              const f = findChapter(c, chapKey);
              if (f) f.m.chapters = f.m.chapters.filter((x) => x._key !== chapKey);
            });
            onDeleted();
          }}>
          Delete chapter
        </button>
      </div>
    </section>
  );
}