"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  getPostBySlug,
  getAdsForPost,
  formatDate,
  type BlogPost,
  type Author,
  type AuthorRole,
  type AdUnit,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

// ─── Day/Night Toggle ─────────────────────────────────────────────────────────

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className={`relative w-14 h-7 rounded-full border transition-colors duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
        ${isDark ? "bg-stone-900 border-stone-700" : "bg-sky-100 border-sky-300"}`}
    >
      {/* Track stars (dark) */}
      {isDark && (
        <>
          <span className="absolute top-1 left-1.5 w-0.5 h-0.5 rounded-full bg-stone-500 opacity-70" />
          <span className="absolute top-3 left-3 w-0.5 h-0.5 rounded-full bg-stone-500 opacity-50" />
          <span className="absolute top-1.5 left-5 w-0.5 h-0.5 rounded-full bg-stone-500 opacity-60" />
        </>
      )}
      {/* Track clouds (light) */}
      {!isDark && (
        <span className="absolute top-1.5 left-1.5 w-4 h-2 rounded-full bg-white opacity-80" />
      )}
      {/* Knob */}
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center text-sm transition-all duration-500
          ${isDark
            ? "translate-x-7 bg-stone-800 border border-stone-600"
            : "translate-x-0.5 bg-amber-400 border border-amber-300"
          }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AuthorPip({
  author,
  size = "sm",
}: {
  author: Author;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "w-12 h-12 text-base"
      : size === "md"
        ? "w-9 h-9 text-sm"
        : "w-7 h-7 text-xs";
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: author.avatarColor }}
      title={author.name}
    >
      {author.avatarInitials}
    </span>
  );
}

const ROLE_STYLES_DARK: Record<AuthorRole, string> = {
  Eminent: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
  Editorial: "bg-sky-900/40 text-sky-300 border border-sky-700/40",
  Guest: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
  Staff: "bg-stone-800 text-stone-400 border border-stone-700",
};
const ROLE_STYLES_LIGHT: Record<AuthorRole, string> = {
  Eminent: "bg-amber-100 text-amber-800 border border-amber-300",
  Editorial: "bg-sky-100 text-sky-800 border border-sky-300",
  Guest: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Staff: "bg-stone-100 text-stone-600 border border-stone-300",
};

function RoleBadge({ role, theme }: { role: AuthorRole; theme: Theme }) {
  const styles = theme === "dark" ? ROLE_STYLES_DARK : ROLE_STYLES_LIGHT;
  return (
    <span
      className={`text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full ${styles[role]}`}
    >
      {role}
    </span>
  );
}

function AuthorBioCard({ author, theme }: { author: Author; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border ${isDark ? "bg-stone-900/50 border-stone-800" : "bg-stone-50 border-stone-200"}`}
    >
      <AuthorPip author={author} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`font-semibold text-sm ${isDark ? "text-stone-100" : "text-stone-900"}`}>
            {author.name}
          </span>
          <RoleBadge role={author.role} theme={theme} />
        </div>
        <p className={`text-xs mb-1 ${isDark ? "text-stone-400" : "text-stone-600"}`}>
          {author.title}
        </p>
        <p className={`text-xs leading-relaxed ${isDark ? "text-stone-500" : "text-stone-500"}`}>
          {author.bio}
        </p>
      </div>
    </div>
  );
}

function SourcesList({ sources, theme }: { sources: BlogPost["sources"]; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <div className={`mt-8 pt-6 border-t ${isDark ? "border-stone-800" : "border-stone-200"}`}>
      <p className={`text-[11px] font-semibold tracking-widest uppercase mb-4 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        References & Sources
      </p>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className={`text-xs font-mono shrink-0 ${isDark ? "text-stone-700" : "text-stone-400"}`}>
              [{i + 1}]
            </span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm leading-snug transition-colors ${isDark ? "text-stone-400 hover:text-amber-400" : "text-stone-600 hover:text-amber-700"}`}
            >
              {s.label}
              <span className={`ml-2 ${isDark ? "text-stone-600" : "text-stone-400"}`}>
                — {s.publisher}{s.year ? `, ${s.year}` : ""}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdCard({ ad, theme }: { ad: AdUnit; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <a
      href={ad.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group block rounded-xl border p-5 transition-all duration-200 relative overflow-hidden
        ${isDark ? "bg-stone-950 border-stone-800 hover:border-stone-600" : "bg-white border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md"}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60" style={{ background: ad.accentColor }} />
      <div className="flex items-start gap-3 mt-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: ad.accentColor }}
        >
          {ad.logoInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold transition-colors ${isDark ? "text-stone-200 group-hover:text-amber-300" : "text-stone-800 group-hover:text-amber-700"}`}>
              {ad.company}
            </span>
            <span className={`text-[9px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded ${isDark ? "bg-stone-800 text-stone-600" : "bg-stone-100 text-stone-400"}`}>
              Sponsored
            </span>
          </div>
          <p className={`text-xs leading-snug ${isDark ? "text-stone-500" : "text-stone-500"}`}>
            {ad.tagline}
          </p>
        </div>
      </div>
    </a>
  );
}

