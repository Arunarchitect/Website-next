// app/modelblog/blog/[slug]/page.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  apiFetchPostDetail,
  apiFetchAds,
  apiFetchLanguages,
  getAdsForPost,
  getAvailableLanguages,
  getCoverImage,
  getImageById,
  getTranslation,
  formatDate,
  type AdUnit,
  type Author,
  type AuthorRole,
  type BlogImage,
  type ContentBlock,
  type BlogPost,
  type BlogSection,
  type BlogTranslation,
  type LanguageCode,
  type LanguageOption,
  type Source,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function isLanguageCode(v: string | null): v is LanguageCode {
  return v === "en" || v === "ml" || v === "hi" || v === "ta";
}

// ---------------------------------------------------------------------------
// Admin check helpers — identical pattern to blog list page
// ---------------------------------------------------------------------------

const BLOG_API = `${(process.env.NEXT_PUBLIC_HOST ?? "").replace(/\/$/, "")}/api/modelblog`;

function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

async function checkIsAdmin(): Promise<boolean> {
  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BLOG_API}/admin/authors/`, {
      credentials: "include",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inline-reference text parser
// ---------------------------------------------------------------------------

type TextSegment =
  | { kind: "plain"; text: string }
  | { kind: "ref"; marker: number; text: string };

function parseRefText(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const RE = /\[ref:(\d+)\]([\s\S]*?)\[\/ref\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = RE.exec(raw)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: "plain", text: raw.slice(cursor, match.index) });
    }
    segments.push({ kind: "ref", marker: parseInt(match[1], 10), text: match[2] });
    cursor = match.index + match[0].length;
  }
  if (cursor < raw.length) {
    segments.push({ kind: "plain", text: raw.slice(cursor) });
  }
  return segments;
}

function stripRefSyntax(raw: string): string {
  return raw.replace(/\[ref:\d+\]([\s\S]*?)\[\/ref\]/g, "$1");
}

function renderRichText(
  raw: string,
  theme: Theme,
  sources?: Source[],
): React.ReactNode {
  const segments = parseRefText(raw);
  if (segments.length === 1 && segments[0].kind === "plain") return <>{raw}</>;

  const markerToLabel: Record<number, string> = {};
  sources?.forEach((s, i) => { markerToLabel[i + 1] = s.label; });

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "plain" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <RefSpan
            key={i}
            marker={(seg as { kind: "ref"; marker: number; text: string }).marker}
            text={(seg as { kind: "ref"; marker: number; text: string }).text}
            sourceLabel={markerToLabel[(seg as { kind: "ref"; marker: number; text: string }).marker]}
            theme={theme}
          />
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared atoms
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
          isDark
            ? "translate-x-7 border-stone-600 bg-stone-800"
            : "translate-x-0.5 border-amber-300 bg-amber-400"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

function AuthorPip({ author, size = "sm" }: { author: Author; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-7 w-7 text-xs";
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: author.avatarColor }}
      title={author.name}
    >
      {author.avatarInitials}
    </span>
  );
}

const ROLE_DARK: Record<AuthorRole, string> = {
  Eminent:   "bg-amber-900/40 text-amber-300 border border-amber-700/40",
  Editorial: "bg-sky-900/40 text-sky-300 border border-sky-700/40",
  Guest:     "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
  Staff:     "bg-stone-800 text-stone-400 border border-stone-700",
};
const ROLE_LIGHT: Record<AuthorRole, string> = {
  Eminent:   "bg-amber-100 text-amber-800 border border-amber-300",
  Editorial: "bg-sky-100 text-sky-800 border border-sky-300",
  Guest:     "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Staff:     "bg-stone-100 text-stone-600 border border-stone-300",
};

function RoleBadge({ role, theme }: { role: AuthorRole; theme: Theme }) {
  const s = theme === "dark" ? ROLE_DARK : ROLE_LIGHT;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${s[role]}`}>
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Reading progress bar
// ---------------------------------------------------------------------------

