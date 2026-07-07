export interface Subtitle {
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

export interface Chapter {
  id: number;
  slug: string;
  title: string;
  description: string;
  video?: string;
  poster?: string;
  subtitles?: Subtitle[];
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