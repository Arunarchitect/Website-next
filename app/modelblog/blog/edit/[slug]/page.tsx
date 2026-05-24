/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetchPostDetail,
  apiFetchLanguages,
  LANGUAGE_FALLBACK,
  type Author,
  type BlogImage,
  type BlogPost,
  type BlogTranslation,
  type LanguageCode,
  type LanguageOption,
  type Source,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const BLOG_API = `${(process.env.NEXT_PUBLIC_HOST ?? "").replace(/\/$/, "")}/api/modelblog`;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function authHeadersMultipart(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function apiFetchAdminAuthors(): Promise<Author[]> {
  const res = await fetch(`${BLOG_API}/admin/authors/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Authors fetch failed: ${res.status}`);
  return res.json() as Promise<Author[]>;
}

async function apiUploadImage(
  postId: number,
  imageKey: string,
  orientation: "landscape" | "portrait",
  file: File,
): Promise<BlogImage> {
  const form = new FormData();
  form.append("post_id", String(postId));
  form.append("image_key", imageKey);
  form.append("orientation", orientation);
  form.append("image", file);
  const res = await fetch(`${BLOG_API}/admin/upload-image/`, {
    method: "POST",
    headers: authHeadersMultipart(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<BlogImage>;
}

async function apiDeleteImage(postId: number, imageKey: string): Promise<void> {
  const res = await fetch(`${BLOG_API}/admin/delete-image/${postId}/${imageKey}/`, {
    method: "DELETE",
    headers: authHeadersMultipart(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed (${res.status}): ${text}`);
  }
}

async function apiUpdateImage(
  postId: number,
  imageKey: string,
  patch: {
    alt?: Partial<Record<string, string>>;
    caption?: Partial<Record<string, string>>;
    reference?: Partial<Record<string, string>>;
    src?: string;
  },
): Promise<BlogImage> {
  const res = await fetch(
    `${BLOG_API}/admin/update-image/${postId}/${imageKey}/`,
    { method: "PATCH", headers: authHeaders(), body: JSON.stringify(patch) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<BlogImage>;
}

// ---------------------------------------------------------------------------
// Draft shapes
// ---------------------------------------------------------------------------

interface DraftInlineRef {
  marker: number;
  sourceLabel: string;
  url: string;
}

interface DraftParagraph {
  _id: string;
  order: number;
  type: "text" | "pullquote" | "callout";
  text: string;
  inlineRefs: DraftInlineRef[];
}

interface DraftBlock {
  _id: string;
  order: number;
  type: "paragraph" | "pullquote" | "callout" | "image";
  text: string;
  inlineRefs: DraftInlineRef[];
  imageId: string;
}

interface DraftSubheading {
  _id: string;
  id: string;
  title: string;
  blocks: DraftBlock[];
}

interface DraftSection {
  _id: string;
  id: string;
  title: string;
  blocks: DraftBlock[];
  subheadings: DraftSubheading[];
}

interface DraftTranslation {
  language: LanguageCode;
  title: string;
  subtitle: string;
  excerpt: string;
  sections: DraftSection[];
}

interface DraftPost {
  slug: string;
  category: string;
  tags: string[];
  reading_time_minutes: number;
  published_at: string;
  featured: boolean;
  cover_accent: string;
  cover_image_key: string;
  author_keys: string[];
  sources: Source[];
  translations: Partial<Record<LanguageCode, DraftTranslation>>;
}

interface ManagedImage {
  id: string;
  src: string;
  orientation: "landscape" | "portrait";
  alt: Partial<Record<LanguageCode, string>> & { en: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _uid = 0;
function uid() { return `_${++_uid}`; }

function emptyParagraphBlock(): DraftBlock {
  return { _id: uid(), order: 0, type: "paragraph", text: "", inlineRefs: [], imageId: "" };
}
function emptyImageBlock(): DraftBlock {
  return { _id: uid(), order: 0, type: "image", text: "", inlineRefs: [], imageId: "" };
}
function emptySubheading(): DraftSubheading {
  return { _id: uid(), id: "", title: "", blocks: [emptyParagraphBlock()] };
}
function emptySection(): DraftSection {
  return { _id: uid(), id: "", title: "", blocks: [emptyParagraphBlock()], subheadings: [] };
}
function emptyTranslation(lang: LanguageCode): DraftTranslation {
  return { language: lang, title: "", subtitle: "", excerpt: "", sections: [emptySection()] };
}
function emptyDraft(): DraftPost {
  return {
    slug: "", category: "", tags: [], reading_time_minutes: 5,
    published_at: new Date().toISOString().split("T")[0],
    featured: false,
    cover_accent: "linear-gradient(90deg,#f59e0b,#d97706)",
    cover_image_key: "", author_keys: [], sources: [],
    translations: { en: emptyTranslation("en") },
  };
}

function postToDraft(post: BlogPost): DraftPost {
  const translations: Partial<Record<LanguageCode, DraftTranslation>> = {};
  for (const [lang, t] of Object.entries(post.translations) as [LanguageCode, BlogTranslation][]) {
    translations[lang] = {
      language: lang, title: t.title, subtitle: t.subtitle, excerpt: t.excerpt,
      sections: (t.sections ?? []).map((s) => ({
        _id: uid(), id: s.id, title: s.title,
        blocks: (s.blocks ?? []).map((b) => ({
          _id: uid(), order: b.order,
          type: b.type as DraftBlock["type"],
          text: b.text ?? "",
          inlineRefs: (b.inlineRefs ?? []).map((r) => ({
            marker: r.marker, sourceLabel: r.sourceLabel, url: r.url,
          })),
          imageId: b.imageId ?? "",
        })),
        subheadings: (s.subheadings ?? []).map((sub) => ({
          _id: uid(), id: sub.id, title: sub.title,
          blocks: (sub.blocks ?? []).map((b) => ({
            _id: uid(), order: b.order,
            type: b.type as DraftBlock["type"],
            text: b.text ?? "",
            inlineRefs: (b.inlineRefs ?? []).map((r) => ({
              marker: r.marker, sourceLabel: r.sourceLabel, url: r.url,
            })),
            imageId: b.imageId ?? "",
          })),
        })),
      })),
    };
  }
  return {
    slug: post.slug, category: post.category,
    tags: Array.isArray(post.tags) ? post.tags : [],
    reading_time_minutes: post.readingTimeMinutes, published_at: post.publishedAt,
    featured: post.featured, cover_accent: post.coverAccent,
    cover_image_key: post.coverImageId ?? "",
    author_keys: (post.authors ?? []).map((a) => a.id),
    sources: post.sources ?? [], translations,
  };
}

function draftToPayload(draft: DraftPost) {
  const translations: Record<string, unknown> = {};
  for (const [lang, t] of Object.entries(draft.translations) as [LanguageCode, DraftTranslation][]) {
    translations[lang] = {
      title: t.title, subtitle: t.subtitle, excerpt: t.excerpt,
      sections: t.sections.map((s, si) => ({
        id: s.id || `section-${si}`, title: s.title,
        blocks: s.blocks.map((b, bi) => ({
          order: bi, type: b.type,
          text: b.type !== "image" ? b.text : "",
          imageId: b.type === "image" ? b.imageId : "",
          inlineRefs: b.type !== "image" ? b.inlineRefs : [],
        })),
        subheadings: s.subheadings.map((sub, subi) => ({
          id: sub.id || `sub-${subi}`, title: sub.title,
          blocks: sub.blocks.map((b, bi) => ({
            order: bi, type: b.type,
            text: b.type !== "image" ? b.text : "",
            imageId: b.type === "image" ? b.imageId : "",
            inlineRefs: b.type !== "image" ? b.inlineRefs : [],
          })),
        })),
      })),
    };
  }
  return {
    slug: draft.slug, category: draft.category, tags: draft.tags,
    reading_time_minutes: draft.reading_time_minutes, published_at: draft.published_at,
    featured: draft.featured, cover_accent: draft.cover_accent,
    cover_image_key: draft.cover_image_key, author_keys: draft.author_keys,
    sources: draft.sources, translations,
  };
}

// ---------------------------------------------------------------------------
// Reference syntax helpers
// ---------------------------------------------------------------------------

function parseRefSpans(raw: string): Array<{ marker: number; text: string; start: number; end: number }> {
  const result: Array<{ marker: number; text: string; start: number; end: number }> = [];
  const RE = /\[ref:(\d+)\]([\s\S]*?)\[\/ref\]/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(raw)) !== null) {
    result.push({ marker: parseInt(m[1], 10), text: m[2], start: m.index, end: m.index + m[0].length });
  }
  return result;
}

function stripRefSyntax(raw: string): string {
  return raw.replace(/\[ref:\d+\]([\s\S]*?)\[\/ref\]/g, "$1");
}

function usedMarkersInText(text: string): number[] {
  const spans = parseRefSpans(text);
  return [...new Set(spans.map((s) => s.marker))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className={`relative h-7 w-14 rounded-full border transition-colors duration-500 ${
        isDark ? "border-stone-700 bg-stone-900" : "border-sky-300 bg-sky-100"
      }`}
    >
      <span
        className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm shadow-md transition-all duration-500 ${
          isDark ? "translate-x-7 border-stone-600 bg-stone-800" : "translate-x-0.5 border-amber-300 bg-amber-400"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Primitive inputs
// ---------------------------------------------------------------------------

function Label({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <label className={`mb-1 block text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, isDark, className = "",
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; isDark: boolean; className?: string;
}) {
  const inputClass = isDark
    ? "border-stone-800 bg-stone-900 text-stone-200 placeholder-stone-600 focus:border-amber-700"
    : "border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:border-amber-500";
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${inputClass} ${className}`}
    />
  );
}

function Select({
  value, onChange, options, isDark,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; isDark: boolean;
}) {
  const selectClass = isDark
    ? "border-stone-800 bg-stone-900 text-stone-300"
    : "border-stone-300 bg-white text-stone-700";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${selectClass}`}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Card({ children, isDark, className = "" }: {
  children: React.ReactNode; isDark: boolean; className?: string;
}) {
  const cardClass = isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm";
  return (
    <div className={`rounded-xl border p-5 ${cardClass} ${className}`}>{children}</div>
  );
}

function Btn({
  onClick, children, variant = "ghost", isDark, className = "", disabled = false,
}: {
  onClick?: () => void; children: React.ReactNode;
  variant?: "primary" | "danger" | "ghost" | "outline" | "amber";
  isDark: boolean; className?: string; disabled?: boolean;
}) {
  const base = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40";
  const styles: Record<string, string> = {
    primary: "bg-amber-600 text-amber-50 hover:bg-amber-500",
    danger:  "bg-red-800/80 text-red-200 hover:bg-red-700",
    ghost:   isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-700",
    outline: isDark
      ? "border border-stone-700 text-stone-400 hover:text-stone-100 hover:border-stone-500"
      : "border border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-400",
    amber: isDark
      ? "border border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40"
      : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RefAwareField
// ---------------------------------------------------------------------------

function RefAwareField({
  value, onChange, placeholder, rows = 2, isDark, sources, className = "",
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; isDark: boolean;
  sources: Source[]; className?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [selectedMarker, setSelectedMarker] = useState(1);

  const textareaClass = isDark
    ? "border-stone-800 bg-stone-900 text-stone-200 placeholder-stone-600 focus:border-amber-700"
    : "border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:border-amber-500";

  function insertRef() {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: ss, selectionEnd: se } = ta;
    if (ss === se) { alert("Select some text in the field first, then click Wrap."); return; }
    const wrapped = `[ref:${selectedMarker}]${value.slice(ss, se)}[/ref]`;
    const newText = value.slice(0, ss) + wrapped + value.slice(se);
    onChange(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(ss + wrapped.length, ss + wrapped.length);
    });
  }

  const numOptions = Math.max(sources.length, 5);
  const hasRefs = /\[ref:\d+\]/.test(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-600" : "text-stone-400"}`}>
          Ref:
        </span>
        <select
          value={selectedMarker}
          onChange={(e) => setSelectedMarker(parseInt(e.target.value, 10))}
          className={`rounded border px-1.5 py-0.5 text-xs font-mono outline-none ${
            isDark ? "border-stone-700 bg-stone-900 text-amber-300" : "border-stone-300 bg-white text-amber-700"
          }`}
        >
          {Array.from({ length: numOptions }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {sources[i] ? `[${i + 1}] ${sources[i].label}` : `[${i + 1}]`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={insertRef}
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
            isDark
              ? "border border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50"
              : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          Wrap [{selectedMarker}]
        </button>
        {hasRefs && (
          <span className={`text-[10px] ${isDark ? "text-amber-600" : "text-amber-700"}`}>
            {parseRefSpans(value).length} ref{parseRefSpans(value).length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition resize-y font-mono ${textareaClass} ${className}`}
      />
      {hasRefs && (
        <p className={`text-xs italic ${isDark ? "text-stone-600" : "text-stone-400"}`}>
          Preview: {stripRefSyntax(value)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tags editor
// ---------------------------------------------------------------------------

function TagsEditor({
  tags, onChange, isDark,
}: {
  tags: string[]; onChange: (tags: string[]) => void; isDark: boolean;
}) {
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const newTags = trimmed.split(",").map((t) => t.trim()).filter((t) => t && !tags.includes(t));
    if (newTags.length > 0) onChange([...tags, ...newTags]);
    setInputValue("");
  }

  function removeTag(tag: string) { onChange(tags.filter((t) => t !== tag)); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(inputValue); }
    else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) removeTag(tags[tags.length - 1]);
  }

  const wrapperClass = isDark
    ? "border-stone-800 bg-stone-900 focus-within:border-amber-700"
    : "border-stone-300 bg-white focus-within:border-amber-500";
  const tagClass = isDark
    ? "bg-amber-900/40 text-amber-300 border border-amber-700/40"
    : "bg-amber-100 text-amber-800 border border-amber-300";

  return (
    <div className={`flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 transition ${wrapperClass}`}>
      {tags.map((tag) => (
        <span key={tag} className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tagClass}`}>
          {tag}
          <button type="button" onClick={() => removeTag(tag)}
            className={`ml-0.5 rounded-full p-0.5 ${isDark ? "hover:text-red-400 text-amber-500" : "hover:text-red-500 text-amber-600"}`}
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={tags.length === 0 ? "Type tag, press Enter or comma…" : "Add more…"}
        className={`min-w-[120px] flex-1 bg-transparent text-sm outline-none ${isDark ? "text-stone-200 placeholder-stone-600" : "text-stone-800 placeholder-stone-400"}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RefChip
// ---------------------------------------------------------------------------

function RefChip({ marker, text, isDark, onRemove }: {
  marker: number; text: string; isDark: boolean; onRemove: () => void;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-800"}`}>
      <span className={`font-mono text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>[{marker}]</span>
      {text}
      <button onClick={onRemove}
        className={`ml-0.5 rounded p-0.5 ${isDark ? "hover:text-red-400 text-amber-600" : "hover:text-red-500 text-amber-500"}`}
      >
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// RefAwareParagraphEditor
// ---------------------------------------------------------------------------

function RefAwareParagraphEditor({
  para, onChange, sources, isDark,
}: {
  para: DraftParagraph;
  onChange: (p: DraftParagraph) => void;
  sources: Source[];
  isDark: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<number>(1);

  const textareaClass = isDark
    ? "border-stone-800 bg-stone-900 text-stone-200 placeholder-stone-600 focus:border-amber-700"
    : "border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:border-amber-500";

  const spans = parseRefSpans(para.text);

  function syncInlineRefs(text: string, existingRefs: DraftInlineRef[]): DraftInlineRef[] {
    const used = usedMarkersInText(text);
    const existing = new Map(existingRefs.map((r) => [r.marker, r]));
    return used.map((m) => existing.has(m) ? existing.get(m)! : { marker: m, sourceLabel: "", url: "" });
  }

  function handleTextChange(newText: string) {
    onChange({ ...para, text: newText, inlineRefs: syncInlineRefs(newText, para.inlineRefs) });
  }

  function insertRefAroundSelection() {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: ss, selectionEnd: se } = ta;
    if (ss === se) { alert("Select some text first, then click [ref]."); return; }
    const selected = para.text.slice(ss, se);
    const wrapped = `[ref:${selectedMarker}]${selected}[/ref]`;
    const newText = para.text.slice(0, ss) + wrapped + para.text.slice(se);
    handleTextChange(newText);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = ss + wrapped.length;
      ta.setSelectionRange(newPos, newPos);
    });
  }

  function removeRefSpan(span: { marker: number; text: string; start: number; end: number }) {
    const newText = para.text.slice(0, span.start) + span.text + para.text.slice(span.end);
    handleTextChange(newText);
  }

  function updateInlineRef(marker: number, patch: Partial<DraftInlineRef>) {
    const refs = para.inlineRefs.map((r) => r.marker === marker ? { ...r, ...patch } : r);
    onChange({ ...para, inlineRefs: refs });
  }

  const markerOptions = Array.from({ length: Math.max(sources.length, 10) }, (_, i) => ({
    value: String(i + 1),
    label: sources[i] ? `[${i + 1}] ${sources[i].label}` : `[${i + 1}]`,
  }));

  const panelBg = isDark ? "border-amber-900/50 bg-amber-950/15" : "border-amber-200 bg-amber-50/60";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-600" : "text-stone-400"}`}>Ref:</span>
        <select
          value={selectedMarker}
          onChange={(e) => setSelectedMarker(parseInt(e.target.value, 10))}
          className={`rounded border px-2 py-1 text-xs font-mono outline-none ${isDark ? "border-stone-700 bg-stone-900 text-amber-300" : "border-stone-300 bg-white text-amber-700"}`}
        >
          {markerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={insertRefAroundSelection}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
            isDark
              ? "border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50"
              : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          Wrap selection as [{selectedMarker}]
        </button>
        {spans.length > 0 && (
          <button
            onClick={() => setShowRefPanel((v) => !v)}
            className={`text-[10px] font-medium underline decoration-dashed ${isDark ? "text-stone-500 hover:text-stone-300" : "text-stone-400 hover:text-stone-600"}`}
          >
            {showRefPanel ? "hide" : "show"} {spans.length} ref{spans.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <textarea
        ref={taRef}
        value={para.text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Paragraph text… select a phrase then click Wrap selection to add a reference"
        rows={para.type === "text" ? 4 : 2}
        className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition resize-y font-mono ${textareaClass}`}
      />

      {showRefPanel && spans.length > 0 && (
        <div className={`rounded-lg border p-3 space-y-3 ${panelBg}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-amber-600" : "text-amber-700"}`}>
            Referenced spans
          </p>
          <div className="flex flex-wrap gap-2">
            {spans.map((span, i) => (
              <RefChip key={i} marker={span.marker} text={span.text} isDark={isDark} onRemove={() => removeRefSpan(span)} />
            ))}
          </div>
          {para.inlineRefs.length > 0 && (
            <div className="space-y-2 border-t pt-2" style={{ borderColor: isDark ? "#451a03" : "#fde68a" }}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-amber-700" : "text-amber-600"}`}>
                Reference metadata
              </p>
              {para.inlineRefs.map((ref) => (
                <div key={ref.marker} className="grid gap-2 sm:grid-cols-[80px_1fr_1fr]">
                  <div className={`flex items-center justify-center rounded font-mono text-xs font-bold ${isDark ? "bg-amber-950/40 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
                    [{ref.marker}]
                  </div>
                  <Input value={ref.sourceLabel} onChange={(v) => updateInlineRef(ref.marker, { sourceLabel: v })} placeholder={sources[ref.marker - 1]?.label ?? "Source label"} isDark={isDark} />
                  <Input value={ref.url} onChange={(v) => updateInlineRef(ref.marker, { url: v })} placeholder={sources[ref.marker - 1]?.url ?? "https://…"} isDark={isDark} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageBlockPicker
// ---------------------------------------------------------------------------

function ImageBlockPicker({
  imageId, availableImages, onChange, isDark,
}: {
  imageId: string;
  availableImages: ManagedImage[];
  onChange: (id: string) => void;
  isDark: boolean;
}) {
  const selected = availableImages.find((img) => img.id === imageId);
  const emptyClass = isDark
    ? "border-stone-700 bg-stone-900 text-stone-500"
    : "border-stone-300 bg-stone-50 text-stone-400";

  if (availableImages.length === 0) {
    return (
      <p className={`rounded-lg border border-dashed px-3 py-3 text-xs italic ${emptyClass}`}>
        No images yet — upload in the Images tab.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-center gap-3">
          {selected.src && (
            <img
              src={selected.src}
              alt={selected.alt.en}
              className="h-16 w-24 rounded-lg object-cover border border-stone-700/30 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-mono font-semibold truncate ${isDark ? "text-stone-300" : "text-stone-700"}`}>
              {selected.id}
            </p>
            <p className={`text-[10px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>
              {selected.orientation}
            </p>
          </div>
          <Btn onClick={() => onChange("")} variant="ghost" isDark={isDark}>Change</Btn>
        </div>
      ) : (
        <p className={`text-xs italic ${isDark ? "text-stone-600" : "text-stone-400"}`}>
          No image selected — pick one below
        </p>
      )}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {availableImages.map((img) => {
          const isSel = img.id === imageId;
          const tileClass = isSel
            ? isDark ? "border-amber-500 ring-1 ring-amber-500/40" : "border-amber-500"
            : isDark ? "border-stone-700 hover:border-stone-500" : "border-stone-200 hover:border-stone-400";
          return (
            <button
              key={img.id}
              onClick={() => onChange(isSel ? "" : img.id)}
              className={`relative overflow-hidden rounded-lg border-2 transition-all ${tileClass}`}
            >
              {img.src ? (
                <img src={img.src} alt={img.alt.en} className="aspect-video w-full object-cover" />
              ) : (
                <div className={`flex aspect-video w-full items-center justify-center text-xs ${isDark ? "bg-stone-800 text-stone-600" : "bg-stone-100 text-stone-400"}`}>?</div>
              )}
              {isSel && (
                <div className="absolute inset-0 flex items-start justify-end bg-amber-500/20 p-0.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

function BlockEditor({
  block, onChange, onDelete, onMoveUp, onMoveDown,
  isDark, isFirst, isLast, sources, availableImages,
}: {
  block: DraftBlock;
  onChange: (b: DraftBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDark: boolean;
  isFirst: boolean;
  isLast: boolean;
  sources: Source[];
  availableImages: ManagedImage[];
}) {
  const wrapClass = isDark ? "border-stone-800 bg-stone-900/50" : "border-stone-200 bg-stone-50";

  const typeOptions = [
    { value: "paragraph",  label: "Paragraph" },
    { value: "pullquote",  label: "Pull Quote" },
    { value: "callout",    label: "Callout" },
    { value: "image",      label: "📷 Image" },
  ];

  const asParagraph: DraftParagraph = {
    _id:       block._id,
    order:     block.order,
    type:      block.type === "paragraph" ? "text" : block.type as "pullquote" | "callout",
    text:      block.text,
    inlineRefs: block.inlineRefs,
  };

  return (
    <div className={`rounded-lg border p-3 ${wrapClass}`}>
      <div className="mb-2 flex items-center gap-2">
        <Select
          value={block.type}
          onChange={(v) => onChange({ ...block, type: v as DraftBlock["type"] })}
          options={typeOptions}
          isDark={isDark}
        />
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <Btn onClick={onMoveUp}   variant="ghost"  isDark={isDark} disabled={isFirst}>↑</Btn>
          <Btn onClick={onMoveDown} variant="ghost"  isDark={isDark} disabled={isLast}>↓</Btn>
          <Btn onClick={onDelete}   variant="danger" isDark={isDark}>✕</Btn>
        </div>
      </div>

      {block.type === "image" ? (
        <ImageBlockPicker
          imageId={block.imageId}
          availableImages={availableImages}
          onChange={(id) => onChange({ ...block, imageId: id })}
          isDark={isDark}
        />
      ) : (
        <RefAwareParagraphEditor
          para={asParagraph}
          onChange={(p) => onChange({ ...block, text: p.text, inlineRefs: p.inlineRefs })}
          sources={sources}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockListEditor
// ---------------------------------------------------------------------------

function BlockListEditor({
  blocks, onChange, isDark, sources, availableImages,
}: {
  blocks: DraftBlock[];
  onChange: (blocks: DraftBlock[]) => void;
  isDark: boolean;
  sources: Source[];
  availableImages: ManagedImage[];
}) {
  function update(i: number, b: DraftBlock) {
    const n = [...blocks]; n[i] = b; onChange(n);
  }
  function remove(i: number) { onChange(blocks.filter((_, idx) => idx !== i)); }
  function moveUp(i: number) {
    if (i === 0) return;
    const n = [...blocks]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n);
  }
  function moveDown(i: number) {
    if (i === blocks.length - 1) return;
    const n = [...blocks]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; onChange(n);
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <BlockEditor
          key={b._id}
          block={b}
          onChange={(u) => update(i, u)}
          onDelete={() => remove(i)}
          onMoveUp={() => moveUp(i)}
          onMoveDown={() => moveDown(i)}
          isDark={isDark}
          isFirst={i === 0}
          isLast={i === blocks.length - 1}
          sources={sources}
          availableImages={availableImages}
        />
      ))}
      <div className="flex gap-2">
        <Btn
          onClick={() => onChange([...blocks, emptyParagraphBlock()])}
          variant="outline" isDark={isDark} className="flex-1"
        >
          + Add Paragraph
        </Btn>
        <Btn
          onClick={() => onChange([...blocks, emptyImageBlock()])}
          variant="outline" isDark={isDark} className="flex-1"
        >
          + Insert Image
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubheadingEditor
// ---------------------------------------------------------------------------

function SubheadingEditor({
  sub, onChange, onDelete, isDark, availableImages, sources,
}: {
  sub: DraftSubheading; onChange: (s: DraftSubheading) => void;
  onDelete: () => void; isDark: boolean; availableImages: ManagedImage[];
  sources: Source[];
}) {
  const [open, setOpen] = useState(true);
  const wrapClass = isDark ? "border-stone-700 bg-stone-900" : "border-stone-300 bg-stone-50";
  return (
    <div className={`rounded-xl border ${wrapClass}`}>
      <div className="flex cursor-pointer items-center justify-between px-4 py-3" onClick={() => setOpen((v) => !v)}>
        <span className={`text-sm font-semibold ${isDark ? "text-stone-300" : "text-stone-700"}`}>
          {sub.title
            ? <span>{stripRefSyntax(sub.title)}</span>
            : <span className={isDark ? "text-stone-600" : "text-stone-400"}>Untitled subheading</span>}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Btn onClick={onDelete} variant="danger" isDark={isDark}>Delete</Btn>
          <span className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: isDark ? "#292524" : "#e7e5e4" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label isDark={isDark}>Subheading Key (slug)</Label>
              <Input value={sub.id} onChange={(v) => onChange({ ...sub, id: v })} placeholder="e.g. bim-workflow" isDark={isDark} />
            </div>
            <div>
              <Label isDark={isDark}>Title</Label>
              <RefAwareField
                value={sub.title}
                onChange={(v) => onChange({ ...sub, title: v })}
                placeholder="Subheading title"
                rows={1}
                isDark={isDark}
                sources={sources}
              />
            </div>
          </div>
          <div>
            <Label isDark={isDark}>Content Blocks</Label>
            <p className={`mb-2 text-[10px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>
              Add paragraphs and images in any order.
            </p>
            <BlockListEditor
              blocks={sub.blocks}
              onChange={(blocks) => onChange({ ...sub, blocks })}
              isDark={isDark}
              sources={sources}
              availableImages={availableImages}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionEditor
// ---------------------------------------------------------------------------

function SectionEditor({
  section, onChange, onDelete, onMoveUp, onMoveDown,
  isDark, isFirst, isLast, availableImages, sources,
}: {
  section: DraftSection; onChange: (s: DraftSection) => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isDark: boolean; isFirst: boolean; isLast: boolean;
  availableImages: ManagedImage[]; sources: Source[];
}) {
  const [open, setOpen] = useState(true);
  const wrapClass = isDark ? "border-stone-700 bg-stone-900/40" : "border-stone-300 bg-white";
  return (
    <div className={`rounded-2xl border ${wrapClass}`}>
      <div className="flex cursor-pointer items-center justify-between px-5 py-4" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-stone-600" : "text-stone-400"}`}>Section</span>
          <span className={`text-base font-semibold ${isDark ? "text-stone-200" : "text-stone-800"}`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {section.title
              ? stripRefSyntax(section.title)
              : <span className={isDark ? "text-stone-600" : "text-stone-400"}>Untitled section</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Btn onClick={onMoveUp}   variant="ghost"  isDark={isDark} disabled={isFirst}>↑</Btn>
          <Btn onClick={onMoveDown} variant="ghost"  isDark={isDark} disabled={isLast}>↓</Btn>
          <Btn onClick={onDelete}   variant="danger" isDark={isDark}>Delete</Btn>
          <span className={`ml-1 text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="space-y-5 border-t px-5 py-5" style={{ borderColor: isDark ? "#292524" : "#e7e5e4" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label isDark={isDark}>Section Key (slug)</Label>
              <Input value={section.id} onChange={(v) => onChange({ ...section, id: v })} placeholder="e.g. introduction" isDark={isDark} />
            </div>
            <div>
              <Label isDark={isDark}>Section Title</Label>
              <RefAwareField
                value={section.title}
                onChange={(v) => onChange({ ...section, title: v })}
                placeholder="Section title"
                rows={1}
                isDark={isDark}
                sources={sources}
              />
            </div>
          </div>
          <div>
            <Label isDark={isDark}>Content Blocks</Label>
            <p className={`mb-2 text-[10px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>
              Add paragraphs and images in any order. Use &ldquo;Insert Image&rdquo; to place an image exactly where you want it.
            </p>
            <BlockListEditor
              blocks={section.blocks}
              onChange={(blocks) => onChange({ ...section, blocks })}
              isDark={isDark}
              sources={sources}
              availableImages={availableImages}
            />
          </div>
          <div>
            <Label isDark={isDark}>Subheadings</Label>
            <div className="space-y-3">
              {section.subheadings.map((sub, i) => (
                <SubheadingEditor
                  key={sub._id}
                  sub={sub}
                  availableImages={availableImages}
                  sources={sources}
                  onChange={(updated) => {
                    const next = [...section.subheadings]; next[i] = updated;
                    onChange({ ...section, subheadings: next });
                  }}
                  onDelete={() => onChange({ ...section, subheadings: section.subheadings.filter((_, idx) => idx !== i) })}
                  isDark={isDark}
                />
              ))}
              <Btn
                onClick={() => onChange({ ...section, subheadings: [...section.subheadings, emptySubheading()] })}
                variant="outline" isDark={isDark} className="w-full"
              >
                + Add Subheading
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranslationEditor
// ---------------------------------------------------------------------------

function TranslationEditor({
  translation, onChange, isDark, availableImages, sources,
}: {
  translation: DraftTranslation; onChange: (t: DraftTranslation) => void;
  isDark: boolean; availableImages: ManagedImage[]; sources: Source[];
}) {
  function updateSection(i: number, s: DraftSection) {
    const next = [...translation.sections]; next[i] = s;
    onChange({ ...translation, sections: next });
  }
  function removeSection(i: number) {
    onChange({ ...translation, sections: translation.sections.filter((_, idx) => idx !== i) });
  }
  function moveSectionUp(i: number) {
    if (i === 0) return;
    const next = [...translation.sections]; [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange({ ...translation, sections: next });
  }
  function moveSectionDown(i: number) {
    if (i === translation.sections.length - 1) return;
    const next = [...translation.sections]; [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange({ ...translation, sections: next });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label isDark={isDark}>Title</Label>
          <Input value={translation.title} onChange={(v) => onChange({ ...translation, title: v })} placeholder="Article title" isDark={isDark} />
        </div>
        <div>
          <Label isDark={isDark}>Subtitle</Label>
          <RefAwareField
            value={translation.subtitle}
            onChange={(v) => onChange({ ...translation, subtitle: v })}
            placeholder="Short subtitle shown in the header"
            rows={2} isDark={isDark} sources={sources}
          />
        </div>
        <div>
          <Label isDark={isDark}>Excerpt</Label>
          <RefAwareField
            value={translation.excerpt}
            onChange={(v) => onChange({ ...translation, excerpt: v })}
            placeholder="Short excerpt shown on cards"
            rows={3} isDark={isDark} sources={sources}
          />
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label isDark={isDark}>Sections</Label>
          <Btn onClick={() => onChange({ ...translation, sections: [...translation.sections, emptySection()] })} variant="primary" isDark={isDark}>
            + Add Section
          </Btn>
        </div>
        <div className="space-y-4">
          {translation.sections.map((s, i) => (
            <SectionEditor
              key={s._id} section={s}
              availableImages={availableImages}
              sources={sources}
              onChange={(u) => updateSection(i, u)}
              onDelete={() => removeSection(i)}
              onMoveUp={() => moveSectionUp(i)}
              onMoveDown={() => moveSectionDown(i)}
              isDark={isDark} isFirst={i === 0}
              isLast={i === translation.sections.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourcesEditor
// ---------------------------------------------------------------------------

function SourcesEditor({
  sources, onChange, isDark,
}: {
  sources: Source[]; onChange: (s: Source[]) => void; isDark: boolean;
}) {
  function update(i: number, s: Source) { const n = [...sources]; n[i] = s; onChange(n); }
  function remove(i: number) { onChange(sources.filter((_, idx) => idx !== i)); }
  const itemClass = isDark ? "border-stone-800 bg-stone-900/50" : "border-stone-200 bg-stone-50";
  return (
    <div className="space-y-3">
      {sources.length > 0 && (
        <div className={`rounded-lg border px-4 py-3 text-xs ${isDark ? "border-amber-900/40 bg-amber-950/10 text-amber-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          <span className="font-semibold">Tip:</span> Source [1] = first entry below, [2] = second, etc.
          In paragraphs, headings, subtitle, excerpt, and image captions, select text and use the{" "}
          <span className="font-mono font-bold">Wrap [N]</span> toolbar.
        </div>
      )}
      {sources.map((s, i) => (
        <div key={i} className={`rounded-lg border p-3 ${itemClass}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={`font-mono text-xs font-bold ${isDark ? "text-amber-500" : "text-amber-600"}`}>[{i + 1}]</span>
            <Btn onClick={() => remove(i)} variant="danger" isDark={isDark}>Remove</Btn>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label isDark={isDark}>Label</Label><Input value={s.label} onChange={(v) => update(i, { ...s, label: v })} placeholder="Source label" isDark={isDark} /></div>
            <div><Label isDark={isDark}>URL</Label><Input value={s.url} onChange={(v) => update(i, { ...s, url: v })} placeholder="https://..." isDark={isDark} /></div>
            <div><Label isDark={isDark}>Publisher</Label><Input value={s.publisher} onChange={(v) => update(i, { ...s, publisher: v })} placeholder="Publisher name" isDark={isDark} /></div>
            <div><Label isDark={isDark}>Year</Label><Input value={s.year?.toString() ?? ""} onChange={(v) => update(i, { ...s, year: v ? parseInt(v) : undefined })} placeholder="2024" isDark={isDark} /></div>
          </div>
        </div>
      ))}
      <Btn onClick={() => onChange([...sources, { label: "", url: "", publisher: "", year: undefined }])} variant="outline" isDark={isDark} className="w-full">
        + Add Source
      </Btn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthorPicker
// ---------------------------------------------------------------------------

function AuthorPicker({
  selectedKeys, onChange, isDark,
}: {
  selectedKeys: string[]; onChange: (keys: string[]) => void; isDark: boolean;
}) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetchAdminAuthors()
      .then(setAuthors)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    if (selectedKeys.includes(key)) onChange(selectedKeys.filter((k) => k !== key));
    else onChange([...selectedKeys, key]);
  }

  if (loading) return <p className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>Loading authors…</p>;
  if (err)     return <p className="text-xs text-red-400">{err}</p>;

  return (
    <div className="space-y-2">
      {authors.map((a) => {
        const checked = selectedKeys.includes(a.id);
        const labelClass = checked
          ? isDark ? "border-amber-700/60 bg-amber-950/30" : "border-amber-400 bg-amber-50"
          : isDark ? "border-stone-800 bg-stone-900/40 hover:border-stone-700" : "border-stone-200 bg-white hover:border-stone-300";
        return (
          <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${labelClass}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} className="h-4 w-4 accent-amber-500 shrink-0" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: a.avatarColor }}>
              {a.avatarInitials}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold leading-tight ${isDark ? "text-stone-200" : "text-stone-800"}`}>{a.name}</p>
              <p className={`text-xs leading-tight truncate ${isDark ? "text-stone-500" : "text-stone-500"}`}>{a.role} · {a.title}</p>
            </div>
          </label>
        );
      })}
      {authors.length === 0 && (
        <p className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>No authors found. Add them in Django admin first.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageEditDrawer
// ---------------------------------------------------------------------------

function ImageEditDrawer({
  img, postId, sources, onSaved, onClose, isDark,
}: {
  img: ManagedImage; postId: number; sources: Source[];
  onSaved: (updated: ManagedImage) => void; onClose: () => void; isDark: boolean;
}) {
  const [altEn,       setAltEn]       = useState(img.alt.en ?? "");
  const [captionEn,   setCaptionEn]   = useState("");
  const [referenceEn, setReferenceEn] = useState("");
  const [srcUrl,      setSrcUrl]      = useState(img.src ?? "");
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setErr(null);
    try {
      const updated = await apiUpdateImage(postId, img.id, {
        alt:       { en: altEn },
        caption:   { en: captionEn },
        reference: { en: referenceEn },
        src:       srcUrl || undefined,
      });
      onSaved({
        id: updated.id, src: updated.src, orientation: updated.orientation,
        alt: updated.alt as ManagedImage["alt"],
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  const drawerClass = isDark ? "border-amber-800/50 bg-amber-950/20" : "border-amber-300 bg-amber-50";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${drawerClass}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? "text-amber-400" : "text-amber-700"}`}>Edit: {img.id}</p>
        <button onClick={onClose} className={`text-xs ${isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-700"}`}>✕ Close</button>
      </div>
      <div className="grid gap-3">
        <div><Label isDark={isDark}>Alt Text (English)</Label><Input value={altEn} onChange={setAltEn} placeholder="Describe the image…" isDark={isDark} /></div>
        <div>
          <Label isDark={isDark}>Caption (English)</Label>
          <RefAwareField value={captionEn} onChange={setCaptionEn} placeholder="Caption shown below image…" rows={2} isDark={isDark} sources={sources} />
        </div>
        <div>
          <Label isDark={isDark}>Reference / Credit (English)</Label>
          <RefAwareField value={referenceEn} onChange={setReferenceEn} placeholder="e.g. © Photographer Name" rows={1} isDark={isDark} sources={sources} />
        </div>
        <div><Label isDark={isDark}>External Src URL (leave blank if uploaded)</Label><Input value={srcUrl} onChange={setSrcUrl} placeholder="https://…" isDark={isDark} /></div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose} variant="ghost" isDark={isDark}>Cancel</Btn>
        <Btn onClick={handleSave} variant="primary" isDark={isDark} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageManager  — with Replace support
// ---------------------------------------------------------------------------

function ImageManager({
  postId, existingImages, coverImageKey, sources, onCoverChange, onImagesChange, isDark,
}: {
  postId: number | null; existingImages: ManagedImage[];
  coverImageKey: string; sources: Source[];
  onCoverChange: (key: string) => void;
  onImagesChange: (imgs: ManagedImage[]) => void;
  isDark: boolean;
}) {
  const fileRef     = useRef<HTMLInputElement>(null);
  // One hidden <input type="file"> per existing image, keyed by image id
  const replaceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [uploading,      setUploading]      = useState(false);
  const [uploadErr,      setUploadErr]      = useState<string | null>(null);
  const [newKey,         setNewKey]         = useState("");
  const [newOrientation, setNewOrientation] = useState<"landscape" | "portrait">("landscape");
  const [deletingKey,    setDeletingKey]    = useState<string | null>(null);
  const [replacingKey,   setReplacingKey]   = useState<string | null>(null);
  const [deleteErr,      setDeleteErr]      = useState<string | null>(null);
  const [replaceErr,     setReplaceErr]     = useState<string | null>(null);
  const [editingKey,     setEditingKey]     = useState<string | null>(null);

  async function handleUpload(file: File) {
    if (!postId) { setUploadErr("Save the post first before uploading images."); return; }
    const key = newKey.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    setUploading(true); setUploadErr(null);
    try {
      const uploaded = await apiUploadImage(postId, key, newOrientation, file);
      const newImg: ManagedImage = {
        id: uploaded.id, src: uploaded.src, orientation: uploaded.orientation,
        alt: uploaded.alt as ManagedImage["alt"],
      };
      const exists = existingImages.findIndex((i) => i.id === newImg.id);
      if (exists >= 0) { const n = [...existingImages]; n[exists] = newImg; onImagesChange(n); }
      else onImagesChange([...existingImages, newImg]);
      setNewKey("");
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  // Replace an existing image's file in-place (same key, same orientation)
  async function handleReplace(img: ManagedImage, file: File) {
    if (!postId) return;
    setReplacingKey(img.id); setReplaceErr(null);
    try {
      const uploaded = await apiUploadImage(postId, img.id, img.orientation, file);
      const updated: ManagedImage = {
        id: uploaded.id, src: uploaded.src, orientation: uploaded.orientation,
        alt: uploaded.alt as ManagedImage["alt"],
      };
      onImagesChange(existingImages.map((i) => i.id === updated.id ? updated : i));
    } catch (e: unknown) {
      setReplaceErr(e instanceof Error ? e.message : "Replace failed");
    } finally { setReplacingKey(null); }
  }

  async function handleDelete(img: ManagedImage) {
    if (!postId) return;
    if (!window.confirm(`Delete image "${img.id}"? This cannot be undone.`)) return;
    setDeletingKey(img.id); setDeleteErr(null);
    try {
      await apiDeleteImage(postId, img.id);
      if (coverImageKey === img.id) onCoverChange("");
      if (editingKey === img.id) setEditingKey(null);
      onImagesChange(existingImages.filter((i) => i.id !== img.id));
    } catch (e: unknown) {
      setDeleteErr(e instanceof Error ? e.message : "Delete failed");
    } finally { setDeletingKey(null); }
  }

  function handleSaved(updated: ManagedImage) {
    onImagesChange(existingImages.map((i) => i.id === updated.id ? updated : i));
    setEditingKey(null);
  }

  const uploadZoneClass = isDark ? "border-stone-700 bg-stone-900/40" : "border-stone-300 bg-stone-50";

  return (
    <div className="space-y-4">
      {/* ── Upload new image ── */}
      <div className={`rounded-xl border-2 border-dashed p-4 ${uploadZoneClass}`}>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <div>
            <Label isDark={isDark}>Image Key (slug)</Label>
            <Input value={newKey} onChange={setNewKey} placeholder="e.g. hero-image (auto from filename)" isDark={isDark} />
          </div>
          <div>
            <Label isDark={isDark}>Orientation</Label>
            <Select
              value={newOrientation}
              onChange={(v) => setNewOrientation(v as "landscape" | "portrait")}
              options={[{ value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }]}
              isDark={isDark}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500 disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? "Uploading…" : "Upload Image"}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
        {!postId && (
          <p className={`text-xs ${isDark ? "text-amber-600" : "text-amber-700"}`}>
            ⚠ Save the post once before uploading images.
          </p>
        )}
        {uploadErr && <p className="text-xs text-red-400 mt-1">{uploadErr}</p>}
      </div>

      {/* ── Error banners ── */}
      {deleteErr && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-red-800 bg-red-950/30 text-red-400" : "border-red-300 bg-red-50 text-red-600"}`}>
          Delete failed: {deleteErr}
        </div>
      )}
      {replaceErr && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-orange-800 bg-orange-950/30 text-orange-400" : "border-orange-300 bg-orange-50 text-orange-600"}`}>
          Replace failed: {replaceErr}
        </div>
      )}

      {existingImages.length === 0 ? (
        <p className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>No images yet. Upload one above.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {existingImages.map((img) => {
              const isCover     = coverImageKey === img.id;
              const isDeleting  = deletingKey === img.id;
              const isReplacing = replacingKey === img.id;
              const isEditing   = editingKey === img.id;

              const cardClass = isCover
                ? isDark ? "border-amber-600 bg-amber-950/20" : "border-amber-500 bg-amber-50"
                : isEditing
                  ? isDark ? "border-sky-600 bg-sky-950/20" : "border-sky-400 bg-sky-50"
                  : isDark ? "border-stone-800 bg-stone-900/40" : "border-stone-200 bg-white";

              return (
                <div
                  key={img.id}
                  className={`overflow-hidden rounded-xl border transition-colors ${cardClass} ${
                    isDeleting || isReplacing ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Hidden replace file input — one per image card */}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { replaceRefs.current[img.id] = el; }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleReplace(img, f);
                      e.target.value = "";
                    }}
                  />

                  {/* Thumbnail */}
                  <div className="relative">
                    {img.src ? (
                      <img
                        src={img.src}
                        alt={img.alt.en}
                        className={`w-full object-cover ${img.orientation === "portrait" ? "aspect-[4/5]" : "aspect-video"}`}
                      />
                    ) : (
                      <div className={`flex w-full items-center justify-center text-xs ${img.orientation === "portrait" ? "aspect-[4/5]" : "aspect-video"} ${isDark ? "bg-stone-800 text-stone-600" : "bg-stone-100 text-stone-400"}`}>
                        No image
                      </div>
                    )}
                    {/* Replacing spinner overlay */}
                    {isReplacing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-t-xl">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className={`truncate font-mono text-xs font-semibold ${isDark ? "text-stone-300" : "text-stone-700"}`}>{img.id}</p>
                        <p className={`text-[10px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>{img.orientation}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">

                        {/* Replace button */}
                        <button
                          title="Replace image file"
                          onClick={() => replaceRefs.current[img.id]?.click()}
                          disabled={isReplacing}
                          className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                            isDark
                              ? "text-stone-600 hover:bg-amber-900/50 hover:text-amber-400"
                              : "text-stone-400 hover:bg-amber-50 hover:text-amber-600"
                          }`}
                        >
                          {isReplacing ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            /* swap arrows icon */
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20l16-16M8 21H3v-5" />
                            </svg>
                          )}
                        </button>

                        {/* Edit metadata button */}
                        <button
                          title="Edit metadata"
                          onClick={() => setEditingKey(isEditing ? null : img.id)}
                          className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                            isEditing
                              ? "bg-sky-600 text-white"
                              : isDark ? "text-stone-600 hover:bg-sky-900/50 hover:text-sky-400" : "text-stone-400 hover:bg-sky-50 hover:text-sky-600"
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>

                        {/* Delete button */}
                        <button
                          title="Delete image"
                          onClick={() => handleDelete(img)}
                          disabled={isDeleting}
                          className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
                            isDark ? "text-stone-600 hover:bg-red-900/50 hover:text-red-400" : "text-stone-400 hover:bg-red-50 hover:text-red-500"
                          }`}
                        >
                          {isDeleting ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Cover toggle */}
                    <button
                      onClick={() => onCoverChange(isCover ? "" : img.id)}
                      className={`w-full rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        isCover
                          ? "bg-amber-600 text-amber-50"
                          : isDark ? "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                      }`}
                    >
                      {isCover ? "✓ Cover" : "Set as Cover"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit metadata drawer */}
          {editingKey && postId && (() => {
            const img = existingImages.find((i) => i.id === editingKey);
            return img ? (
              <ImageEditDrawer
                key={editingKey} img={img} postId={postId} sources={sources}
                onSaved={handleSaved} onClose={() => setEditingKey(null)} isDark={isDark}
              />
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BlogEditPage({ params }: PageProps) {
  const { slug } = use(params);
  const isNew = slug === "new";
  const router = useRouter();

  const [theme,         setTheme]         = useState<Theme>("dark");
  const [draft,         setDraft]         = useState<DraftPost>(emptyDraft());
  const [activeLang,    setActiveLang]    = useState<LanguageCode>("en");
  const [languages,     setLanguages]     = useState<LanguageOption[]>(LANGUAGE_FALLBACK);
  const [loading,       setLoading]       = useState(!isNew);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [saveSuccess,   setSaveSuccess]   = useState(false);
  const [activeTab,     setActiveTab]     = useState<"meta" | "content" | "images" | "sources">("meta");
  const [postId,        setPostId]        = useState<number | null>(null);
  const [managedImages, setManagedImages] = useState<ManagedImage[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
  }, []);

  useEffect(() => { apiFetchLanguages().then(setLanguages).catch(() => {}); }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    apiFetchPostDetail(slug)
      .then((post) => {
        setDraft(postToDraft(post));
        setPostId(post.id);
        setManagedImages((post.images ?? []).map((img) => ({
          id: img.id, src: img.src, orientation: img.orientation,
          alt: img.alt as ManagedImage["alt"],
        })));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load post"))
      .finally(() => setLoading(false));
  }, [slug, isNew]);

  const isDark = theme === "dark";
  const activeTrans = draft.translations[activeLang];

  function setActiveTrans(t: DraftTranslation) {
    setDraft((d) => ({ ...d, translations: { ...d.translations, [activeLang]: t } }));
  }

  function addLanguageTab(lang: LanguageCode) {
    if (draft.translations[lang]) return;
    setDraft((d) => ({ ...d, translations: { ...d.translations, [lang]: emptyTranslation(lang) } }));
    setActiveLang(lang);
  }

  function removeLanguageTab(lang: LanguageCode) {
    if (lang === "en") return;
    const next = { ...draft.translations }; delete next[lang];
    setDraft((d) => ({ ...d, translations: next }));
    if (activeLang === lang) setActiveLang("en");
  }

  function handleImagesChange(imgs: ManagedImage[]) {
    const existingIds = new Set(imgs.map((i) => i.id));
    setDraft((d) => {
      const cleanedTranslations: typeof d.translations = {};
      for (const [lang, t] of Object.entries(d.translations) as [LanguageCode, DraftTranslation][]) {
        cleanedTranslations[lang] = {
          ...t,
          sections: t.sections.map((s) => ({
            ...s,
            blocks: s.blocks.filter((b) => b.type !== "image" || existingIds.has(b.imageId)),
            subheadings: s.subheadings.map((sub) => ({
              ...sub,
              blocks: sub.blocks.filter((b) => b.type !== "image" || existingIds.has(b.imageId)),
            })),
          })),
        };
      }
      const newCoverKey = existingIds.has(d.cover_image_key) ? d.cover_image_key : "";
      return { ...d, cover_image_key: newCoverKey, translations: cleanedTranslations };
    });
    setManagedImages(imgs);
  }

  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const payload = draftToPayload(draft);
    try {
      let res: Response;
      if (isNew) {
        res = await fetch(`${BLOG_API}/posts/create/`, {
          method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${BLOG_API}/posts/${slug}/`, {
          method: "PUT", headers: authHeaders(), body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `Save failed (${res.status})`;
        try { msg = JSON.stringify(JSON.parse(text), null, 2); } catch { msg = text || msg; }
        setSaveError(msg);
      } else {
        const data = await res.json();
        setPostId(data.id ?? null);
        setSaveSuccess(true);
        if (isNew) router.replace(`/modelblog/blog/edit/${data.slug ?? payload.slug}`);
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    } finally { setSaving(false); }
  }, [draft, isNew, slug, router]);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-stone-950" : "bg-stone-50"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className={`text-sm ${isDark ? "text-stone-500" : "text-stone-400"}`}>Loading post…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 px-4 ${isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
        <p className="text-xl font-bold text-red-400">Failed to load post</p>
        <p className="max-w-md text-sm text-red-300">{error}</p>
        <button onClick={() => router.back()} className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-stone-200 hover:bg-stone-700">
          ← Go Back
        </button>
      </div>
    );
  }

  const activeLangs  = Object.keys(draft.translations) as LanguageCode[];
  const addableLangs = LANGUAGE_FALLBACK.filter((l) => !activeLangs.includes(l.code));

  const headerClass     = isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90";
  const successBarClass = isDark ? "border-emerald-800 bg-emerald-950/40 text-emerald-400" : "border-emerald-300 bg-emerald-50 text-emerald-700";
  const errorBarClass   = isDark ? "border-red-800 bg-red-950/40 text-red-400" : "border-red-300 bg-red-50 text-red-700";

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"}`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      <header className={`sticky top-0 z-30 border-b backdrop-blur ${headerClass}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/modelblog/blog")}
              className={`text-sm ${isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-800"}`}
            >
              ← Blog
            </button>
            <span className={`text-xs ${isDark ? "text-stone-700" : "text-stone-300"}`}>/</span>
            <span className={`text-sm font-semibold ${isDark ? "text-amber-400" : "text-amber-700"}`}>
              {isNew ? "New Post" : `Edit: ${draft.slug}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
            {!isNew && (
              <button
                onClick={() => router.push(`/modelblog/blog/${draft.slug}`)}
                className={`text-xs ${isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-800"}`}
              >
                Preview →
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-amber-200 border-t-transparent" />
                  Saving…
                </>
              ) : isNew ? "Create Post" : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      {saveSuccess && (
        <div className={`border-b px-4 py-2.5 text-sm font-medium ${successBarClass}`}>✓ Saved successfully</div>
      )}
      {saveError && (
        <div className={`border-b px-4 py-2.5 ${errorBarClass}`}>
          <p className="mb-1 text-sm font-semibold">Save failed</p>
          <pre className="whitespace-pre-wrap text-xs">{saveError}</pre>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-1 flex-wrap">
          {(["meta", "content", "images", "sources"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-amber-600 text-amber-50"
                  : isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* META tab */}
        {activeTab === "meta" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <Card isDark={isDark}>
                <Label isDark={isDark}>Post Slug</Label>
                <Input value={draft.slug} onChange={(v) => setDraft((d) => ({ ...d, slug: v }))} placeholder="my-post-slug" isDark={isDark} />
              </Card>
              <Card isDark={isDark}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label isDark={isDark}>Category</Label><Input value={draft.category} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} placeholder="e.g. BIM & Software" isDark={isDark} /></div>
                  <div><Label isDark={isDark}>Reading Time (min)</Label><Input value={draft.reading_time_minutes.toString()} onChange={(v) => setDraft((d) => ({ ...d, reading_time_minutes: parseInt(v) || 0 }))} placeholder="5" isDark={isDark} /></div>
                  <div><Label isDark={isDark}>Published Date</Label><Input value={draft.published_at} onChange={(v) => setDraft((d) => ({ ...d, published_at: v }))} placeholder="YYYY-MM-DD" isDark={isDark} /></div>
                  <div>
                    <Label isDark={isDark}>Tags</Label>
                    <TagsEditor tags={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} isDark={isDark} />
                    <p className={`mt-1 text-[10px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>Press Enter or comma to add · Backspace removes last</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <input type="checkbox" id="featured" checked={draft.featured}
                    onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                    className="h-4 w-4 accent-amber-500" />
                  <label htmlFor="featured" className={`text-sm ${isDark ? "text-stone-400" : "text-stone-600"}`}>Featured post</label>
                </div>
              </Card>
              <Card isDark={isDark}>
                <Label isDark={isDark}>Authors</Label>
                <div className="mt-3">
                  <AuthorPicker selectedKeys={draft.author_keys} onChange={(keys) => setDraft((d) => ({ ...d, author_keys: keys }))} isDark={isDark} />
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card isDark={isDark}>
                <Label isDark={isDark}>Cover Accent (CSS gradient/color)</Label>
                <Input value={draft.cover_accent} onChange={(v) => setDraft((d) => ({ ...d, cover_accent: v }))} placeholder="linear-gradient(90deg,#f59e0b,#d97706)" isDark={isDark} />
                {draft.cover_accent && <div className="mt-2 h-4 w-full rounded" style={{ background: draft.cover_accent }} />}
              </Card>

              <Card isDark={isDark}>
                <Label isDark={isDark}>Cover Image</Label>
                {managedImages.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {managedImages.map((img) => {
                      const isCover = draft.cover_image_key === img.id;
                      const tileClass = isCover
                        ? isDark ? "border-amber-500 ring-1 ring-amber-500/40" : "border-amber-500"
                        : isDark ? "border-stone-700 hover:border-stone-500" : "border-stone-200 hover:border-stone-400";
                      return (
                        <button
                          key={img.id}
                          onClick={() => setDraft((d) => ({ ...d, cover_image_key: isCover ? "" : img.id }))}
                          className={`relative overflow-hidden rounded-lg border-2 transition-all ${tileClass}`}
                        >
                          {img.src && <img src={img.src} alt={img.alt.en} className="aspect-video w-full object-cover" />}
                          {isCover && (
                            <div className="absolute inset-0 flex items-start justify-end bg-amber-500/20 p-1">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </span>
                            </div>
                          )}
                          <div className={`px-1.5 py-1 ${isDark ? "bg-stone-900" : "bg-white"}`}>
                            <p className="truncate font-mono text-[9px] text-stone-500">{img.id}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`mt-2 text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>
                    Upload images in the <strong>Images</strong> tab first.
                  </p>
                )}
              </Card>

              <Card isDark={isDark}>
                <Label isDark={isDark}>Translation Languages</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeLangs.map((lang) => (
                    <div key={lang} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-stone-800 text-stone-300" : "bg-stone-100 text-stone-700"}`}>
                      {LANGUAGE_FALLBACK.find((l) => l.code === lang)?.nativeLabel ?? lang}
                      {lang !== "en" && (
                        <button onClick={() => removeLanguageTab(lang)} className="ml-0.5 text-red-400 hover:text-red-300">×</button>
                      )}
                    </div>
                  ))}
                </div>
                {addableLangs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {addableLangs.map((l) => (
                      <Btn key={l.code} onClick={() => addLanguageTab(l.code)} variant="outline" isDark={isDark}>
                        + {l.nativeLabel}
                      </Btn>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* CONTENT tab */}
        {activeTab === "content" && (
          <div className="space-y-6">
            {managedImages.length === 0 && (
              <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-xs ${isDark ? "border-stone-800 bg-stone-900/40 text-stone-500" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                No images uploaded yet.{" "}
                <button className="text-amber-500 underline" onClick={() => setActiveTab("images")}>Go to Images tab</button> to upload some.
              </div>
            )}
            <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-xs ${isDark ? "border-amber-900/40 bg-amber-950/10 text-amber-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <span>
                <span className="font-semibold">Content blocks</span> — add paragraphs and images in any order within each section using the block editor.
                Add sources in the <button className="underline" onClick={() => setActiveTab("sources")}>Sources tab</button> first to enable inline references.
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {activeLangs.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeLang === lang
                      ? "bg-amber-600 text-amber-50"
                      : isDark ? "bg-stone-900 text-stone-400 hover:text-stone-100" : "bg-white text-stone-500 shadow-sm hover:text-stone-900"
                  }`}
                >
                  {LANGUAGE_FALLBACK.find((l) => l.code === lang)?.nativeLabel ?? lang}
                </button>
              ))}
            </div>

            {activeTrans ? (
              <TranslationEditor
                translation={activeTrans}
                onChange={setActiveTrans}
                isDark={isDark}
                availableImages={managedImages}
                sources={draft.sources}
              />
            ) : (
              <Card isDark={isDark}>
                <p className={`text-sm ${isDark ? "text-stone-500" : "text-stone-400"}`}>
                  No translation for this language yet. Go to the{" "}
                  <button className="text-amber-500 underline" onClick={() => setActiveTab("meta")}>Meta tab</button> to add it.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* IMAGES tab */}
        {activeTab === "images" && (
          <Card isDark={isDark}>
            <ImageManager
              postId={postId}
              existingImages={managedImages}
              coverImageKey={draft.cover_image_key}
              sources={draft.sources}
              onCoverChange={(key) => setDraft((d) => ({ ...d, cover_image_key: key }))}
              onImagesChange={handleImagesChange}
              isDark={isDark}
            />
          </Card>
        )}

        {/* SOURCES tab */}
        {activeTab === "sources" && (
          <Card isDark={isDark}>
            <SourcesEditor
              sources={draft.sources}
              onChange={(sources) => setDraft((d) => ({ ...d, sources }))}
              isDark={isDark}
            />
          </Card>
        )}
      </div>
    </div>
  );
}