export type TermBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "note"; text: string }
  | { type: "image"; imageId: string };

export interface TermImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  orientation?: "landscape" | "portrait";
}

export interface TermSection {
  id: string;
  title: string;
  blocks: TermBlock[];
  subheadings?: TermSection[];
}

export interface TermDocument {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  updatedAt: string;
  accent: string;
  images?: TermImage[];
  sections: TermSection[];
}

export const TERM_DOCUMENTS: TermDocument[] = [
  {
  slug: "privacy",
  title: "Privacy Policy",
  subtitle:
    "How Model Flick collects, stores, and uses information while respecting user privacy.",
  category: "Legal",
  updatedAt: "2026-05-08",
  accent: "linear-gradient(135deg, #0f766e 0%, #042f2e 100%)",
  images: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      blocks: [
        {
          type: "paragraph",
          text:
            "Model Flick values user privacy and aims to collect only the minimum information required for the proper functioning of the website, services, educational content, calculators, and communication systems.",
        },
        {
          type: "note",
          text:
            "We do not intentionally sell personal user information to third parties.",
        },
      ],
    },

    {
      id: "information-collected",
      title: "Information We Collect",
      blocks: [
        {
          type: "bullets",
          items: [
            "Basic contact details submitted through forms or enquiries.",
            "Project or consultation details voluntarily submitted by users.",
            "Donation or payment confirmation details.",
            "Basic analytics data such as browser type, pages visited, and approximate device information.",
          ],
        },
      ],
    },

    {
      id: "how-data-is-used",
      title: "How Information is Used",
      blocks: [
        {
          type: "numbered",
          items: [
            "To improve website tools and educational resources.",
            "To respond to user enquiries or service requests.",
            "To maintain technical stability and website security.",
            "To understand website usage and improve user experience.",
          ],
        },
      ],
    },

    {
      id: "third-party-services",
      title: "Third Party Services",
      blocks: [
        {
          type: "paragraph",
          text:
            "The website may use third-party services such as analytics providers, payment gateways, embedded media services, hosting providers, or advertisement platforms. These services may collect information according to their own policies.",
        },
      ],
    },

    {
      id: "policy-updates",
      title: "Policy Updates",
      blocks: [
        {
          type: "paragraph",
          text:
            "This privacy policy may be updated periodically to reflect technical, operational, or legal changes.",
        },
      ],
    },
  ],
},
  {
  slug: "ad-policy",
  title: "Advertisement Policy",
  subtitle:
    "Why advertisements exist on this platform and our long-term intention regarding them.",
  category: "Policy",
  updatedAt: "2026-05-08",
  accent: "linear-gradient(135deg, #92400e 0%, #451a03 100%)",
  images: [],
  sections: [
    {
      id: "our-position",
      title: "Our Position on Advertisements",
      blocks: [
        {
          type: "paragraph",
          text:
            "Model Flick does not prefer excessive advertisements or aggressive tracking-based monetisation systems. The long-term intention is to maintain a cleaner and less intrusive educational platform.",
        },
        {
          type: "note",
          text:
            "Advertisements are currently used mainly to support hosting, development, infrastructure, and operational expenses.",
        },
      ],
    },

    {
      id: "why-ads-exist",
      title: "Why Ads Currently Exist",
      blocks: [
        {
          type: "paragraph",
          text:
            "As the platform currently receives limited public donations and independent support, advertisements help sustain website maintenance, server expenses, content creation, development time, and educational tools.",
        },
      ],
    },

    {
      id: "future-goal",
      title: "Future Goal",
      blocks: [
        {
          type: "paragraph",
          text:
            "If sustainable donations, sponsorships, educational revenue, or community support become sufficient for maintenance, the intention is to significantly reduce or completely remove advertisements from the platform.",
        },
      ],
    },

    {
      id: "ethical-advertising",
      title: "Advertising Principles",
      blocks: [
        {
          type: "bullets",
          items: [
            "Avoid highly intrusive advertisements whenever possible.",
            "Avoid misleading or deceptive promotions.",
            "Prefer educational, architectural, technical, and constructive sponsorships.",
            "Maintain separation between editorial content and sponsored content.",
          ],
        },
      ],
    },
  ],
},
{
  slug: "opensource-policy",
  title: "Open Source Support Policy",
  subtitle:
    "Our position regarding open-source ecosystems, software freedom, and donation allocation.",
  category: "Open Source",
  updatedAt: "2026-05-08",
  accent: "linear-gradient(135deg, #166534 0%, #052e16 100%)",
  images: [],
  sections: [
    {
      id: "our-position",
      title: "Our Position",
      blocks: [
        {
          type: "paragraph",
          text:
            "Model Flick strongly supports the open-source ecosystem, open standards, collaborative development, and knowledge accessibility. Much of the platform's workflow, learning resources, and technical direction are built around open technologies.",
        },
      ],
    },

    {
      id: "opensource-donations",
      title: "Open Source Donations",
      blocks: [
        {
          type: "paragraph",
          text:
            "When users specifically donate towards open-source software support, the contribution will be allocated according to the following distribution model.",
        },

        {
          type: "numbered",
          items: [
            "75% of the contribution will be directed towards supporting open-source software, developers, projects, or ecosystems.",
            "25% will be used for Model Flick operational and maintenance expenses associated with maintaining educational resources and infrastructure.",
          ],
        },

        {
          type: "note",
          text:
            "The exact supported projects or ecosystems may vary depending on ongoing requirements, relevance, and operational practicality.",
        },
      ],
    },

    {
      id: "content-donations",
      title: "Content Support Donations",
      blocks: [
        {
          type: "paragraph",
          text:
            "Donations specifically intended for Model Flick content, tutorials, educational resources, website maintenance, videos, or platform development will be fully used by Model Flick for its own operational and creative activities.",
        },
      ],
    },

    {
      id: "open-standards",
      title: "Support for Open Standards",
      blocks: [
        {
          type: "bullets",
          items: [
            "OpenBIM and IFC workflows.",
            "Open educational resources.",
            "Interoperable and non-proprietary data systems.",
            "Community-driven software ecosystems.",
          ],
        },
      ],
    },
  ],
},
];

export function getTermBySlug(slug: string): TermDocument | undefined {
  return TERM_DOCUMENTS.find((item) => item.slug === slug);
}

export function getTermImageById(
  document: TermDocument,
  imageId: string,
): TermImage | undefined {
  return document.images?.find((image) => image.id === imageId);
}

export function formatTermDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}