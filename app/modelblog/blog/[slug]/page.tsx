"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LANGUAGES,
  formatDate,
  getAdsForPost,
  getBottomAds,
  getAvailableLanguages,
  getCoverImage,
  getImageById,
  getPostBySlug,
  getTranslation,
  type AdUnit,
  type Author,
  type AuthorRole,
  type BlogImage,
  type BlogPost,
  type LanguageCode,
} from "@/app/modelblog/blogapi";

type Theme = "dark" | "light";

interface PageProps {
  params: Promise<{ slug: string }>;
}

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

function AuthorPip({ author, size = "sm" }: { author: Author; size?: "sm" | "lg" }) {
  const dimension = size === "lg" ? "h-12 w-12 text-base" : "h-7 w-7 text-xs";

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

function LanguageSwitcher({
  post,
  language,
  theme,
  selectedLanguage,
  onSelectedLanguageChange,
  onTranslate,
}: {
  post: BlogPost;
  language: LanguageCode;
  theme: Theme;
  selectedLanguage: LanguageCode;
  onSelectedLanguageChange: (language: LanguageCode) => void;
  onTranslate: () => void;
}) {
  const isDark = theme === "dark";
  const availableCodes = getAvailableLanguages(post).map((item) => item.code);
  const otherLanguages = LANGUAGES.filter(
    (item) => item.code !== "en" && availableCodes.includes(item.code),
  );

  return (
    <div className={`rounded-xl border p-5 ${
      isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
    }`}>
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-widest ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>
        Language
      </p>

      <p className={`mb-3 text-xs ${isDark ? "text-stone-600" : "text-stone-500"}`}>
        Currently reading: {language === "en" ? "English" : LANGUAGES.find((item) => item.code === language)?.nativeLabel}
      </p>

      <div className="space-y-2">
        <button
          onClick={() => onSelectedLanguageChange("en")}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
            selectedLanguage === "en"
              ? "bg-amber-600 text-amber-100"
              : isDark
                ? "bg-stone-900 text-stone-400 hover:text-stone-100"
                : "bg-stone-50 text-stone-700 hover:text-stone-950"
          }`}
        >
          English
        </button>

        {otherLanguages.length > 0 && (
          <select
            value={selectedLanguage === "en" ? "" : selectedLanguage}
            onChange={(event) => onSelectedLanguageChange(event.target.value as LanguageCode)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
              isDark
                ? "border-stone-800 bg-stone-900 text-stone-300"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            <option value="">Other languages</option>
            {otherLanguages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.nativeLabel}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onTranslate}
          className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500"
        >
          {selectedLanguage === "en" ? "Read English" : "Translate"}
        </button>
      </div>
    </div>
  );
}

function ArticleImage({
  image,
  theme,
  language,
}: {
  image: BlogImage;
  theme: Theme;
  language: LanguageCode;
}) {
  const isDark = theme === "dark";
  const isPortrait = image.orientation === "portrait";

  return (
    <figure className={`my-9 ${isPortrait ? "mx-auto max-w-md" : "w-full"}`}>
      <div className={`overflow-hidden rounded-2xl border ${
        isDark ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white shadow-sm"
      }`}>
        <img
          src={image.src}
          alt={image.alt[language] ?? image.alt.en}
          className={`w-full object-cover ${isPortrait ? "aspect-[4/5]" : "aspect-[16/9]"}`}
        />
      </div>

      <figcaption className={`mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-6 ${
        isDark ? "text-stone-400" : "text-stone-600"
      }`}>
        <span className="block">{image.caption[language] ?? image.caption.en}</span>
        <span className={`block text-xs ${isDark ? "text-stone-600" : "text-stone-400"}`}>
          {image.reference[language] ?? image.reference.en}
        </span>
      </figcaption>
    </figure>
  );
}

function ArticleImages({
  post,
  imageIds,
  theme,
  language,
}: {
  post: BlogPost;
  imageIds?: string[];
  theme: Theme;
  language: LanguageCode;
}) {
  if (!imageIds || imageIds.length === 0) return null;

  return (
    <>
      {imageIds.map((imageId) => {
        const image = getImageById(post, imageId);
        return image ? <ArticleImage key={image.id} image={image} theme={theme} language={language} /> : null;
      })}
    </>
  );
}

function ArticleBody({ post, theme, language }: { post: BlogPost; theme: Theme; language: LanguageCode }) {
  const isDark = theme === "dark";
  const translation = getTranslation(post, language);

  return (
    <div>
      {translation.sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24">
          <h2
            className={`mt-12 text-2xl font-bold leading-tight ${isDark ? "text-stone-100" : "text-stone-900"}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {section.title}
          </h2>

          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={`mt-5 text-[1.0625rem] leading-8 ${isDark ? "text-stone-400" : "text-stone-700"}`}>
              {paragraph}
            </p>
          ))}

          <ArticleImages post={post} imageIds={section.imageIds} theme={theme} language={language} />

          {section.subheadings?.map((subheading) => (
            <section key={subheading.id} id={subheading.id} className="scroll-mt-24">
              <h3 className={`mt-9 text-xl font-semibold ${isDark ? "text-stone-200" : "text-stone-900"}`}>
                {subheading.title}
              </h3>

              {subheading.paragraphs.map((paragraph) => (
                <p key={paragraph} className={`mt-4 text-[1.0625rem] leading-8 ${isDark ? "text-stone-400" : "text-stone-700"}`}>
                  {paragraph}
                </p>
              ))}

              <ArticleImages post={post} imageIds={subheading.imageIds} theme={theme} language={language} />
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}

function HeadingSidebar({ post, theme, language }: { post: BlogPost; theme: Theme; language: LanguageCode }) {
  const isDark = theme === "dark";
  const translation = getTranslation(post, language);

  return (
    <div className={`rounded-xl border p-5 ${
      isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
    }`}>
      <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>
        In this article
      </p>

      <nav className="space-y-3">
        {translation.sections.map((section) => (
          <div key={section.id}>
            <a
              href={`#${section.id}`}
              className={`block text-sm font-medium ${
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
                    className={`block text-xs ${
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
          className={`block text-sm font-medium ${
            isDark ? "text-stone-400 hover:text-amber-300" : "text-stone-700 hover:text-amber-700"
          }`}
        >
          References
        </a>
      </nav>
    </div>
  );
}

function SourcesList({ post, theme, language }: { post: BlogPost; theme: Theme; language: LanguageCode }) {
  const isDark = theme === "dark";
  const translation = getTranslation(post, language);
  const sources = translation.sources ?? post.sources;

  return (
    <section id="references" className={`mt-12 border-t pt-6 ${isDark ? "border-stone-800" : "border-stone-200"}`}>
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
              className={`text-sm leading-snug ${
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
          <p className={`text-sm font-semibold ${isDark ? "text-stone-200" : "text-stone-800"}`}>
            {ad.company}
          </p>
          <p className={`mt-1 text-xs leading-snug ${isDark ? "text-stone-500" : "text-stone-500"}`}>
            {ad.tagline}
          </p>
        </div>
      </div>
    </a>
  );
}

function BottomAdStrip({ ads, theme }: { ads: AdUnit[]; theme: Theme }) {
  const isDark = theme === "dark";

  return (
    <section className={`mt-14 rounded-2xl border p-5 ${
      isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
    }`}>
      <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
        isDark ? "text-stone-500" : "text-stone-400"
      }`}>
        Sponsored
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {ads.map((ad) => (
          <AdCard key={ad.id} ad={ad} theme={theme} />
        ))}
      </div>
    </section>
  );
}

export default function BlogDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const langParam = searchParams.get("lang");
  const initialLanguage: LanguageCode = isLanguageCode(langParam) ? langParam : "en";

  const [theme, setTheme] = useState<Theme>("dark");
  const [language, setLanguage] = useState<LanguageCode>(initialLanguage);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(initialLanguage);

  const post = getPostBySlug(slug);

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }, []);

  useEffect(() => {
    if (!post) return;

    if (!post.translations[language]) {
      setLanguage("en");
      setSelectedLanguage("en");
    }
  }, [language, post]);

  const isDark = theme === "dark";
  const ads = useMemo(() => (post ? getAdsForPost(post) : []), [post]);
  const bottomAds = useMemo(() => getBottomAds(), []);

  if (!post) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center gap-4 ${
        isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"
      }`}>
        <p className="text-2xl font-bold">Article not found</p>
        <button
          onClick={() => router.push("/modelblog/blog")}
          className="text-sm text-amber-500 underline underline-offset-4"
        >
          ← Back to all articles
        </button>
      </div>
    );
  }

  const availableCodes = getAvailableLanguages(post).map((item) => item.code);
  const readableSelectedLanguage = availableCodes.includes(selectedLanguage)
    ? selectedLanguage
    : "en";

  const translation = getTranslation(post, language);
  const coverImage = getCoverImage(post);

  const applySelectedLanguage = () => {
    setLanguage(readableSelectedLanguage);
    router.replace(`/modelblog/blog/${post.slug}?lang=${readableSelectedLanguage}`, {
      scroll: false,
    });
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
      `}</style>

      <ReadingProgress theme={theme} />

      <header className={`sticky top-0 z-30 border-b backdrop-blur ${
        isDark ? "border-stone-900 bg-stone-950/90" : "border-stone-200 bg-stone-50/90"
      }`}>
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

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8 xl:grid-cols-[240px_minmax(0,760px)_280px]">
        <aside className="hidden space-y-4 xl:block">
          <LanguageSwitcher
            post={post}
            language={language}
            theme={theme}
            selectedLanguage={selectedLanguage}
            onSelectedLanguageChange={setSelectedLanguage}
            onTranslate={applySelectedLanguage}
          />
          <HeadingSidebar post={post} theme={theme} language={language} />
        </aside>

        <article className="min-w-0">
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
            {translation.title}
          </h1>

          <p className={`mb-8 text-lg leading-relaxed ${isDark ? "text-stone-400" : "text-stone-600"}`}>
            {translation.subtitle}
          </p>

          <div className="mb-8 xl:hidden">
            <LanguageSwitcher
              post={post}
              language={language}
              theme={theme}
              selectedLanguage={selectedLanguage}
              onSelectedLanguageChange={setSelectedLanguage}
              onTranslate={applySelectedLanguage}
            />
          </div>

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

            <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>
              {formatDate(post.publishedAt)}
            </span>

            <span className={`text-sm ${isDark ? "text-stone-500" : "text-stone-500"}`}>
              {post.readingTimeMinutes} min read
            </span>
          </div>

          {coverImage && <ArticleImage image={coverImage} theme={theme} language={language} />}

          <ArticleBody post={post} theme={theme} language={language} />

          <SourcesList post={post} theme={theme} language={language} />

          <section className="mt-10 space-y-3">
            {post.authors.map((author) => (
              <AuthorBioCard key={author.id} author={author} theme={theme} />
            ))}
          </section>

          <BottomAdStrip ads={bottomAds} theme={theme} />
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