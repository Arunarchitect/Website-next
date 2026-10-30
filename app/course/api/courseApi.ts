import type { Course, Chapter, Module } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API_BASE}/api/opencourse`;

export type ChapterDetail = Chapter & {
  module: { id: number; slug: string; title: string; order: number };
};

async function get<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`opencourse API ${res.status} on ${path}`);
  return res.json();
}

export async function getCourses(): Promise<Course[]> {
  return (await get<Course[]>("/courses/")) ?? [];
}

export async function getCourseBySlug(slug: string): Promise<Course | undefined> {
  return get<Course>(`/courses/${slug}/`);
}

/** Full chapter incl. content + references (the outline in Course has neither). */
export async function getChapterContent(
  courseSlug: string,
  chapterSlug: string
): Promise<ChapterDetail | undefined> {
  return get<ChapterDetail>(`/courses/${courseSlug}/chapters/${chapterSlug}/`);
}

/* ---------- pure helpers (work on the outline) ---------- */

export function getAllChapters(course: Course): Chapter[] {
  return [...course.modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) => m.chapters)
    .sort((a, b) => a.order - b.order);
}

export function getChapterBySlug(
  course: Course,
  chapterSlug: string
): { chapter: Chapter; courseModule: Module } | undefined {
  for (const courseModule of course.modules) {
    const chapter = courseModule.chapters.find((ch) => ch.slug === chapterSlug);
    if (chapter) return { chapter, courseModule };
  }
  return undefined;
}

export function getAdjacentChapters(course: Course, currentChapter: Chapter) {
  const sorted = getAllChapters(course);
  const idx = sorted.findIndex((ch) => ch.id === currentChapter.id);
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

export function totalChapterCount(course: Course): number {
  return course.modules.reduce((sum, m) => sum + m.chapters.length, 0);
}