function ReadingProgress({ theme }: { theme: Theme }) {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (el.scrollTop / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`fixed left-0 right-0 top-0 z-50 h-[3px] ${theme === "dark" ? "bg-stone-900" : "bg-stone-200"}`}>
      <div
        className="h-full bg-amber-500 transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating edit button — only rendered for editors
// ---------------------------------------------------------------------------

function FloatingEditButton({ slug, theme }: { slug: string; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <a
      href={`/modelblog/blog/edit/${slug}`}
      title="Edit this post"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 ${
        isDark
          ? "border-amber-600/60 bg-stone-950/90 text-amber-400 hover:bg-amber-600 hover:text-amber-50 hover:border-amber-500"
          : "border-amber-500/60 bg-white/90 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
        />
      </svg>
      Edit Post
    </a>
  );
}

// ---------------------------------------------------------------------------
// Language switcher
// ---------------------------------------------------------------------------

function LanguageSwitcher({
  post, language, languages, theme, onLanguageChange,
}: {
  post: BlogPost;
  language: LanguageCode;
  languages: LanguageOption[];
  theme: Theme;
  onLanguageChange: (l: LanguageCode) => void;
}) {
  const isDark = theme === "dark";
  const available = getAvailableLanguages(post).map((l) => {
    const meta = languages.find((x) => x.code === l.code);
    return meta ?? l;
  });

  if (available.length <= 1) return null;

  return (
    <div className={`rounded-xl border p-5 ${isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"}`}>
      <p className={`mb-3 text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        Language
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map((l) => (
          <button
            key={l.code}
            onClick={() => onLanguageChange(l.code)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              language === l.code
                ? "bg-amber-600 text-amber-50"
                : isDark
                  ? "border border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-600 hover:text-stone-100"
                  : "border border-stone-200 bg-stone-100 text-stone-600 hover:border-stone-400 hover:text-stone-900"
            }`}
          >
            {l.nativeLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline reference span
// ---------------------------------------------------------------------------

function RefSpan({
  marker, text, sourceLabel, theme,
}: {
  marker: number;
  text: string;
  sourceLabel?: string;
  theme: Theme;
}) {
  const isDark = theme === "dark";
  return (
    <a
      href={`#ref-${marker}`}
      title={sourceLabel ? `[${marker}] ${sourceLabel}` : `Reference [${marker}]`}
      className={`rounded-sm font-semibold transition-colors ${
        isDark
          ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/30"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
      style={{ textDecoration: "none" }}
    >
      {text}
      <sup className={`ml-[1px] font-mono text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>
        [{marker}]
      </sup>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Article image
// ---------------------------------------------------------------------------

function ArticleImage({
  image, theme, language, sources,
}: {
  image: BlogImage;
  theme: Theme;
  language: LanguageCode;
  sources?: Source[];
}) {
  const isDark = theme === "dark";
  const isPortrait = image.orientation === "portrait";
  const captionText   = image.caption[language]   ?? image.caption.en   ?? "";
  const referenceText = image.reference[language] ?? image.reference.en ?? "";

  return (
    <figure className={`my-9 ${isPortrait ? "mx-auto max-w-md" : "w-full"}`}>
      <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white shadow-sm"}`}>
        <img
          src={image.src}
          alt={image.alt[language] ?? image.alt.en}
          className={`w-full object-cover ${isPortrait ? "aspect-[4/5]" : "aspect-[16/9]"}`}
        />
      </div>
      <figcaption className={`mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-6 ${isDark ? "text-stone-400" : "text-stone-600"}`}>
        {captionText && (
          <span className="block">{renderRichText(captionText, theme, sources)}</span>
        )}
        {referenceText && (
          <span className={`block text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>
            {renderRichText(referenceText, theme, sources)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Paragraph block renderer — handles paragraph / pullquote / callout
// ---------------------------------------------------------------------------

function ParagraphBlock({
  block, theme, sources,
}: {
  block: ContentBlock;
  theme: Theme;
  sources: Source[];
}) {
  const isDark = theme === "dark";
  const text = block.text ?? "";

  // Fix: moved inlineRefs inside useMemo to avoid stale dependency warning
  const markerToSource = useMemo(() => {
    const inlineRefs = block.inlineRefs ?? [];
    const map: Record<number, string> = {};
    inlineRefs.forEach((ref) => { map[ref.marker] = ref.sourceLabel; });
    return map;
  }, [block.inlineRefs]);

  function renderSegments(raw: string) {
    return parseRefText(raw).map((seg, i) => {
      if (seg.kind === "plain") return <span key={i}>{seg.text}</span>;
      const refSeg = seg as { kind: "ref"; marker: number; text: string };
      return (
        <RefSpan
          key={i}
          marker={refSeg.marker}
          text={refSeg.text}
          sourceLabel={markerToSource[refSeg.marker]}
          theme={theme}
        />
      );
    });
  }

  if (block.type === "pullquote") {
    return (
      <blockquote className={`my-8 border-l-4 border-amber-500 pl-6 text-xl font-medium italic leading-relaxed ${isDark ? "text-stone-300" : "text-stone-700"}`}>
        {renderSegments(text)}
      </blockquote>
    );
  }

  if (block.type === "callout") {
    return (
      <div className={`my-8 rounded-xl border p-5 text-sm leading-7 ${isDark ? "border-amber-900/50 bg-amber-950/20 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {renderSegments(text)}
      </div>
    );
  }

  return (
    <p className={`mt-5 text-[1.0625rem] leading-8 ${isDark ? "text-stone-400" : "text-stone-700"}`}>
      {renderSegments(text)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// ContentBlockRenderer — dispatches to image or paragraph
// ---------------------------------------------------------------------------

function ContentBlockRenderer({
  block, post, theme, language, sources,
}: {
  block: ContentBlock;
  post: BlogPost;
  theme: Theme;
  language: LanguageCode;
  sources: Source[];
}) {
  if (block.type === "image") {
    if (!block.imageId) return null;
    const img = getImageById(post, block.imageId);
    return img ? (
      <ArticleImage image={img} theme={theme} language={language} sources={sources} />
    ) : null;
  }

  return <ParagraphBlock block={block} theme={theme} sources={sources} />;
}

// ---------------------------------------------------------------------------
// Article body — sections iterate blocks[]
// ---------------------------------------------------------------------------

function SectionBlock({
  section, post, theme, language, sources,
}: {
  section: BlogSection;
  post: BlogPost;
  theme: Theme;
  language: LanguageCode;
  sources: Source[];
}) {
  const isDark = theme === "dark";
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2
        className={`mt-12 text-2xl font-bold leading-tight ${isDark ? "text-stone-100" : "text-stone-900"}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {renderRichText(section.title, theme, sources)}
      </h2>

      {section.blocks.map((block, i) => (
        <ContentBlockRenderer
          key={i}
          block={block}
          post={post}
          theme={theme}
          language={language}
          sources={sources}
        />
      ))}

      {section.subheadings?.map((sub) => (
        <section key={sub.id} id={sub.id} className="scroll-mt-24">
          <h3
            className={`mt-9 text-xl font-semibold ${isDark ? "text-stone-200" : "text-stone-900"}`}
          >
            {renderRichText(sub.title, theme, sources)}
          </h3>
          {sub.blocks.map((block, i) => (
            <ContentBlockRenderer
              key={i}
              block={block}
              post={post}
              theme={theme}
              language={language}
              sources={sources}
            />
          ))}
        </section>
      ))}
    </section>
  );
}

function ArticleBody({
  post, translation, theme, language,
}: {
  post: BlogPost;
  translation: BlogTranslation;
  theme: Theme;
  language: LanguageCode;
}) {
  const sources = translation.sources ?? post.sources ?? [];
  return (
    <div>
      {translation.sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          post={post}
          theme={theme}
          language={language}
          sources={sources}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

function HeadingSidebar({
  translation, theme,
}: {
  translation: BlogTranslation;
  theme: Theme;
}) {
  const isDark = theme === "dark";
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const ids: string[] = [];
    translation.sections.forEach((s) => {
      if (s.id) ids.push(s.id);
      (s.subheadings ?? []).forEach((sub) => { if (sub.id) ids.push(sub.id); });
    });
    ids.push("references");

    function onScroll() {
      const scrollY = window.scrollY + 80;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) current = id;
      }
      setActiveId(current);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [translation]);

  function sectionLinkClass(id: string) {
    const isActive = activeId === id;
    return [
      "block text-sm font-medium transition-colors",
      isActive
        ? "text-amber-500"
        : isDark
          ? "text-stone-400 hover:text-amber-300"
          : "text-stone-700 hover:text-amber-700",
    ].join(" ");
  }

  function subLinkClass(id: string) {
    const isActive = activeId === id;
    return [
      "block text-xs transition-colors",
      isActive
        ? "text-amber-500 font-semibold"
        : isDark
          ? "text-stone-600 hover:text-amber-300"
          : "text-stone-500 hover:text-amber-700",
    ].join(" ");
  }

  return (
    <div className={`rounded-xl border p-5 ${isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"}`}>
      <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        In this article
      </p>
      <nav className="space-y-3">
        {translation.sections.map((section) => (
          <div key={section.id}>
            <a href={`#${section.id}`} className={sectionLinkClass(section.id)}>
              {stripRefSyntax(section.title)}
            </a>
            {section.subheadings && section.subheadings.length > 0 && (
              <div className={`mt-2 space-y-2 border-l pl-3 ${isDark ? "border-stone-800" : "border-stone-200"}`}>
                {section.subheadings.map((sub) => (
                  <a key={sub.id} href={`#${sub.id}`} className={subLinkClass(sub.id)}>
                    {stripRefSyntax(sub.title)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        <a href="#references" className={sectionLinkClass("references")}>
          References
        </a>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources list — APA / MLA toggle with clickable links
// ---------------------------------------------------------------------------

type ReferenceStyle = "apa" | "mla";

function compactDate(value?: string | null, fallbackYear?: number | null): string {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return value;
  }
  return fallbackYear ? String(fallbackYear) : "n.d.";
}

function yearOnly(value?: string | null, fallbackYear?: number | null): string {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }
  return fallbackYear ? String(fallbackYear) : "n.d.";
}

function formatAuthorNameAPA(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => `${p[0]?.toUpperCase()}.`).join(" ");
  return `${last}, ${initials}`;
}

function formatAuthorNameMLA(name: string, index: number): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1 || index > 0) return name.trim();
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

function formatAuthorsAPA(authors?: string[]): string {
  if (!authors || authors.length === 0) return "";
  if (authors.length === 1) return formatAuthorNameAPA(authors[0]);
  if (authors.length === 2) return `${formatAuthorNameAPA(authors[0])}, & ${formatAuthorNameAPA(authors[1])}`;
  return `${authors.slice(0, -1).map(formatAuthorNameAPA).join(", ")}, & ${formatAuthorNameAPA(authors[authors.length - 1])}`;
}

function formatAuthorsMLA(authors?: string[]): string {
  if (!authors || authors.length === 0) return "";
  if (authors.length === 1) return `${formatAuthorNameMLA(authors[0], 0)}.`;
  if (authors.length === 2) return `${formatAuthorNameMLA(authors[0], 0)}, and ${authors[1]}.`;
  return `${formatAuthorNameMLA(authors[0], 0)}, et al.`;
}

function cleanSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function formatSourceAPA(source: Source): string {
  const title = source.title || source.label || "Untitled source";
  const authors = formatAuthorsAPA(source.authors);
  const date = yearOnly(source.publication_date, source.year ?? null);
  const container = source.journal || source.website_name || source.publisher || "";
  const parts: string[] = [];

  if (authors) parts.push(`${authors} (${date}).`);
  else parts.push(`(${date}).`);

  parts.push(cleanSentence(title));

  if (source.source_type === "journal") {
    const journalBits = [container, source.volume, source.issue ? `(${source.issue})` : ""].filter(Boolean).join(", ");
    if (journalBits) parts.push(cleanSentence(journalBits));
    if (source.pages) parts.push(cleanSentence(source.pages));
  } else if (container) {
    parts.push(cleanSentence(container));
  }

  if (source.doi) parts.push(source.doi.startsWith("http") ? source.doi : `https://doi.org/${source.doi}`);
  else if (source.url) parts.push(source.url);

  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function formatSourceMLA(source: Source): string {
  const title = source.title || source.label || "Untitled source";
  const authors = formatAuthorsMLA(source.authors);
  const container = source.journal || source.website_name || source.publisher || "";
  const date = compactDate(source.publication_date, source.year ?? null);
  const parts: string[] = [];

  if (authors) parts.push(authors);
  parts.push(`"${title}."`);
  if (container) parts.push(cleanSentence(container));
  if (source.publisher && source.publisher !== container) parts.push(cleanSentence(source.publisher));
  if (date !== "n.d.") parts.push(cleanSentence(date));
  if (source.pages) parts.push(`pp. ${source.pages}.`);
  if (source.url) parts.push(source.url);
  if (source.accessed_date) parts.push(`Accessed ${compactDate(source.accessed_date)}.`);

  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function formatSourceBasic(source: Source): string {
  const title = source.title || source.label || "Untitled source";
  const meta = [source.publisher || source.website_name, source.year ? String(source.year) : ""]
    .filter(Boolean)
    .join(", ");
  return meta ? `${title}. ${meta}.` : `${title}.`;
}

function sourceSupportsStyle(source: Source, style: ReferenceStyle): boolean {
  if (style === "apa") return Boolean(source.isApaCompatible);
  return Boolean(source.isMlaCompatible);
}

function formattedSource(source: Source, style: ReferenceStyle): string {
  if (style === "apa" && sourceSupportsStyle(source, "apa")) return formatSourceAPA(source);
  if (style === "mla" && sourceSupportsStyle(source, "mla")) return formatSourceMLA(source);
  return formatSourceBasic(source);
}

function SourcesList({
  post, translation, theme,
}: {
  post: BlogPost;
  translation: BlogTranslation;
  theme: Theme;
}) {
  const isDark = theme === "dark";
  const sources = translation.sources ?? post.sources ?? [];
  const [referenceStyle, setReferenceStyle] = useState<ReferenceStyle>("apa");

  if (sources.length === 0) return null;

  const activeButtonClass = "bg-amber-600 text-amber-50 border-amber-600";
  const inactiveButtonClass = isDark
    ? "border-stone-700 bg-stone-900 text-stone-400 hover:border-stone-500 hover:text-stone-100"
    : "border-stone-300 bg-white text-stone-600 hover:border-stone-500 hover:text-stone-900";

  return (
    <section
      id="references"
      className={`mt-12 border-t pt-6 ${isDark ? "border-stone-800" : "border-stone-200"}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
          References &amp; Sources
        </p>

        <div className="flex rounded-full p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setReferenceStyle("apa")}
            className={`rounded-full border px-3 py-1.5 transition-colors ${referenceStyle === "apa" ? activeButtonClass : inactiveButtonClass}`}
          >
            APA
          </button>
          <button
            type="button"
            onClick={() => setReferenceStyle("mla")}
            className={`ml-2 rounded-full border px-3 py-1.5 transition-colors ${referenceStyle === "mla" ? activeButtonClass : inactiveButtonClass}`}
          >
            MLA
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {sources.map((source, i) => {
          const compatible = sourceSupportsStyle(source, referenceStyle);
          const citationText = formattedSource(source, referenceStyle);
          const statusText = compatible ? referenceStyle.toUpperCase() : "Basic fallback";

          return (
            <li
              key={`${source.label}-${i}`}
              id={`ref-${i + 1}`}
              className={`scroll-mt-24 rounded-lg px-3 py-3 transition-colors ${
                isDark
                  ? "hover:bg-amber-950/20 target:bg-amber-950/40"
                  : "hover:bg-amber-50 target:bg-amber-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1 shrink-0 font-mono text-xs font-bold ${isDark ? "text-amber-500" : "text-amber-600"}`}>
                  [{i + 1}]
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                      compatible
                        ? isDark ? "border-emerald-700/60 text-emerald-300" : "border-emerald-300 text-emerald-700"
                        : isDark ? "border-stone-700 text-stone-500" : "border-stone-300 text-stone-500"
                    }`}>
                      {statusText}
                    </span>
                  </div>

                  <p className={`text-sm leading-7 ${isDark ? "text-stone-400" : "text-stone-700"}`}>
                    {citationText}
                  </p>

                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-1 inline-flex max-w-full items-center gap-1 break-all text-xs font-medium underline decoration-dashed underline-offset-4 ${
                        isDark ? "text-amber-400 hover:text-amber-300" : "text-amber-700 hover:text-amber-800"
                      }`}
                    >
                      Open source link ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Author bio
// ---------------------------------------------------------------------------

function AuthorBioCard({ author, theme }: { author: Author; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <div className={`flex items-start gap-4 rounded-xl border p-4 ${isDark ? "border-stone-800 bg-stone-900/50" : "border-stone-200 bg-stone-50"}`}>
      <AuthorPip author={author} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${isDark ? "text-stone-100" : "text-stone-900"}`}>{author.name}</span>
          <RoleBadge role={author.role} theme={theme} />
        </div>
        <p className={`mb-1 text-xs ${isDark ? "text-stone-400" : "text-stone-600"}`}>{author.title}</p>
        <p className={`text-xs leading-relaxed ${isDark ? "text-stone-500" : "text-stone-500"}`}>{author.bio}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

function AdCard({ ad, theme }: { ad: AdUnit; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <a
      href={ad.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group relative block overflow-hidden rounded-xl border p-5 ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      <div className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: ad.accentColor }} />
      <div className="mt-1 flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: ad.accentColor }}
        >
          {ad.logoInitials}
        </div>
        <div>
          <p className={`text-sm font-semibold ${isDark ? "text-stone-200" : "text-stone-800"}`}>{ad.company}</p>
          <p className={`mt-1 text-xs leading-snug ${isDark ? "text-stone-500" : "text-stone-500"}`}>{ad.tagline}</p>
        </div>
      </div>
    </a>
  );
}

function BottomAdStrip({ ads, theme }: { ads: AdUnit[]; theme: Theme }) {
  const isDark = theme === "dark";
  if (ads.length === 0) return null;
  return (
    <section className={`mt-14 rounded-2xl border p-5 ${isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"}`}>
      <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        Sponsored
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {ads.map((ad) => <AdCard key={ad.id} ad={ad} theme={theme} />)}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const langParam = searchParams.get("lang");
  const initialLang: LanguageCode = isLanguageCode(langParam) ? langParam : "en";

  const [theme, setTheme]         = useState<Theme>("dark");
  const [language, setLanguage]   = useState<LanguageCode>(initialLang);
  const [post, setPost]           = useState<BlogPost | null>(null);
  const [allAds, setAllAds]       = useState<AdUnit[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([
    { code: "en", label: "English", nativeLabel: "English" },
  ]);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);
  const [isAdmin, setIsAdmin]     = useState<boolean>(false);

  // Detect system colour preference once on mount
  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
  }, []);

  // Check editor access — same probe used on the blog list page
  useEffect(() => {
    checkIsAdmin().then(setIsAdmin);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([apiFetchPostDetail(slug), apiFetchAds(), apiFetchLanguages()])
      .then(([p, ads, langs]) => { setPost(p); setAllAds(ads); setLanguages(langs); })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : "Unknown error"); })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    if (!post.translations[language]) setLanguage("en");
  }, [language, post]);

  const isDark = theme === "dark";
  const ads       = useMemo(() => (post ? getAdsForPost(post, allAds) : []), [post, allAds]);
  const bottomAds = useMemo(() => allAds.slice(0, 3), [allAds]);

  function applyLanguage(lang: LanguageCode) {
    setLanguage(lang);
    router.replace(`/modelblog/blog/${post!.slug}?lang=${lang}`, { scroll: false });
  }

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-stone-950" : "bg-stone-50"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className={`text-sm ${isDark ? "text-stone-500" : "text-stone-400"}`}>Loading article…</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center ${isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
        <p className={`text-2xl font-bold ${isDark ? "text-stone-100" : "text-stone-900"}`}>
          {error ? "Failed to load article" : "Article not found"}
        </p>
        {error && <p className="max-w-md text-sm text-red-400">{error}</p>}
        <p className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>
          The post <code className="rounded bg-stone-800/50 px-1 py-0.5 text-amber-400">{slug}</code> could not be found.
        </p>
        <button
          onClick={() => router.push(`/modelblog/blog?lang=${language}`)}
          className="mt-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-amber-50 hover:bg-amber-500"
        >
          ← Back to all articles
        </button>
      </div>
    );
  }

  const translation: BlogTranslation | undefined = getTranslation(post, language);

  if (!translation) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
        No translation available for this article.
      </div>
    );
  }

  const coverImage  = getCoverImage(post);
  const postSources = translation.sources ?? post.sources ?? [];

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"}`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        li:target { animation: ref-flash 1.8s ease-out; }
        @keyframes ref-flash {
          0%   { background-color: rgba(245,158,11,0.25); }
          100% { background-color: transparent; }
        }
      `}</style>

      <ReadingProgress theme={theme} />

      {/* Floating edit button — only visible to editors */}
      {isAdmin && <FloatingEditButton slug={slug} theme={theme} />}

      <header className={`sticky top-0 z-30 border-b backdrop-blur ${isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push(`/modelblog/blog?lang=${language}`)}
            className={`text-sm ${isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-800"}`}
          >
            ← All Articles
          </button>
          <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
        </div>
      </header>

      <div className="h-1 w-full" style={{ background: post.coverAccent }} />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-[240px_minmax(0,760px)_280px] xl:gap-8 xl:items-start">

          <aside className="hidden xl:block self-start sticky top-[52px] max-h-[calc(100vh-64px)] overflow-y-auto space-y-4 pb-4">
            <LanguageSwitcher post={post} language={language} languages={languages} theme={theme} onLanguageChange={applyLanguage} />
            <HeadingSidebar translation={translation} theme={theme} />
          </aside>

          <article className="min-w-0">
            <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
              {post.category}
            </p>
            <h1
              className={`mb-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl ${isDark ? "text-stone-50" : "text-stone-900"}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {renderRichText(translation.title, theme, postSources)}
            </h1>
            <p className={`mb-8 text-lg leading-relaxed ${isDark ? "text-stone-400" : "text-stone-600"}`}>
              {renderRichText(translation.subtitle, theme, postSources)}
            </p>

            <div className="mb-8 xl:hidden">
              <LanguageSwitcher post={post} language={language} languages={languages} theme={theme} onLanguageChange={applyLanguage} />
            </div>

            <div className={`mb-10 flex flex-wrap items-center gap-4 border-y py-4 ${isDark ? "border-stone-800" : "border-stone-200"}`}>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {post.authors.map((a) => <AuthorPip key={a.id} author={a} />)}
                </div>
                <span className={`text-sm ${isDark ? "text-stone-400" : "text-stone-600"}`}>
                  {post.authors.map((a) => a.name).join(" & ")}
                </span>
              </div>
              <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>{formatDate(post.publishedAt)}</span>
              <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>{post.readingTimeMinutes} min read</span>
            </div>

            {coverImage && (
              <ArticleImage image={coverImage} theme={theme} language={language} sources={postSources} />
            )}

            <ArticleBody post={post} translation={translation} theme={theme} language={language} />
            <SourcesList post={post} translation={translation} theme={theme} />

            <section className="mt-10 space-y-3">
              {post.authors.map((a) => <AuthorBioCard key={a.id} author={a} theme={theme} />)}
            </section>

            <BottomAdStrip ads={bottomAds} theme={theme} />
          </article>

          <aside className="hidden xl:block self-start sticky top-[52px] max-h-[calc(100vh-64px)] overflow-y-auto space-y-4 pb-4">
            {ads.map((ad) => <AdCard key={ad.id} ad={ad} theme={theme} />)}
          </aside>

        </div>
      </div>
    </div>
  );
}