function ArticleBody({ html, theme }: { html: string; theme: Theme }) {
  const isDark = theme === "dark";
  return (
    <>
      <style>{`
        .article-body h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.4rem;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          line-height: 1.3;
          color: ${isDark ? "#e7e5e4" : "#1c1917"};
        }
        .article-body p {
          margin-bottom: 1.4rem;
          line-height: 1.85;
          color: ${isDark ? "#a8a29e" : "#44403c"};
          font-size: 1.0625rem;
        }
        .article-body strong {
          color: ${isDark ? "#d6d3d1" : "#292524"};
          font-weight: 600;
        }
        .article-body em {
          font-style: italic;
          color: ${isDark ? "#c4b5a5" : "#57534e"};
        }
        .article-body blockquote {
          border-left: 3px solid #d97706;
          padding-left: 1.25rem;
          margin: 2rem 0;
          color: ${isDark ? "#92918a" : "#57534e"};
          font-style: italic;
        }
        .article-body a { color: #d97706; text-decoration: underline; text-underline-offset: 2px; }
        .article-body a:hover { color: #f59e0b; }
      `}</style>
      <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

function ReadingProgress({ theme }: { theme: Theme }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (el.scrollTop / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-[3px] ${theme === "dark" ? "bg-stone-900" : "bg-stone-200"}`}>
      <div className="h-full bg-amber-500 transition-all duration-100" style={{ width: `${progress}%` }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BlogDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
  );

  // Keep in sync with OS-level changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const post = getPostBySlug(slug);
  const isDark = theme === "dark";

  if (!post) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"}`}>
        <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Article not found
        </p>
        <button
          onClick={() => router.push("/modelblog/blog")}
          className="text-sm text-amber-500 hover:text-amber-400 underline underline-offset-4"
        >
          ← Back to all articles
        </button>
      </div>
    );
  }

  const ads = getAdsForPost(post);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"}`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      `}</style>

      <ReadingProgress theme={theme} />

      {/* ── Header ── */}
      <header className={`sticky top-0 z-30 backdrop-blur border-b transition-colors duration-300 ${isDark ? "bg-stone-950/90 border-stone-900" : "bg-stone-50/90 border-stone-200"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/blog")}
              className={`flex items-center gap-1.5 text-sm shrink-0 transition-colors ${isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-800"}`}
            >
              ← <span className="hidden sm:inline">All Articles</span>
            </button>
            <span className={isDark ? "text-stone-800" : "text-stone-300"}>|</span>
            <span className={`text-sm font-medium truncate ${isDark ? "text-stone-400" : "text-stone-600"}`}>
              {post.title}
            </span>
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
        </div>
      </header>

      <div className="w-full h-1" style={{ background: post.coverAccent }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.push("/blog")}
            className={`text-xs transition-colors ${isDark ? "text-stone-600 hover:text-amber-400" : "text-stone-400 hover:text-amber-600"}`}
          >
            ModelBlog
          </button>
          <span className={`text-xs ${isDark ? "text-stone-800" : "text-stone-300"}`}>/</span>
          <span className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>{post.category}</span>
        </div>

        <p className={`text-[11px] font-semibold tracking-widest uppercase mb-4 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
          {post.category}
        </p>

        <h1
          className={`text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 ${isDark ? "text-stone-50" : "text-stone-900"}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {post.title}
        </h1>

        <p className={`text-lg leading-relaxed mb-8 ${isDark ? "text-stone-400" : "text-stone-600"}`}>
          {post.subtitle}
        </p>

        <div className={`flex flex-wrap items-center gap-4 py-4 border-y mb-10 ${isDark ? "border-stone-800" : "border-stone-200"}`}>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {post.authors.map((a) => <AuthorPip key={a.id} author={a} size="sm" />)}
            </div>
            <span className={`text-sm ${isDark ? "text-stone-400" : "text-stone-600"}`}>
              {post.authors.map((a) => a.name).join(" & ")}
            </span>
          </div>
          <span className={`text-sm ${isDark ? "text-stone-600" : "text-stone-400"}`}>{formatDate(post.publishedAt)}</span>
          <span className={`text-sm ${isDark ? "text-stone-600" : "text-stone-400"}`}>{post.readingTimeMinutes} min read</span>
        </div>

        <ArticleBody html={post.body} theme={theme} />

        <div className="flex flex-wrap gap-2 mt-8">
          {post.tags.map((t) => (
            <span key={t} className={`text-[11px] border px-3 py-1 rounded-full ${isDark ? "text-stone-500 border-stone-800" : "text-stone-500 border-stone-200"}`}>
              #{t}
            </span>
          ))}
        </div>

        <SourcesList sources={post.sources} theme={theme} />

        <div className={`mt-10 pt-8 border-t ${isDark ? "border-stone-800" : "border-stone-200"}`}>
          <p className={`text-[11px] font-semibold tracking-widest uppercase mb-4 ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            About the Authors
          </p>
          <div className="space-y-3">
            {post.authors.map((a) => <AuthorBioCard key={a.id} author={a} theme={theme} />)}
          </div>
        </div>

        <div className={`mt-10 pt-6 border-t ${isDark ? "border-stone-900" : "border-stone-200"}`}>
          <button
            onClick={() => router.push("/blog")}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-stone-500 hover:text-amber-400" : "text-stone-400 hover:text-amber-700"}`}
          >
            ← Back to all articles
          </button>
        </div>
      </div>

      {/* ── Sponsored ── */}
      <div className={`border-t mt-4 ${isDark ? "border-stone-900" : "border-stone-200"}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-3 mb-6">
            <p className={`text-[10px] font-semibold tracking-widest uppercase ${isDark ? "text-stone-700" : "text-stone-400"}`}>
              From our partners — related to{" "}
              <span className={isDark ? "text-stone-600" : "text-stone-500"}>{post.category}</span>
            </p>
            <div className={`flex-1 h-px ${isDark ? "bg-stone-900" : "bg-stone-200"}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ads.map((ad) => <AdCard key={ad.id} ad={ad} theme={theme} />)}
          </div>
          <p className={`text-center text-[11px] mt-6 ${isDark ? "text-stone-800" : "text-stone-300"}`}>
            Want to reach architects, planners &amp; built environment professionals?{" "}
            <a href="mailto:ads@modelblog.example" className={`underline underline-offset-2 transition-colors ${isDark ? "hover:text-stone-500" : "hover:text-stone-500"}`}>
              Advertise with ModelBlog →
            </a>
          </p>
        </div>
      </div>

      <footer className={`border-t py-8 text-center text-xs transition-colors duration-300 ${isDark ? "border-stone-900 text-stone-700" : "border-stone-200 text-stone-400"}`}>
        ModelBlog — informed writing on architecture, cities, and the built environment. All articles are independently authored and editorially reviewed.
      </footer>
    </div>
  );
}