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
  alt: string;
  orientation: "landscape" | "portrait";
  caption: string;
  reference: string;
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

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  tags: string[];
  excerpt: string;
  readingTimeMinutes: number;
  publishedAt: string;
  featured: boolean;
  coverAccent: string;
  coverImageId: string;
  authors: Author[];
  images: BlogImage[];
  sections: BlogSection[];
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
  yusuf_camara: {
    id: "yusuf_camara",
    name: "Yusuf Camara",
    role: "Editorial",
    title: "Architecture Critic & Senior Editor",
    avatarInitials: "YC",
    avatarColor: "#0e7490",
    bio: "Yusuf writes on visualisation, cities, design culture, and digital practice.",
  },
};

export const AD_UNITS: AdUnit[] = [
  {
    id: "ad_bonsai",
    company: "Bonsai BIM",
    tagline: "IFC-native BIM authoring inside Blender. Free, open-source, and built for OpenBIM.",
    url: "#",
    accentColor: "#166534",
    category: "BIM & Software",
    logoInitials: "BB",
  },
  {
    id: "ad_archviz",
    company: "RenderLab Studio",
    tagline: "Photorealistic architectural visuals for homes, interiors, and urban proposals.",
    url: "#",
    accentColor: "#1e3a5f",
    category: "Visualisation",
    logoInitials: "RL",
  },
  {
    id: "ad_default",
    company: "ModelBlog Partners",
    tagline: "Reach architects, BIM managers, designers, and computational practitioners.",
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
    title: "Bonsai and the Open-Source BIM Revolution",
    subtitle: "Why IFC-native modelling can change how architects create and exchange building information.",
    category: "BIM & Software",
    tags: ["Bonsai", "Blender", "IFC", "OpenBIM"],
    excerpt:
      "Bonsai brings BIM authoring into Blender and treats IFC as the live project model, not as a final export.",
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
        alt: "Architecture studio with models and drawings",
        orientation: "landscape",
        caption: "Open BIM workflows connect design, documentation, visualisation, and data exchange.",
        reference: "Image reference: Unsplash architectural studio photograph.",
      },
      {
        id: "house-portrait",
        src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop",
        alt: "Modern residential building in a green setting",
        orientation: "portrait",
        caption: "Portrait images can be used inside articles without disturbing long-form reading.",
        reference: "Image reference: Unsplash residential architecture photograph.",
      },
      {
        id: "drawing-landscape",
        src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1400&auto=format&fit=crop",
        alt: "Architectural drawings and tools",
        orientation: "landscape",
        caption: "Landscape images work well as full-width visual breaks between article sections.",
        reference: "Image reference: Unsplash architectural drawing photograph.",
      },
    ],
    sections: [
      {
        id: "introduction",
        title: "Introduction",
        paragraphs: [
          "BIM is often discussed as a software choice, but it is actually an information workflow. Bonsai is important because it places open data at the centre of that workflow.",
          "Instead of creating a proprietary model and exporting IFC later, Bonsai works directly with IFC as the project file.",
        ],
        imageIds: ["studio-landscape"],
      },
      {
        id: "ifc-native-authoring",
        title: "IFC-Native Authoring",
        paragraphs: [
          "In an IFC-native workflow, the building model is structured data from the beginning. Walls, slabs, spaces, materials, and quantities can be authored as IFC entities directly.",
        ],
        subheadings: [
          {
            id: "why-it-matters",
            title: "Why it matters",
            paragraphs: [
              "This reduces translation loss and improves coordination between tools. The model becomes easier to inspect, validate, and archive.",
            ],
            imageIds: ["house-portrait"],
          },
          {
            id: "small-practice-advantage",
            title: "Small practice advantage",
            paragraphs: [
              "For small architectural offices, open-source BIM reduces dependency on expensive software ecosystems while keeping professional data standards available.",
            ],
          },
        ],
      },
      {
        id: "visualisation-and-documentation",
        title: "Visualisation and Documentation",
        paragraphs: [
          "Because Bonsai works inside Blender, the same environment can support modelling, drawing generation, material study, and presentation visuals.",
        ],
        imageIds: ["drawing-landscape"],
      },
      {
        id: "conclusion",
        title: "Conclusion",
        paragraphs: [
          "Bonsai is not only another BIM tool. It represents a different way of thinking about ownership, interoperability, and professional freedom in architectural production.",
        ],
      },
    ],
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
  {
    id: 2,
    slug: "blender-architectural-visualisation-pipeline",
    title: "Blender as an Architectural Visualisation Tool",
    subtitle: "How Blender supports modelling, rendering, and presentation in one open-source environment.",
    category: "Visualisation",
    tags: ["Blender", "Rendering", "Architecture", "Visualisation"],
    excerpt:
      "Blender is now a serious option for architectural visualisation, especially for small studios and independent designers.",
    readingTimeMinutes: 5,
    publishedAt: "2026-04-28",
    featured: true,
    coverAccent: "linear-gradient(135deg, #1e3a5f 0%, #0c1a2e 100%)",
    coverImageId: "render-landscape",
    authors: [AUTHORS.yusuf_camara, AUTHORS.dana_osei],
    images: [
      {
        id: "render-landscape",
        src: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1400&auto=format&fit=crop",
        alt: "Modern architecture exterior",
        orientation: "landscape",
        caption: "Architectural visualisation depends on light, material, camera framing, and atmosphere.",
        reference: "Image reference: Unsplash modern architecture photograph.",
      },
      {
        id: "interior-portrait",
        src: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?q=80&w=900&auto=format&fit=crop",
        alt: "Interior space with warm lighting",
        orientation: "portrait",
        caption: "Portrait images are useful for interiors, furniture, and vertical compositions.",
        reference: "Image reference: Unsplash interior photograph.",
      },
    ],
    sections: [
      {
        id: "introduction",
        title: "Introduction",
        paragraphs: [
          "Architectural visualisation is no longer limited to expensive proprietary render pipelines. Blender gives designers a flexible environment for modelling and rendering.",
        ],
        imageIds: ["render-landscape"],
      },
      {
        id: "why-blender",
        title: "Why Blender Works",
        paragraphs: [
          "Blender combines modelling, materials, lighting, animation, and rendering in one application. This makes iteration faster and reduces file conversion problems.",
        ],
        subheadings: [
          {
            id: "cycles-and-eevee",
            title: "Cycles and EEVEE",
            paragraphs: [
              "Cycles is useful for realistic final renders, while EEVEE supports quick real-time previews and presentation workflows.",
            ],
            imageIds: ["interior-portrait"],
          },
        ],
      },
      {
        id: "conclusion",
        title: "Conclusion",
        paragraphs: [
          "For architectural studios, Blender is not just a visualisation tool. It can become part of a broader open-source design workflow.",
        ],
      },
    ],
    sources: [
      {
        label: "Blender Documentation",
        url: "https://docs.blender.org/",
        publisher: "Blender Foundation",
      },
    ],
  },
];

export const CATEGORIES = [
  "All",
  ...Array.from(new Set(BLOG_POSTS.map((post) => post.category))),
];

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.featured);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
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

export function searchPosts(query: string, category: string): BlogPost[] {
  const normalizedQuery = query.trim().toLowerCase();

  return BLOG_POSTS.filter((post) => {
    const matchesCategory = category === "All" || post.category === category;
    const matchesQuery =
      !normalizedQuery ||
      post.title.toLowerCase().includes(normalizedQuery) ||
      post.subtitle.toLowerCase().includes(normalizedQuery) ||
      post.excerpt.toLowerCase().includes(normalizedQuery) ||
      post.category.toLowerCase().includes(normalizedQuery) ||
      post.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
      post.authors.some((author) => author.name.toLowerCase().includes(normalizedQuery));

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