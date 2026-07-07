export interface Subtitle {
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

/* ---------- Rich text content model ---------- */

/**
 * A single inline run of text within a paragraph, list item, or callout.
 * Keeping this as a flat union (rather than nested marks) keeps the
 * renderer simple and keeps content authoring straightforward in mock data
 * or a future CMS/admin form.
 */
export type InlineRun =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "highlight"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  /** Superscript citation marker, e.g. renders as a linked [3] */
  | { type: "ref"; refId: string };

export type ContentBlock =
  | { type: "heading"; level: 2 | 3; text: string; id?: string }
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "list"; ordered?: boolean; items: InlineRun[][] }
  | {
      type: "callout";
      variant?: "note" | "warning" | "tip";
      title?: string;
      runs: InlineRun[];
    }
  | {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
      /** Attribution / source line shown under the caption, e.g. "Photo: Jane Doe / Unsplash" */
      source?: string;
      width?: number;
      height?: number;
    }
  | { type: "divider" };

export type CitationStyle = "apa" | "mla";

export interface Reference {
  /** Stable id referenced by InlineRun of type "ref" (refId) */
  id: string;
  style?: CitationStyle;
  /** Fully formatted citation text, e.g. "BuildingSMART International. (2023). IFC4.3 Documentation." */
  text: string;
  url?: string;
}

/* ---------- Course structure ---------- */

export interface Chapter {
  id: number;
  slug: string;
  title: string;
  description: string;
  video?: string;
  poster?: string;
  subtitles?: Subtitle[];
  /** Rich text/notes body for the lesson. Independent of video — a chapter can have either, both, or neither. */
  content?: ContentBlock[];
  references?: Reference[];
  order: number; // global order within the course, used for prev/next
  completed?: boolean;
}

export interface Module {
  id: number;
  slug: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  modules: Module[];
}