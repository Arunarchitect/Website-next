"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ContentBlock, InlineRun, Reference, Subtitle } from "../types";

/* ---------- helpers ---------- */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/* ---------- tiny UI primitives ---------- */

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="ae-field">
      <span className="ae-label">{label}</span>
      {children}
      {hint && <span className="ae-hint">{hint}</span>}
    </label>
  );
}

export function IconBtn({
  onClick, title, danger, disabled, children,
}: {
  onClick: () => void; title: string; danger?: boolean; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`ae-iconbtn${danger ? " danger" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function RowTools({
  i, n, onMove, onRemove,
}: { i: number; n: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  return (
    <span className="ae-tools">
      <IconBtn title="Move up" disabled={i === 0} onClick={() => onMove(-1)}>▲</IconBtn>
      <IconBtn title="Move down" disabled={i === n - 1} onClick={() => onMove(1)}>▼</IconBtn>
      <IconBtn title="Remove" danger onClick={onRemove}>✕</IconBtn>
    </span>
  );
}

/* ---------- inline markup  <->  InlineRun[] ----------
   **bold**  *italic*  ==highlight==  `code`  [text](url)  {{ref:id}}   \ escapes */

const esc = (s: string) => s.replace(/[\\*`\[\]{]/g, "\\$&").replace(/==/g, "\\=\\=");
const unesc = (s: string) => s.replace(/\\([\s\S])/g, "$1");

export function runsToMarkup(runs: InlineRun[]): string {
  return runs
    .map((r) => {
      switch (r.type) {
        case "text": return esc(r.text);
        case "bold": return `**${esc(r.text)}**`;
        case "italic": return `*${esc(r.text)}*`;
        case "highlight": return `==${esc(r.text)}==`;
        case "code": return `\`${esc(r.text)}\``;
        case "link": return `[${esc(r.text)}](${r.href.replace(/[\\)]/g, "\\$&")})`;
        case "ref": return `{{ref:${r.refId}}}`;
      }
    })
    .join("");
}

function findClose(src: string, token: string, from: number): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === "\\") { j++; continue; }
    if (src.startsWith(token, j)) return j;
  }
  return -1;
}

