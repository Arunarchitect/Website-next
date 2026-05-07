export type LanguageCode = "en" | "ml" | "hi" | "ta";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
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

export interface BlogSubheading {
  id: string;
  title: string;
  paragraphs: string[];
  imageIds?: string[];
}

export interface BlogSection {
  id: string;
  title: string;
  paragraphs: string[];
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
  translations: Partial<Record<LanguageCode, BlogTranslation>> & {
    en: BlogTranslation;
  };
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

export const AUTHORS: Record<string, Author> = {
  dana_osei: {
    id: "dana_osei",
    name: "Dana Osei",
    role: "Staff",
    title: "Research Editor — Technology & Fabrication",
    avatarInitials: "DO",
    avatarColor: "#4338ca",
    bio: "Dana covers Blender, Bonsai BIM, and open-source architecture workflows.",
  },
  mira_bello: {
    id: "mira_bello",
    name: "Mira Bello",
    role: "Guest",
    title: "Associate Professor of Digital Architecture",
    avatarInitials: "MB",
    avatarColor: "#065f46",
    bio: "Mira researches IFC standards, open BIM, and computational design education.",
  },
};

export const AD_UNITS: AdUnit[] = [
  {
    id: "ad_bonsai",
    company: "Bonsai BIM",
    tagline: "IFC-native BIM authoring inside Blender.",
    url: "#",
    accentColor: "#166534",
    category: "BIM & Software",
    logoInitials: "BB",
  },
  {
    id: "ad_render",
    company: "RenderLab Studio",
    tagline: "Architectural renders, interiors, walkthroughs, and presentation visuals.",
    url: "#",
    accentColor: "#1e3a5f",
    category: "Visualisation",
    logoInitials: "RL",
  },
  {
    id: "ad_default",
    company: "ModelBlog Partners",
    tagline: "Advertise your architecture, BIM, or design service here.",
    url: "#",
    accentColor: "#78350f",
    category: "All",
    logoInitials: "MB",
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    slug: "bonsai-bim-open-source-future",
    category: "BIM & Software",
    tags: ["Bonsai", "Blender", "IFC", "OpenBIM"],
    readingTimeMinutes: 7,
    publishedAt: "2026-05-06",
    featured: true,
    coverAccent: "linear-gradient(135deg, #166534 0%, #052e16 100%)",
    coverImageId: "studio-landscape",
    authors: [AUTHORS.dana_osei, AUTHORS.mira_bello],
    images: [
      {
        id: "studio-landscape",
        src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1400&auto=format&fit=crop",
        orientation: "landscape",
        alt: {
          en: "Architecture studio with models and drawings",
          ml: "മോഡലുകളും ഡ്രോയിംഗുകളും ഉള്ള ആർക്കിടെക്ചർ സ്റ്റുഡിയോ",
        },
        caption: {
          en: "Open BIM workflows connect design, documentation, visualisation, and data exchange.",
          ml: "OpenBIM workflow design, documentation, visualisation, data exchange എന്നിവയെ ബന്ധിപ്പിക്കുന്നു.",
        },
        reference: {
          en: "Image reference: Unsplash architectural studio photograph.",
          ml: "ചിത്ര റഫറൻസ്: Unsplash architectural studio photograph.",
        },
      },
      {
        id: "house-portrait",
        src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop",
        orientation: "portrait",
        alt: {
          en: "Modern residential building in a green setting",
          ml: "പച്ചപ്പിനിടയിലെ ആധുനിക വീട്",
        },
        caption: {
          en: "Portrait images can sit inside long-form articles without breaking reading rhythm.",
          ml: "Portrait images article reading flow തകർക്കാതെ ഇടയിൽ ഉപയോഗിക്കാം.",
        },
        reference: {
          en: "Image reference: Unsplash residential architecture photograph.",
          ml: "ചിത്ര റഫറൻസ്: Unsplash residential architecture photograph.",
        },
      },
    ],
    translations: {
      en: {
        language: "en",
        title: "Bonsai and the Open-Source BIM Revolution",
        subtitle: "Why IFC-native modelling can change how architects create and exchange building information.",
        excerpt:
          "Bonsai brings BIM authoring into Blender and treats IFC as the live project model, not as a final export.",
        sections: [
          {
            id: "introduction",
            title: "Introduction",
            paragraphs: [
              "BIM is often discussed as a software choice, but it is actually an information workflow.",
              "Bonsai is important because it places open data at the centre of that workflow.",
            ],
            imageIds: ["studio-landscape"],
          },
          {
            id: "ifc-native-authoring",
            title: "IFC-Native Authoring",
            paragraphs: [
              "In an IFC-native workflow, the building model is structured data from the beginning.",
            ],
            subheadings: [
              {
                id: "why-it-matters",
                title: "Why it matters",
                paragraphs: [
                  "This reduces translation loss and improves coordination between different tools.",
                ],
                imageIds: ["house-portrait"],
              },
            ],
          },
          {
            id: "conclusion",
            title: "Conclusion",
            paragraphs: [
              "Bonsai is not just another BIM tool. It represents more control over project information.",
            ],
          },
        ],
      },
      ml: {
        language: "ml",
        title: "Bonsaiയും Open-Source BIM വിപ്ലവവും",
        subtitle: "IFC-native modelling architects-ന്റെ workflow മാറ്റാൻ കഴിയുന്നതെങ്ങനെ.",
        excerpt:
          "Bonsai BIM authoring Blender-ലേക്ക് കൊണ്ടുവരുന്നു. IFC export file അല്ല, live project model ആണ്.",
        sections: [
          {
            id: "introduction",
            title: "ആമുഖം",
            paragraphs: [
              "BIM പലപ്പോഴും ഒരു software choice ആയി മാത്രം കാണപ്പെടുന്നു. പക്ഷേ അതിന്റെ ശരിയായ അർത്ഥം information workflow ആണ്.",
              "Bonsai പ്രധാനമാണ്, കാരണം അത് open data-യെ workflow-ന്റെ കേന്ദ്രത്തിൽ വയ്ക്കുന്നു.",
            ],
            imageIds: ["studio-landscape"],
          },
          {
            id: "ifc-native-authoring",
            title: "IFC-Native Authoring",
            paragraphs: [
              "IFC-native workflow-ൽ building model ആദ്യം മുതൽ തന്നെ structured data ആയി നിലനിൽക്കും.",
            ],
            subheadings: [
              {
                id: "why-it-matters",
                title: "ഇത് പ്രധാനമാകുന്നത് എന്തുകൊണ്ട്",
                paragraphs: [
                  "ഇത് translation loss കുറയ്ക്കുകയും വ്യത്യസ്ത tools തമ്മിലുള്ള coordination മെച്ചപ്പെടുത്തുകയും ചെയ്യും.",
                ],
                imageIds: ["house-portrait"],
              },
            ],
          },
          {
            id: "conclusion",
            title: "സമാപനം",
            paragraphs: [
              "Bonsai മറ്റൊരു BIM tool മാത്രമല്ല. Project information-ൽ architects-ന് കൂടുതൽ control നൽകുന്ന workflow ആണ്.",
            ],
          },
        ],
      },
    },
    sources: [
      {
        label: "Bonsai BIM Documentation",
        url: "https://bonsaibim.org/",
        publisher: "Bonsai BIM",
      },
      {
        label: "buildingSMART IFC Documentation",
        url: "https://technical.buildingsmart.org/",
        publisher: "buildingSMART International",
      },
    ],
  },
];

export const CATEGORIES = [
  "All",
  ...Array.from(new Set(BLOG_POSTS.map((post) => post.category))),
];

export function getLanguageOption(code: LanguageCode): LanguageOption {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

export function getAvailableLanguages(post: BlogPost): LanguageOption[] {
  return LANGUAGES.filter((language) => Boolean(post.translations[language.code]));
}

export function getOtherAvailableLanguages(post: BlogPost): LanguageOption[] {
  return getAvailableLanguages(post).filter((language) => language.code !== "en");
}

export function getTranslation(post: BlogPost, language: LanguageCode): BlogTranslation {
  return post.translations[language] ?? post.translations.en;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getFeaturedPosts(language: LanguageCode): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.featured && Boolean(post.translations[language]));
}

export function getImageById(post: BlogPost, imageId: string): BlogImage | undefined {
  return post.images.find((image) => image.id === imageId);
}

export function getCoverImage(post: BlogPost): BlogImage | undefined {
  return getImageById(post, post.coverImageId);
}

export function getAdsForPost(post: BlogPost): AdUnit[] {
  const relevant = AD_UNITS.filter((ad) => ad.category === post.category);
  const fallback = AD_UNITS.filter((ad) => ad.category === "All");
  return [...relevant, ...fallback].slice(0, 3);
}

export function getBottomAds(): AdUnit[] {
  return AD_UNITS.slice(0, 3);
}

export function searchPosts(
  query: string,
  category: string,
  language: LanguageCode,
): BlogPost[] {
  const normalizedQuery = query.trim().toLowerCase();

  return BLOG_POSTS.filter((post) => {
    const translation = post.translations[language];
    if (!translation) return false;

    const matchesCategory = category === "All" || post.category === category;

    const matchesQuery =
      !normalizedQuery ||
      translation.title.toLowerCase().includes(normalizedQuery) ||
      translation.subtitle.toLowerCase().includes(normalizedQuery) ||
      translation.excerpt.toLowerCase().includes(normalizedQuery) ||
      post.category.toLowerCase().includes(normalizedQuery) ||
      post.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
      post.authors.some((author) =>
        author.name.toLowerCase().includes(normalizedQuery),
      );

    return matchesCategory && matchesQuery;
  });
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}