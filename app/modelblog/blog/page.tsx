"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTHORS,
  CATEGORIES,
  LANGUAGES,
  formatDate,
  getCoverImage,
  getFeaturedPosts,
  getTranslation,
  searchPosts,
  type Author,
  type AuthorRole,
  type BlogPost,
  type LanguageCode,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === "en" || value === "ml" || value === "hi" || value === "ta";
}

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
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${styles[role]}`}>
      {role}
    </span>
  );
}

function LanguageTool({
  language,
  onLanguageChange,
  onTranslate,
  theme,
}: {
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  onTranslate: () => void;
  theme: Theme;
}) {
  const isDark = theme === "dark";
  const otherLanguages = LANGUAGES.filter((item) => item.code !== "en");

  return (
    <div className={`rounded-xl border p-4 ${
      isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
    }`}>
      <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>
        Language
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
          className={`rounded-lg border px-3 py-2 text-sm outline-none ${
            isDark
              ? "border-stone-800 bg-stone-900 text-stone-300"
              : "border-stone-300 bg-white text-stone-700"
          }`}
        >
          <option value="en">English</option>
          {otherLanguages.map((item) => (
            <option key={item.code} value={item.code}>
              {item.nativeLabel}
            </option>
          ))}
        </select>

        <button
          onClick={onTranslate}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500"
        >
          {language === "en" ? "Read English" : "Translate"}
        </button>
      </div>
    </div>
  );
}

function FeaturedCard({
  post,
  index,
  theme,
  language,
  onClick,
}: {
  post: BlogPost;
  index: number;
  theme: Theme;
  language: LanguageCode;
  onClick: () => void;
}) {
  const isWide = index === 0;
  const isDark = theme === "dark";
  const coverImage = getCoverImage(post);
  const translation = getTranslation(post, language);

  return (
    <article
      onClick={onClick}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        isWide ? "md:col-span-2" : ""
      } ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      {coverImage && (
        <div className="relative h-60 overflow-hidden">
          <img
            src={coverImage.src}
            alt={coverImage.alt[language] ?? coverImage.alt.en}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
      )}

      <div className="h-1 w-full shrink-0" style={{ background: post.coverAccent }} />

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
            {post.category}
          </span>
          <span className={`text-[11px] ${isDark ? "text-stone-600" : "text-stone-400"}`}>
            {post.readingTimeMinutes} min read
          </span>
        </div>

        <h2
          className={`font-bold leading-tight transition-colors ${
            isWide ? "text-2xl md:text-3xl" : "text-xl"
          } ${isDark ? "text-stone-100 group-hover:text-amber-300" : "text-stone-900 group-hover:text-amber-700"}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {translation.title}
        </h2>

        <p className={`text-sm leading-relaxed ${isDark ? "text-stone-400" : "text-stone-500"}`}>
          {translation.subtitle}
        </p>

        <div className="mt-auto flex items-center gap-2">
          <div className="flex -space-x-2">
            {post.authors.map((author) => (
              <AuthorPip key={author.id} author={author} />
            ))}
          </div>
          <span className={`text-xs ${isDark ? "text-stone-500" : "text-stone-500"}`}>
            {post.authors.map((author) => author.name).join(" & ")}
          </span>
          <span className={`ml-auto text-xs ${isDark ? "text-stone-700" : "text-stone-400"}`}>
            {formatDate(post.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

function PostCard({
  post,
  theme,
  language,
  onClick,
}: {
  post: BlogPost;
  theme: Theme;
  language: LanguageCode;
  onClick: () => void;
}) {
  const isDark = theme === "dark";
  const coverImage = getCoverImage(post);
  const translation = getTranslation(post, language);

  return (
    <article
      onClick={onClick}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      {coverImage && (
        <img
          src={coverImage.src}
          alt={coverImage.alt[language] ?? coverImage.alt.en}
          className="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
        />
      )}

      <div className="h-[3px] w-full" style={{ background: post.coverAccent }} />

      <div className="flex flex-1 flex-col gap-3 p-5">
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
            isDark ? "text-stone-200 group-hover:text-amber-300" : "text-stone-900 group-hover:text-amber-700"
          }`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {translation.title}
        </h3>

        <p className={`line-clamp-2 text-xs leading-relaxed ${isDark ? "text-stone-500" : "text-stone-500"}`}>
          {translation.excerpt}
        </p>
      </div>
    </article>
  );
}

function AuthorsSidebar({ theme }: { theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <aside className={`rounded-xl border p-5 ${
      isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
    }`}>
      <h3 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
        Contributors
      </h3>

      {Object.values(AUTHORS).map((author) => (
        <div key={author.id} className="border-t border-stone-800/40 py-3 first:border-t-0">
          <div className="mb-1 flex items-center gap-2">
            <AuthorPip author={author} />
            <div>
              <p className={`text-xs font-semibold ${isDark ? "text-stone-200" : "text-stone-800"}`}>
                {author.name}
              </p>
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

export default function ModelBlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const langParam = searchParams.get("lang");
  const initialLanguage: LanguageCode = isLanguageCode(langParam) ? langParam : "en";

  const [theme, setTheme] = useState<Theme>("dark");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>(initialLanguage);

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }, []);

  const isDark = theme === "dark";

  const featured = useMemo(() => getFeaturedPosts(language), [language]);

  const results = useMemo(
    () => searchPosts(searchTerm, selectedCategory, language),
    [searchTerm, selectedCategory, language],
  );

  const nonFeatured = useMemo(
    () => results.filter((post) => !post.featured || searchTerm || selectedCategory !== "All"),
    [results, searchTerm, selectedCategory],
  );

  const showFeatured = !searchTerm && selectedCategory === "All";

  const applyLanguage = () => {
    router.replace(`/modelblog/blog?lang=${language}`, { scroll: false });
  };

  const openPost = (slug: string) => {
    router.push(`/modelblog/blog/${slug}?lang=${language}`);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <header className={`sticky top-0 z-30 border-b backdrop-blur ${
        isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <span
              className={`text-xl font-bold tracking-tight ${isDark ? "text-stone-100" : "text-stone-900"}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Model<span className="text-amber-500">Blog</span>
            </span>
            <span className={`ml-3 hidden text-xs uppercase tracking-widest sm:inline ${
              isDark ? "text-stone-600" : "text-stone-400"
            }`}>
              Architecture · BIM · Visualisation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
            <button
              onClick={() => setShowSidebar((value) => !value)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                isDark ? "border-stone-800 text-stone-500 hover:text-stone-200" : "border-stone-300 text-stone-500 hover:text-stone-800"
              }`}
            >
              Contributors
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className={`mb-8 rounded-lg border px-4 py-3 text-xs ${
          isDark ? "border-amber-900/50 bg-amber-950/30 text-amber-400/80" : "border-amber-300 bg-amber-50 text-amber-700"
        }`}>
          English is shown by default. Select another language and use Translate to view available translated posts.
        </div>

        <div className="mb-6">
          <LanguageTool
            language={language}
            onLanguageChange={setLanguage}
            onTranslate={applyLanguage}
            theme={theme}
          />
        </div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search articles, authors, topics…"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm placeholder-stone-500 focus:outline-none ${
              isDark
                ? "border-stone-800 bg-stone-900 text-stone-200 focus:border-amber-700"
                : "border-stone-300 bg-white text-stone-800 focus:border-amber-500"
            }`}
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-xl px-3 py-2 text-xs font-medium ${
                  selectedCategory === category
                    ? "bg-amber-600 text-amber-100"
                    : isDark
                      ? "bg-stone-900 text-stone-500 hover:text-stone-200"
                      : "bg-white text-stone-500 shadow-sm hover:text-stone-900"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid gap-8 ${showSidebar ? "lg:grid-cols-[1fr_300px]" : ""}`}>
          <main>
            {showFeatured && (
              <section className="mb-10">
                <h2 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${isDark ? "text-stone-500" : "text-stone-400"}`}>
                  Featured
                </h2>

                <div className="grid gap-5 md:grid-cols-3">
                  {featured.map((post, index) => (
                    <FeaturedCard
                      key={post.id}
                      post={post}
                      index={index}
                      theme={theme}
                      language={language}
                      onClick={() => openPost(post.slug)}
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
                <div className={`rounded-xl border p-8 text-center text-sm ${
                  isDark ? "border-stone-800 bg-stone-950 text-stone-500" : "border-stone-200 bg-white text-stone-500"
                }`}>
                  No articles found in this language.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {nonFeatured.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      theme={theme}
                      language={language}
                      onClick={() => openPost(post.slug)}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>

          {showSidebar && <AuthorsSidebar theme={theme} />}
        </div>
      </div>
    </div>
  );
}