export function markupToRuns(src: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let buf = "";
  const flush = () => {
    if (buf) { runs.push({ type: "text", text: buf }); buf = ""; }
  };
  const pairs: ["**" | "==", "bold" | "highlight"][] = [["**", "bold"], ["==", "highlight"]];
  let i = 0;
  outer: while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) { buf += src[i + 1]; i += 2; continue; }

    if (src.startsWith("{{ref:", i)) {
      const end = src.indexOf("}}", i);
      if (end > -1) {
        flush();
        runs.push({ type: "ref", refId: src.slice(i + 6, end).trim() });
        i = end + 2;
        continue;
      }
    }
    for (const [tok, type] of pairs) {
      if (src.startsWith(tok, i)) {
        const end = findClose(src, tok, i + tok.length);
        if (end > i + tok.length) {
          flush();
          runs.push({ type, text: unesc(src.slice(i + tok.length, end)) });
          i = end + tok.length;
          continue outer;
        }
      }
    }
    if (ch === "*" || ch === "`") {
      const end = findClose(src, ch, i + 1);
      if (end > i + 1) {
        flush();
        runs.push({ type: ch === "*" ? "italic" : "code", text: unesc(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[") {
      const mid = findClose(src, "](", i + 1);
      if (mid > -1) {
        const end = findClose(src, ")", mid + 2);
        if (end > -1) {
          flush();
          runs.push({
            type: "link",
            text: unesc(src.slice(i + 1, mid)),
            href: unesc(src.slice(mid + 2, end)),
          });
          i = end + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return runs;
}

/** Textarea holding markup; keeps its own text so half-typed markup isn't rewritten under you. */
export function MarkupField({
  runs, onChange, rows = 2, placeholder,
}: { runs: InlineRun[]; onChange: (r: InlineRun[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(() => runsToMarkup(runs ?? []));
  const last = useRef(JSON.stringify(runs ?? []));

  useEffect(() => {
    const now = JSON.stringify(runs ?? []);
    if (now !== last.current) {
      last.current = now;
      setText(runsToMarkup(runs ?? []));
    }
  }, [runs]);

  return (
    <textarea
      className="ae-input ae-markup"
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        const r = markupToRuns(v);
        last.current = JSON.stringify(r);
        onChange(r);
      }}
    />
  );
}

/* ---------- blocks ---------- */

const BLOCK_TYPES = ["paragraph", "heading", "list", "callout", "image", "divider"] as const;

function newBlock(t: (typeof BLOCK_TYPES)[number]): ContentBlock {
  switch (t) {
    case "heading": return { type: "heading", level: 2, text: "" };
    case "paragraph": return { type: "paragraph", runs: [] };
    case "list": return { type: "list", ordered: false, items: [[]] };
    case "callout": return { type: "callout", variant: "note", title: "", runs: [] };
    case "image": return { type: "image", src: "", alt: "" };
    case "divider": return { type: "divider" };
  }
}

function BlockBody({ block, onChange }: { block: ContentBlock; onChange: (b: ContentBlock) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="ae-grid2">
          <Field label="Text">
            <input className="ae-input" value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })} />
          </Field>
          <div className="ae-row">
            <Field label="Level">
              <select className="ae-input" value={block.level}
                onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
            </Field>
            <Field label="Anchor id (optional)">
              <input className="ae-input" value={block.id ?? ""}
                onChange={(e) => onChange({ ...block, id: e.target.value || undefined })} />
            </Field>
          </div>
        </div>
      );

    case "paragraph":
      return <MarkupField runs={block.runs} rows={4} onChange={(runs) => onChange({ ...block, runs })} />;

    case "list":
      return (
        <>
          <label className="ae-check">
            <input type="checkbox" checked={!!block.ordered}
              onChange={(e) => onChange({ ...block, ordered: e.target.checked })} />
            Numbered list
          </label>
          {block.items.map((item, i) => (
            <div className="ae-row ae-item" key={i}>
              <span className="ae-idx">{i + 1}</span>
              <MarkupField
                runs={item}
                rows={2}
                onChange={(runs) =>
                  onChange({ ...block, items: block.items.map((it, k) => (k === i ? runs : it)) })
                }
              />
              <RowTools
                i={i}
                n={block.items.length}
                onMove={(d) => onChange({ ...block, items: move(block.items, i, d) })}
                onRemove={() => onChange({ ...block, items: block.items.filter((_, k) => k !== i) })}
              />
            </div>
          ))}
          <button type="button" className="ae-add"
            onClick={() => onChange({ ...block, items: [...block.items, []] })}>
            + item
          </button>
        </>
      );

    case "callout":
      return (
        <>
          <div className="ae-grid2">
            <Field label="Variant">
              <select className="ae-input" value={block.variant ?? "note"}
                onChange={(e) =>
                  onChange({ ...block, variant: e.target.value as "note" | "warning" | "tip" })
                }>
                <option value="note">note</option>
                <option value="tip">tip</option>
                <option value="warning">warning</option>
              </select>
            </Field>
            <Field label="Title">
              <input className="ae-input" value={block.title ?? ""}
                onChange={(e) => onChange({ ...block, title: e.target.value })} />
            </Field>
          </div>
          <MarkupField runs={block.runs} rows={3} onChange={(runs) => onChange({ ...block, runs })} />
        </>
      );

    case "image":
      return (
        <div className="ae-grid2">
          <Field label="Image path / URL">
            <input className="ae-input" value={block.src}
              onChange={(e) => onChange({ ...block, src: e.target.value })} />
          </Field>
          <Field label="Alt text">
            <input className="ae-input" value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })} />
          </Field>
          <Field label="Caption">
            <input className="ae-input" value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })} />
          </Field>
          <Field label="Source / credit">
            <input className="ae-input" value={block.source ?? ""}
              onChange={(e) => onChange({ ...block, source: e.target.value })} />
          </Field>
          <Field label="Width (optional)">
            <input className="ae-input" type="number" value={block.width ?? ""}
              onChange={(e) =>
                onChange({ ...block, width: e.target.value ? Number(e.target.value) : undefined })
              } />
          </Field>
          <Field label="Height (optional)">
            <input className="ae-input" type="number" value={block.height ?? ""}
              onChange={(e) =>
                onChange({ ...block, height: e.target.value ? Number(e.target.value) : undefined })
              } />
          </Field>
        </div>
      );

    case "divider":
      return <p className="ae-muted">Horizontal rule</p>;
  }
}

