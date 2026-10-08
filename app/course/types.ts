export interface Subtitle {
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

/* ---------- Rich text content model ---------- */

export type InlineRun =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "highlight"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
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
      source?: string;
      width?: number;
      height?: number;
    }
  | { type: "divider" };

export type CitationStyle = "apa" | "mla";

export interface Reference {
  id: string;
  style?: CitationStyle;
  text: string;
  url?: string;
}

/* ---------- Course preface ---------- */

export interface PrefaceSection {
  id: string;
  heading: string;
  blocks: ContentBlock[];
}

export interface CoursePreface {
  /** Small label above the title, e.g. "Preface" */
  eyebrow?: string;
  title: string;
  /** Short lead-in paragraph rendered under the title */
  intro: string;
  sections: PrefaceSection[];
  references?: Reference[];
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
  content?: ContentBlock[];
  references?: Reference[];
  order: number;
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
  /** Optional preface shown at the top of the course detail page */
  preface?: CoursePreface;
  modules: Module[];
}