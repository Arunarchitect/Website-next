"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  apiFetchPosts,
  apiFetchAuthors,
  apiFetchCategories,
  apiFetchLanguages,
  formatDate,
  getCoverImage,
  getTranslation,
  type Author,
  type AuthorRole,
  type BlogPost,
  type LanguageCode,
  type LanguageOption,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

function isLanguageCode(v: string | null): v is LanguageCode {
  return v === "en" || v === "ml" || v === "hi" || v === "ta";
}

// ---------------------------------------------------------------------------
// Admin check helper
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
// Post field helpers
// ---------------------------------------------------------------------------

function getSafeTranslation(post: BlogPost, language: LanguageCode) {
  return getTranslation(post, language);
}

function getPostTitle(post: BlogPost, language: LanguageCode): string {
  return getSafeTranslation(post, language)?.title ?? post.slug;
}

function getPostSubtitle(post: BlogPost, language: LanguageCode): string {
  return getSafeTranslation(post, language)?.subtitle ?? "";
}

function getPostExcerpt(post: BlogPost, language: LanguageCode): string {
  const t = getSafeTranslation(post, language);
  return t?.excerpt ?? t?.subtitle ?? "";
}

function hasReadableContent(post: BlogPost, language: LanguageCode): boolean {
  return Boolean(getSafeTranslation(post, language));
}

// ---------------------------------------------------------------------------
// Shared UI atoms
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