export function BlocksEditor({
  blocks, onChange,
}: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  const [rawErr, setRawErr] = useState("");

  if (raw !== null) {
    return (
      <div className="ae-blocks">
        <div className="ae-block-head">
          <span className="ae-tag">raw JSON</span>
          <button type="button" className="ae-btn" onClick={() => { setRaw(null); setRawErr(""); }}>
            Done
          </button>
        </div>
        <textarea
          className="ae-input ae-raw"
          rows={18}
          spellCheck={false}
          value={raw}
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            try {
              const parsed = JSON.parse(v);
              if (!Array.isArray(parsed)) throw new Error("must be an array of blocks");
              onChange(parsed as ContentBlock[]);
              setRawErr("");
            } catch (err) {
              setRawErr((err as Error).message);
            }
          }}
        />
        {rawErr && <p className="ae-error-inline">{rawErr} (last valid JSON is kept)</p>}
      </div>
    );
  }

  return (
    <div className="ae-blocks">
      {blocks.length === 0 && <p className="ae-muted">No blocks yet.</p>}
      {blocks.map((b, i) => (
        <div className="ae-block" key={i}>
          <div className="ae-block-head">
            <span className="ae-tag">{b.type}</span>
            <RowTools
              i={i}
              n={blocks.length}
              onMove={(d) => onChange(move(blocks, i, d))}
              onRemove={() => onChange(blocks.filter((_, k) => k !== i))}
            />
          </div>
          <BlockBody block={b} onChange={(nb) => onChange(blocks.map((x, k) => (k === i ? nb : x)))} />
        </div>
      ))}
      <div className="ae-addbar">
        <select
          className="ae-input"
          value=""
          onChange={(e) => {
            const t = e.target.value as (typeof BLOCK_TYPES)[number];
            if (t) onChange([...blocks, newBlock(t)]);
          }}
        >
          <option value="">+ Add block…</option>
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="button" className="ae-btn" onClick={() => setRaw(JSON.stringify(blocks, null, 2))}>
          Edit as JSON
        </button>
      </div>
      <p className="ae-hint">
        Inline: **bold** *italic* ==highlight== `code` [text](url) {"{{ref:id}}"} · leading/trailing spaces matter
      </p>
    </div>
  );
}

/* ---------- references ---------- */

export function ReferencesEditor({
  refs, onChange,
}: { refs: Reference[]; onChange: (r: Reference[]) => void }) {
  const set = (i: number, patch: Partial<Reference>) =>
    onChange(refs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="ae-blocks">
      {refs.map((r, i) => (
        <div className="ae-block" key={i}>
          <div className="ae-block-head">
            <span className="ae-tag">ref · {r.id || "no id"}</span>
            <RowTools
              i={i}
              n={refs.length}
              onMove={(d) => onChange(move(refs, i, d))}
              onRemove={() => onChange(refs.filter((_, k) => k !== i))}
            />
          </div>
          <div className="ae-grid2">
            <Field label="Id (used by {{ref:id}})">
              <input className="ae-input" value={r.id} onChange={(e) => set(i, { id: e.target.value })} />
            </Field>
            <Field label="Style">
              <select className="ae-input" value={r.style ?? ""}
                onChange={(e) => set(i, { style: (e.target.value || undefined) as Reference["style"] })}>
                <option value="">—</option>
                <option value="apa">apa</option>
                <option value="mla">mla</option>
              </select>
            </Field>
          </div>
          <Field label="Citation text">
            <textarea className="ae-input" rows={2} value={r.text}
              onChange={(e) => set(i, { text: e.target.value })} />
          </Field>
          <Field label="URL (optional)">
            <input className="ae-input" value={r.url ?? ""}
              onChange={(e) => set(i, { url: e.target.value || undefined })} />
          </Field>
        </div>
      ))}
      <button type="button" className="ae-add"
        onClick={() => onChange([...refs, { id: "", text: "", style: "apa" }])}>
        + reference
      </button>
    </div>
  );
}

/* ---------- subtitles ---------- */

export function SubtitlesEditor({
  subs, onChange,
}: { subs: Subtitle[]; onChange: (s: Subtitle[]) => void }) {
  const set = (i: number, patch: Partial<Subtitle>) =>
    onChange(subs.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div className="ae-blocks">
      {subs.map((s, i) => (
        <div className="ae-block" key={i}>
          <div className="ae-block-head">
            <span className="ae-tag">subtitle · {s.language || "?"}</span>
            <RowTools
              i={i}
              n={subs.length}
              onMove={(d) => onChange(move(subs, i, d))}
              onRemove={() => onChange(subs.filter((_, k) => k !== i))}
            />
          </div>
          <div className="ae-grid2">
            <Field label="Label">
              <input className="ae-input" value={s.label} onChange={(e) => set(i, { label: e.target.value })} />
            </Field>
            <Field label="Language code">
              <input className="ae-input" value={s.language} onChange={(e) => set(i, { language: e.target.value })} />
            </Field>
          </div>
          <Field label=".vtt path / URL">
            <input className="ae-input" value={s.src} onChange={(e) => set(i, { src: e.target.value })} />
          </Field>
          <label className="ae-check">
            <input type="checkbox" checked={!!s.default}
              onChange={(e) => set(i, { default: e.target.checked })} />
            Default track
          </label>
        </div>
      ))}
      <button type="button" className="ae-add"
        onClick={() => onChange([...subs, { label: "English", language: "en", src: "" }])}>
        + subtitle track
      </button>
    </div>
  );
}