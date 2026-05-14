// blogapi.ts
export type LanguageCode = "en" | "ml" | "hi" | "ta";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English",   nativeLabel: "English"   },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം"   },
  { code: "hi", label: "Hindi",     nativeLabel: "हिन्दी"   },
  { code: "ta", label: "Tamil",     nativeLabel: "தமிழ்"    },
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
  translations: Partial<Record<LanguageCode, BlogTranslation>> & { en: BlogTranslation };
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
// API helpers
// ---------------------------------------------------------------------------

const BLOG_API = `${(process.env.NEXT_PUBLIC_HOST ?? "").replace(/\/$/, "")}/api/modelblog`;

export async function apiFetchPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${BLOG_API}/posts/`);
  if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`);
  return res.json();
}

export async function apiFetchPostDetail(slug: string): Promise<BlogPost> {
  const res = await fetch(`${BLOG_API}/posts/${slug}/`);
  if (!res.ok) throw new Error(`Post detail fetch failed: ${res.status}`);
  return res.json();
}

export async function apiFetchAuthors(): Promise<Record<string, Author>> {
  const res = await fetch(`${BLOG_API}/authors/`);
  if (!res.ok) throw new Error(`Authors fetch failed: ${res.status}`);
  return res.json();
}

export async function apiFetchAds(): Promise<AdUnit[]> {
  const res = await fetch(`${BLOG_API}/ads/`);
  if (!res.ok) throw new Error(`Ads fetch failed: ${res.status}`);
  return res.json();
}

export async function apiFetchCategories(): Promise<string[]> {
  const res = await fetch(`${BLOG_API}/categories/`);
  if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Pure helpers (work on any BlogPost object — no static data dependency)
// ---------------------------------------------------------------------------

export function getLanguageOption(code: LanguageCode): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function getAvailableLanguages(post: BlogPost): LanguageOption[] {
  return LANGUAGES.filter((l) => Boolean(post.translations[l.code]));
}

export function getOtherAvailableLanguages(post: BlogPost): LanguageOption[] {
  return getAvailableLanguages(post).filter((l) => l.code !== "en");
}

export function getTranslation(post: BlogPost, language: LanguageCode): BlogTranslation {
  return post.translations[language] ?? post.translations.en;
}

export function getImageById(post: BlogPost, imageId: string): BlogImage | undefined {
  return post.images.find((img) => img.id === imageId);
}

export function getCoverImage(post: BlogPost): BlogImage | undefined {
  return getImageById(post, post.coverImageId);
}

export function getFeaturedPosts(posts: BlogPost[], language: LanguageCode): BlogPost[] {
  return posts.filter((p) => p.featured && Boolean(p.translations[language]));
}

export function getAdsForPost(post: BlogPost, allAds: AdUnit[]): AdUnit[] {
  const relevant = allAds.filter((ad) => ad.category === post.category);
  const fallback  = allAds.filter((ad) => ad.category === "All");
  return [...relevant, ...fallback].slice(0, 3);
}

export function searchPosts(
  posts: BlogPost[],
  query: string,
  category: string,
  language: LanguageCode,
): BlogPost[] {
  const q = query.trim().toLowerCase();
  return posts.filter((post) => {
    const t = post.translations[language];
    if (!t) return false;
    const matchCat   = category === "All" || post.category === category;
    const matchQuery =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.excerpt.toLowerCase().includes(q) ||
      post.category.toLowerCase().includes(q) ||
      post.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      post.authors.some((a) => a.name.toLowerCase().includes(q));
    return matchCat && matchQuery;
  });
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}