function AuthorPip({ author }: { author: Author }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/20"
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
// Language switcher — pill buttons (same style as blog detail page)
// ---------------------------------------------------------------------------

function LanguageTool({
  language,
  languages,
  onLanguageChange,
  theme,
}: {
  language: LanguageCode;
  languages: LanguageOption[];
  onLanguageChange: (l: LanguageCode) => void;
  theme: Theme;
}) {
  const isDark = theme === "dark";

  if (languages.length <= 1) return null;

  return (
    <div className={`rounded-xl border p-4 ${isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"}`}>
      <p className={`mb-3 text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        Language
      </p>
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
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
// Cards — use the "block link" pattern:
//   • <article> is the positioned container (group)
//   • a full-card <a> (z-0) provides the clickable/right-click surface
//   • the Edit <a> (z-10) sits above it so it gets its own click target
// This avoids the invalid nested-<a> problem while giving both links full
// browser behaviour (middle-click, right-click → open in new tab, etc.)
// ---------------------------------------------------------------------------

type FeaturedCardProps = {
  post: BlogPost;
  index: number;
  theme: Theme;
  language: LanguageCode;
  isAdmin: boolean;
};

function FeaturedCard({ post, index, theme, language, isAdmin }: FeaturedCardProps) {
  const isWide   = index === 0;
  const isDark   = theme === "dark";
  const cover    = getCoverImage(post);
  const title    = getPostTitle(post, language);
  const subtitle = getPostSubtitle(post, language);

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        isWide ? "md:col-span-2" : ""
      } ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      {/* Full-card link — z-0, covers everything */}
      <a
        href={`/modelblog/blog/${post.slug}?lang=${language}`}
        aria-label={title}
        className="absolute inset-0 z-0"
      />

      {/* Edit link — z-10, floats above the card link */}
      {isAdmin && (
        <a
          href={`/modelblog/blog/edit/${post.slug}`}
          title="Edit post"
          className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg backdrop-blur-sm ${
            isDark
              ? "border-amber-600/60 bg-stone-950/80 text-amber-400 hover:bg-amber-600 hover:text-amber-50"
              : "border-amber-500/60 bg-white/90 text-amber-600 hover:bg-amber-500 hover:text-white"
          }`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.862 4.487" />
          </svg>
          Edit
        </a>
      )}

      {cover && (
        <div className="relative h-60 overflow-hidden">
          <img
            src={cover.src}
            alt={cover.alt[language] ?? cover.alt.en}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className="h-1 w-full shrink-0" style={{ background: post.coverAccent }} />
      <div className="relative z-[1] flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            {post.category}
          </span>
          <span className={`text-[11px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>
            {post.readingTimeMinutes} min read
          </span>
        </div>
        <h2
          className={`font-bold leading-tight transition-colors ${isWide ? "text-2xl md:text-3xl" : "text-xl"} ${
            isDark
              ? "text-stone-100 group-hover:text-amber-300"
              : "text-stone-900 group-hover:text-amber-700"
          }`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <p className={`text-sm leading-relaxed ${isDark ? "text-stone-400" : "text-stone-500"}`}>
          {subtitle}
        </p>
        <div className="mt-auto flex items-center gap-2">
          <div className="flex -space-x-2">
            {post.authors.map((a) => <AuthorPip key={a.id} author={a} />)}
          </div>
          <span className={`text-xs ${isDark ? "text-stone-500" : "text-stone-500"}`}>
            {post.authors.map((a) => a.name).join(" & ")}
          </span>
          <span className={`ml-auto text-xs ${isDark ? "text-stone-700" : "text-stone-400"}`}>
            {formatDate(post.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

type PostCardProps = {
  post: BlogPost;
  theme: Theme;
  language: LanguageCode;
  isAdmin: boolean;
};

function PostCard({ post, theme, language, isAdmin }: PostCardProps) {
  const isDark  = theme === "dark";
  const cover   = getCoverImage(post);
  const title   = getPostTitle(post, language);
  const excerpt = getPostExcerpt(post, language);

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      {/* Full-card link — z-0 */}
      <a
        href={`/modelblog/blog/${post.slug}?lang=${language}`}
        aria-label={title}
        className="absolute inset-0 z-0"
      />

      {/* Edit link — z-10 */}
      {isAdmin && (
        <a
          href={`/modelblog/blog/edit/${post.slug}`}
          title="Edit post"
          className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg backdrop-blur-sm ${
            isDark
              ? "border-amber-600/60 bg-stone-950/80 text-amber-400 hover:bg-amber-600 hover:text-amber-50"
              : "border-amber-500/60 bg-white/90 text-amber-600 hover:bg-amber-500 hover:text-white"
          }`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.862 4.487" />
          </svg>
          Edit
        </a>
      )}

      {cover && (
        <img
          src={cover.src}
          alt={cover.alt[language] ?? cover.alt.en}
          className="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
        />
      )}
      <div className="h-[3px] w-full" style={{ background: post.coverAccent }} />
      <div className="relative z-[1] flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-600" : "text-stone-400"}`}>
            {post.category}
          </span>
          <span className={`text-[10px] ${isDark ? "text-stone-700" : "text-stone-400"}`}>
            {post.readingTimeMinutes} min
          </span>
        </div>
        <h3
          className={`text-base font-bold leading-snug transition-colors ${
            isDark
              ? "text-stone-200 group-hover:text-amber-300"
              : "text-stone-900 group-hover:text-amber-700"
          }`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h3>
        <p className={`line-clamp-2 text-xs leading-relaxed ${isDark ? "text-stone-500" : "text-stone-500"}`}>
          {excerpt}
        </p>
      </div>
    </article>
  );
}

function AuthorsSidebar({ theme, authors }: { theme: Theme; authors: Record<string, Author> }) {
  const isDark = theme === "dark";
  return (
    <aside className={`rounded-xl border p-5 ${isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"}`}>
      <h3 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        Contributors
      </h3>
      {Object.values(authors).map((author) => (
        <div key={author.id} className="border-t border-stone-800/40 py-3 first:border-t-0">
          <div className="mb-1 flex items-center gap-2">
            <AuthorPip author={author} />
            <div>
              <p className={`text-xs font-semibold ${isDark ? "text-stone-200" : "text-stone-800"}`}>{author.name}</p>
              <RoleBadge role={author.role} theme={theme} />
            </div>
          </div>
          <p className={`ml-9 text-[11px] leading-snug ${isDark ? "text-stone-600" : "text-stone-500"}`}>
            {author.bio}
          </p>
        </div>
      ))}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelBlogPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const langParam  = searchParams.get("lang");
  const initialLang: LanguageCode = isLanguageCode(langParam) ? langParam : "en";

  const [theme,            setTheme]            = useState<Theme>("dark");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchTerm,       setSearchTerm]       = useState<string>("");
  const [showSidebar,      setShowSidebar]      = useState<boolean>(false);
  const [language,         setLanguage]         = useState<LanguageCode>(initialLang);
  const [isAdmin,          setIsAdmin]          = useState<boolean>(false);

  const [posts,      setPosts]      = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [authors,    setAuthors]    = useState<Record<string, Author>>({});
  const [languages,  setLanguages]  = useState<LanguageOption[]>([
    { code: "en", label: "English", nativeLabel: "English" },
  ]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
  }, []);

  useEffect(() => { checkIsAdmin().then(setIsAdmin); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([apiFetchPosts(), apiFetchCategories(), apiFetchAuthors(), apiFetchLanguages()])
      .then(([p, c, a, langs]) => { setPosts(p); setCategories(c); setAuthors(a); setLanguages(langs); })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : "Unknown error"); })
      .finally(() => setLoading(false));
  }, []);

  // Keep URL in sync when language pill is clicked
  function handleLanguageChange(lang: LanguageCode) {
    setLanguage(lang);
    router.replace(`/modelblog/blog?lang=${lang}`, { scroll: false });
  }

  const isDark = theme === "dark";

  const results = useMemo<BlogPost[]>(() => {
    const q = searchTerm.trim().toLowerCase();
    return posts
      .filter((post) => hasReadableContent(post, language))
      .filter((post) => selectedCategory === "All" || post.category === selectedCategory)
      .filter((post) => {
        if (!q) return true;
        const title      = getPostTitle(post, language);
        const subtitle   = getPostSubtitle(post, language);
        const excerpt    = getPostExcerpt(post, language);
        const authorNames = post.authors.map((a) => a.name).join(" ");
        return `${title} ${subtitle} ${excerpt} ${post.category} ${authorNames}`.toLowerCase().includes(q);
      });
  }, [posts, searchTerm, selectedCategory, language]);

  const showFeatured = !searchTerm && selectedCategory === "All";

  const featured = useMemo<BlogPost[]>(
    () => (showFeatured ? results.filter((p) => p.featured).slice(0, 3) : []),
    [results, showFeatured],
  );

  const nonFeatured = useMemo<BlogPost[]>(() => {
    if (!showFeatured) return results;
    const featuredIds = new Set(featured.map((p) => p.id));
    const rest = results.filter((p) => !featuredIds.has(p.id));
    return rest.length > 0 ? rest : results;
  }, [results, featured, showFeatured]);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"}`}
      style={{
        fontFamily: language === "ml"
          ? "'Noto Sans Malayalam', system-ui, sans-serif"
          : "'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .line-clamp-2 { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
      `}</style>

      {/* ── Header ── */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur ${isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <span
              className={`text-xl font-bold tracking-tight ${isDark ? "text-stone-100" : "text-stone-900"}`}
              style={{ fontFamily: language === "ml" ? "'Noto Sans Malayalam', system-ui, sans-serif" : "'Playfair Display', Georgia, serif" }}
            >
              Model<span className="text-amber-500">Blog</span>
            </span>
            <span className={`ml-3 hidden text-xs uppercase tracking-widest sm:inline ${isDark ? "text-stone-600" : "text-stone-400"}`}>
              Architecture · BIM · Visualisation
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <a
                href="/modelblog/blog/edit/new"
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500 transition-colors"
                style={{ textDecoration: "none" }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Post
              </a>
            )}
            <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${isDark ? "border-stone-800 text-stone-500 hover:text-stone-200" : "border-stone-300 text-stone-500 hover:text-stone-800"}`}
            >
              Contributors
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Admin / editor banner */}
        {isAdmin && (
          <div className={`mb-6 flex items-center justify-between rounded-xl border px-5 py-3 ${isDark ? "border-amber-800/50 bg-amber-950/30" : "border-amber-300 bg-amber-50"}`}>
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-lg">🛡</span>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>Editor Mode</p>
                <p className={`text-xs ${isDark ? "text-amber-500/70" : "text-amber-600"}`}>
                  Hover over any post card to reveal the Edit button.
                </p>
              </div>
            </div>
            <a
              href="/modelblog/blog/edit/new"
              className="hidden sm:flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500 transition-colors"
              style={{ textDecoration: "none" }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Post
            </a>
          </div>
        )}

        {/* Language switcher — pills, no dropdown */}
        <div className="mb-6">
          <LanguageTool
            language={language}
            languages={languages}
            onLanguageChange={handleLanguageChange}
            theme={theme}
          />
        </div>

        {/* Search + categories */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search articles, authors, topics…"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm placeholder-stone-500 focus:outline-none ${
              isDark
                ? "border-stone-800 bg-stone-900 text-stone-200 focus:border-amber-700"
                : "border-stone-300 bg-white text-stone-800 focus:border-amber-500"
            }`}
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3 py-2 text-xs font-medium ${
                  selectedCategory === cat
                    ? "bg-amber-600 text-amber-100"
                    : isDark
                      ? "bg-stone-900 text-stone-500 hover:text-stone-200"
                      : "bg-white text-stone-500 shadow-sm hover:text-stone-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            Failed to load posts: {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-64 animate-pulse rounded-2xl ${isDark ? "bg-stone-900" : "bg-stone-200"}`} />
            ))}
          </div>
        ) : (
          <div className={`grid gap-8 ${showSidebar ? "lg:grid-cols-[1fr_300px]" : ""}`}>
            <main>
              {showFeatured && featured.length > 0 && (
                <section className="mb-10">
                  <h2 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
                    Featured
                  </h2>
                  <div className="grid gap-5 md:grid-cols-3">
                    {featured.map((post, i) => (
                      <FeaturedCard
                        key={post.id}
                        post={post}
                        index={i}
                        theme={theme}
                        language={language}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
                  {searchTerm || selectedCategory !== "All" ? "Results" : "Latest Articles"}
                </h2>
                {nonFeatured.length === 0 ? (
                  <div className={`rounded-xl border p-8 text-center text-sm ${isDark ? "border-stone-800 bg-stone-950 text-stone-500" : "border-stone-200 bg-white text-stone-500"}`}>
                    No articles found.
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {nonFeatured.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        theme={theme}
                        language={language}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                )}
              </section>
            </main>

            {showSidebar && <AuthorsSidebar theme={theme} authors={authors} />}
          </div>
        )}
      </div>
    </div>
  );
}