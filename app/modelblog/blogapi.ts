//modelblog/blogapi.ts

export type LanguageCode = "en" | "ml" | "hi" | "ta";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

// Compile-time fallback only — runtime language list comes from apiFetchLanguages()
export const LANGUAGE_FALLBACK: LanguageOption[] = [
  { code: "en", label: "English",   nativeLabel: "English" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "hi", label: "Hindi",     nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil",     nativeLabel: "தமிழ்"  },
];

export type AuthorRole = "Editorial" | "Eminent" | "Guest" | "Staff";

export interface Author {
  id: string;
  name: string;
  role: AuthorRole;
  title: string;
  avatarInitials: string;
  avatarColor: string;
  bio: string;
}

export interface Source {
  label: string;
  url: string;
  publisher: string;
  year?: number;
}

export interface BlogImage {
  id: string;
  src: string;
  orientation: "landscape" | "portrait";
  alt: Partial<Record<LanguageCode, string>> & { en: string };
  caption: Partial<Record<LanguageCode, string>> & { en: string };
  reference: Partial<Record<LanguageCode, string>> & { en: string };
}

export interface InlineRef {
  marker: number;
  sourceLabel: string;
  url: string;
}

export interface BlogParagraph {
  order: number;
  type: "text" | "pullquote" | "callout";
  text: string;
  inlineRefs: InlineRef[];
}

export interface BlogSubheading {
  id: string;
  title: string;
  paragraphs: BlogParagraph[];
  imageIds?: string[];
}

export interface BlogSection {
  id: string;
  title: string;
  paragraphs: BlogParagraph[];
  imageIds?: string[];
  subheadings?: BlogSubheading[];
}

export interface BlogTranslation {
  language: LanguageCode;
  title: string;
  subtitle: string;
  excerpt: string;
  sections: BlogSection[];
  sources?: Source[];
}

export interface BlogPost {
  id: number;
  slug: string;
  category: string;
  tags: string[];
  readingTimeMinutes: number;
  publishedAt: string;
  featured: boolean;
  coverAccent: string;
  coverImageId: string;
  authors: Author[];
  images: BlogImage[];
  // All translation keys are optional — guard at every usage site
  translations: Partial<Record<LanguageCode, BlogTranslation>>;
  sources: Source[];
}

export interface AdUnit {
  id: string;
  company: string;
  tagline: string;
  url: string;
  accentColor: string;
  category: string;
  logoInitials: string;
}

// ---------------------------------------------------------------------------
// API base URL
// ---------------------------------------------------------------------------

const BLOG_API = `${(
  process.env.NEXT_PUBLIC_HOST ?? ""
).replace(/\/$/, "")}/api/modelblog`;

// ---------------------------------------------------------------------------
// Fetch helpers — all throw on non-ok responses
// ---------------------------------------------------------------------------

export async function apiFetchLanguages(): Promise<LanguageOption[]> {
  const res = await fetch(`${BLOG_API}/languages/`);
  if (!res.ok) throw new Error(`Languages fetch failed: ${res.status}`);
  const langs = (await res.json()) as LanguageOption[];
  return [
    ...langs.filter((l) => l.code === "en"),
    ...langs.filter((l) => l.code !== "en"),
  ];
}

export async function apiFetchPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${BLOG_API}/posts/`);
  if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`);
  return res.json() as Promise<BlogPost[]>;
}

export async function apiFetchPostDetail(slug: string): Promise<BlogPost> {
  const res = await fetch(`${BLOG_API}/posts/${slug}/`);
  if (!res.ok) throw new Error(`Post detail fetch failed: ${res.status}`);
  return res.json() as Promise<BlogPost>;
}

export async function apiFetchAuthors(): Promise<Record<string, Author>> {
  const res = await fetch(`${BLOG_API}/authors/`);
  if (!res.ok) throw new Error(`Authors fetch failed: ${res.status}`);
  return res.json() as Promise<Record<string, Author>>;
}

export async function apiFetchAds(): Promise<AdUnit[]> {
  const res = await fetch(`${BLOG_API}/ads/`);
  if (!res.ok) throw new Error(`Ads fetch failed: ${res.status}`);
  return res.json() as Promise<AdUnit[]>;
}

export async function apiFetchCategories(): Promise<string[]> {
  const res = await fetch(`${BLOG_API}/categories/`);
  if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`);
  return res.json() as Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns the translation for the requested language, falling back to English,
 * then to whichever translation exists first.
 * Returns undefined only when the post has no translations at all.
 */
export function getTranslation(
  post: BlogPost,
  language: LanguageCode,
): BlogTranslation | undefined {
  return (
    post.translations[language] ??
    post.translations["en"] ??
    Object.values(post.translations)[0]
  );
}

/** Languages for which this post actually has a translation, English first. */
export function getAvailableLanguages(post: BlogPost): LanguageOption[] {
  const codes = Object.keys(post.translations) as LanguageCode[];
  const sorted: LanguageCode[] = [
    ...codes.filter((c) => c === "en"),
    ...codes.filter((c) => c !== "en").sort(),
  ];
  return sorted
    .map((code) => LANGUAGE_FALLBACK.find((l) => l.code === code))
    .filter((l): l is LanguageOption => l !== undefined);
}

export function getImageById(
  post: BlogPost,
  imageId: string,
): BlogImage | undefined {
  return post.images.find((img) => img.id === imageId);
}

export function getCoverImage(post: BlogPost): BlogImage | undefined {
  if (!post.coverImageId) return undefined;
  return getImageById(post, post.coverImageId);
}

export function getAdsForPost(post: BlogPost, allAds: AdUnit[]): AdUnit[] {
  const relevant = allAds.filter((ad) => ad.category === post.category);
  const fallback  = allAds.filter((ad) => ad.category === "All");
  return [...relevant, ...fallback].slice(0, 3);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}