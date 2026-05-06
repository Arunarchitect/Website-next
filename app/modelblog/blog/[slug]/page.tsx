"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatDate,
  getAdsForPost,
  getCoverImage,
  getImageById,
  getPostBySlug,
  type AdUnit,
  type Author,
  type AuthorRole,
  type BlogImage,
  type BlogPost,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className={`relative h-7 w-14 rounded-full border transition-colors duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
        isDark ? "border-stone-700 bg-stone-900" : "border-sky-300 bg-sky-100"
      }`}
    >
      {isDark && (
        <>
          <span className="absolute left-1.5 top-1 h-0.5 w-0.5 rounded-full bg-stone-500 opacity-70" />
          <span className="absolute left-3 top-3 h-0.5 w-0.5 rounded-full bg-stone-500 opacity-50" />
          <span className="absolute left-5 top-1.5 h-0.5 w-0.5 rounded-full bg-stone-500 opacity-60" />
        </>
      )}

      {!isDark && <span className="absolute left-1.5 top-1.5 h-2 w-4 rounded-full bg-white opacity-80" />}

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

function AuthorPip({
  author,
  size = "sm",
}: {
  author: Author;
  size?: "sm" | "md" | "lg";
}) {
  const dimension =
    size === "lg" ? "h-12 w-12 text-base" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";

  return (
    <span
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
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

function AuthorBioCard({ author, theme }: { author: Author; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <div className={`flex items-start gap-4 rounded-xl border p-4 ${
      isDark ? "border-stone-800 bg-stone-900/50" : "border-stone-200 bg-stone-50"
    }`}>
      <AuthorPip author={author} size="lg" />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${isDark ? "text-stone-100" : "text-stone-900"}`}>
            {author.name}
          </span>
          <RoleBadge role={author.role} theme={theme} />
        </div>

        <p className={`mb-1 text-xs ${isDark ? "text-stone-400" : "text-stone-600"}`}>
          {author.title}
        </p>

        <p className={`text-xs leading-relaxed ${isDark ? "text-stone-500" : "text-stone-500"}`}>
          {author.bio}
        </p>
      </div>
    </div>
  );
}

function ReadingProgress({ theme }: { theme: Theme }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const element = document.documentElement;
      const total = element.scrollHeight - element.clientHeight;
      setProgress(total > 0 ? (element.scrollTop / total) * 100 : 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`fixed left-0 right-0 top-0 z-50 h-[3px] ${theme === "dark" ? "bg-stone-900" : "bg-stone-200"}`}>
      <div className="h-full bg-amber-500 transition-all duration-100" style={{ width: `${progress}%` }} />
    </div>
  );
}

function ArticleImage({ image, theme }: { image: BlogImage; theme: Theme }) {
  const isDark = theme === "dark";
  const isPortrait = image.orientation === "portrait";

  return (
    <figure className={`my-9 ${isPortrait ? "mx-auto max-w-md" : "w-full"}`}>
      <div className={`overflow-hidden rounded-2xl border ${
        isDark ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white shadow-sm"
      }`}>
        <img
          src={image.src}
          alt={image.alt}
          className={`w-full object-cover ${isPortrait ? "aspect-[4/5]" : "aspect-[16/9]"}`}
        />
      </div>

      <figcaption className={`mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-6 ${
        isDark ? "text-stone-400" : "text-stone-600"
      }`}>
        <span className="block">{image.caption}</span>
        <span className={`block text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>
          {image.reference}
        </span>
      </figcaption>
    </figure>
  );
}

function ArticleImages({
  post,
  imageIds,
  theme,
}: {
  post: BlogPost;
  imageIds?: string[];
  theme: Theme;
}) {
  if (!imageIds || imageIds.length === 0) return null;

  return (
    <>
      {imageIds.map((imageId) => {
        const image = getImageById(post, imageId);
        return image ? <ArticleImage key={image.id} image={image} theme={theme} /> : null;
      })}
    </>
  );
}

function ArticleBody({ post, theme }: { post: BlogPost; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <div>
      {post.sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24">
          <h2
            className={`mt-12 text-2xl font-bold leading-tight ${
              isDark ? "text-stone-100" : "text-stone-900"
            }`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {section.title}
          </h2>

          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={`mt-5 text-[1.0625rem] leading-8 ${
              isDark ? "text-stone-400" : "text-stone-700"
            }`}>
              {paragraph}
            </p>
          ))}

          <ArticleImages post={post} imageIds={section.imageIds} theme={theme} />

          {section.subheadings?.map((subheading) => (
            <section key={subheading.id} id={subheading.id} className="scroll-mt-24">
              <h3 className={`mt-9 text-xl font-semibold ${isDark ? "text-stone-200" : "text-stone-900"}`}>
                {subheading.title}
              </h3>

              {subheading.paragraphs.map((paragraph) => (
                <p key={paragraph} className={`mt-4 text-[1.0625rem] leading-8 ${
                  isDark ? "text-stone-400" : "text-stone-700"
                }`}>
                  {paragraph}
                </p>
              ))}

              <ArticleImages post={post} imageIds={subheading.imageIds} theme={theme} />
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}

function HeadingSidebar({ post, theme }: { post: BlogPost; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <aside className="hidden xl:block">
      <div className={`sticky top-20 rounded-xl border p-5 ${
        isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
      }`}>
        <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
          isDark ? "text-stone-500" : "text-stone-400"
        }`}>
          In this article
        </p>

        <nav className="space-y-3">
          {post.sections.map((section) => (
            <div key={section.id}>
              <a
                href={`#${section.id}`}
                className={`block text-sm font-medium transition-colors ${
                  isDark ? "text-stone-400 hover:text-amber-300" : "text-stone-700 hover:text-amber-700"
                }`}
              >
                {section.title}
              </a>

              {section.subheadings && section.subheadings.length > 0 && (
                <div className={`mt-2 space-y-2 border-l pl-3 ${
                  isDark ? "border-stone-800" : "border-stone-200"
                }`}>
                  {section.subheadings.map((subheading) => (
                    <a
                      key={subheading.id}
                      href={`#${subheading.id}`}
                      className={`block text-xs transition-colors ${
                        isDark ? "text-stone-600 hover:text-amber-300" : "text-stone-500 hover:text-amber-700"
                      }`}
                    >
                      {subheading.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          <a
            href="#references"
            className={`block text-sm font-medium transition-colors ${
              isDark ? "text-stone-400 hover:text-amber-300" : "text-stone-700 hover:text-amber-700"
            }`}
          >
            References
          </a>
        </nav>
      </div>
    </aside>
  );
}

function SourcesList({ sources, theme }: { sources: BlogPost["sources"]; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <section id="references" className={`mt-12 border-t pt-6 ${
      isDark ? "border-stone-800" : "border-stone-200"
    }`}>
      <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>
        References & Sources
      </p>

      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li key={source.label} className="flex items-baseline gap-3">
            <span className={`shrink-0 font-mono text-xs ${isDark ? "text-stone-700" : "text-stone-400"}`}>
              [{index + 1}]
            </span>

            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm leading-snug transition-colors ${
                isDark ? "text-stone-400 hover:text-amber-400" : "text-stone-600 hover:text-amber-700"
              }`}
            >
              {source.label}
              <span className={`ml-2 ${isDark ? "text-stone-600" : "text-stone-400"}`}>
                — {source.publisher}
                {source.year ? `, ${source.year}` : ""}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdCard({ ad, theme }: { ad: AdUnit; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <a
      href={ad.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group relative block overflow-hidden rounded-xl border p-5 transition-all duration-200 ${
        isDark
          ? "border-stone-800 bg-stone-950 hover:border-stone-600"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-400 hover:shadow-md"
      }`}
    >
      <div className="absolute left-0 right-0 top-0 h-[2px] opacity-60" style={{ background: ad.accentColor }} />

      <div className="mt-1 flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: ad.accentColor }}
        >
          {ad.logoInitials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`text-sm font-semibold transition-colors ${
              isDark ? "text-stone-200 group-hover:text-amber-300" : "text-stone-800 group-hover:text-amber-700"
            }`}>
              {ad.company}
            </span>

            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${
              isDark ? "bg-stone-800 text-stone-600" : "bg-stone-100 text-stone-400"
            }`}>
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

export default function BlogDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }, []);

  const post = getPostBySlug(slug);
  const isDark = theme === "dark";

  const ads = useMemo(() => (post ? getAdsForPost(post) : []), [post]);

  if (!post) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 ${
        isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"
      }`}>
        <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Article not found
        </p>

        <button
          onClick={() => router.push("/modelblog/blog")}
          className="text-sm text-amber-500 underline underline-offset-4 hover:text-amber-400"
        >
          ← Back to all articles
        </button>
      </div>
    );
  }

  const coverImage = getCoverImage(post);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      `}</style>

      <ReadingProgress theme={theme} />

      <header className={`sticky top-0 z-30 border-b backdrop-blur transition-colors duration-300 ${
        isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/modelblog/blog")}
              className={`flex shrink-0 items-center gap-1.5 text-sm transition-colors ${
                isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-400 hover:text-stone-800"
              }`}
            >
              ← <span className="hidden sm:inline">All Articles</span>
            </button>

            <span className={isDark ? "text-stone-800" : "text-stone-300"}>|</span>

            <span className={`truncate text-sm font-medium ${isDark ? "text-stone-400" : "text-stone-600"}`}>
              {post.title}
            </span>
          </div>

          <ThemeToggle theme={theme} onToggle={() => setTheme(isDark ? "light" : "dark")} />
        </div>
      </header>

      <div className="h-1 w-full" style={{ background: post.coverAccent }} />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8 xl:grid-cols-[240px_minmax(0,760px)_280px]">
        <HeadingSidebar post={post} theme={theme} />

        <article className="min-w-0">
          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => router.push("/modelblog/blog")}
              className={`text-xs transition-colors ${
                isDark ? "text-stone-600 hover:text-amber-400" : "text-stone-400 hover:text-amber-600"
              }`}
            >
              ModelBlog
            </button>

            <span className={`text-xs ${isDark ? "text-stone-800" : "text-stone-300"}`}>/</span>

            <span className={`text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>
              {post.category}
            </span>
          </div>

          <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
            isDark ? "text-stone-500" : "text-stone-400"
          }`}>
            {post.category}
          </p>

          <h1
            className={`mb-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl ${
              isDark ? "text-stone-50" : "text-stone-900"
            }`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {post.title}
          </h1>

          <p className={`mb-8 text-lg leading-relaxed ${isDark ? "text-stone-400" : "text-stone-600"}`}>
            {post.subtitle}
          </p>

          <div className={`mb-10 flex flex-wrap items-center gap-4 border-y py-4 ${
            isDark ? "border-stone-800" : "border-stone-200"
          }`}>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {post.authors.map((author) => (
                  <AuthorPip key={author.id} author={author} />
                ))}
              </div>

              <span className={`text-sm ${isDark ? "text-stone-400" : "text-stone-600"}`}>
                {post.authors.map((author) => author.name).join(" & ")}
              </span>
            </div>

            <span className={`text-sm ${isDark ? "text-stone-700" : "text-stone-300"}`}>·</span>
            <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>
              {formatDate(post.publishedAt)}
            </span>
            <span className={`text-sm ${isDark ? "text-stone-700" : "text-stone-300"}`}>·</span>
            <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>
              {post.readingTimeMinutes} min read
            </span>
          </div>

          {coverImage && <ArticleImage image={coverImage} theme={theme} />}

          <ArticleBody post={post} theme={theme} />

          <SourcesList sources={post.sources} theme={theme} />

          <section className="mt-10 space-y-3">
            {post.authors.map((author) => (
              <AuthorBioCard key={author.id} author={author} theme={theme} />
            ))}
          </section>
        </article>

        <aside className="space-y-4">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} theme={theme} />
          ))}
        </aside>
      </div>
    </div>
  );
}