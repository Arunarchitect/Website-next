import type { ContentBlock, CoursePreface, Reference, Subtitle } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_HOST;
const BASE = `${API_BASE}/api/opencourse/admin`;

/* ⚠ ADAPT: copy how your RTK Query baseQuery reads + sends the Djoser token */
const AUTH_SCHEME = "Bearer"; // or "JWT"
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

/* ---------- errors ---------- */

function flatten(body: unknown, path = ""): string[] {
  if (body == null) return [];
  if (typeof body === "string") return [path ? `${path}: ${body}` : body];
  if (Array.isArray(body)) {
    return body.flatMap((v, i) =>
      typeof v === "string" ? flatten(v, path) : flatten(v, `${path}[${i}]`)
    );
  }
  if (typeof body === "object") {
    return Object.entries(body as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, path ? `${path}.${k}` : k)
    );
  }
  return [String(body)];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, body: unknown) {
    const lines = flatten(body);
    super(lines.length ? lines.join("\n") : `Request failed (${status})`);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `${AUTH_SCHEME} ${token}` } : {}),
    },
  });
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/* ---------- editable model (ids optional, _key = stable React key) ---------- */

export const uid = () => Math.random().toString(36).slice(2, 10);

export interface AdminChapter {
  _key: string;
  id?: number;
  slug: string;
  title: string;
  description: string;
  video: string;
  poster: string;
  subtitles: Subtitle[];
  content: ContentBlock[];
  references: Reference[];
}
export interface AdminModule {
  _key: string;
  id?: number;
  slug: string;
  title: string;
  chapters: AdminChapter[];
}
export interface AdminCourse {
  _key: string;
  id?: number;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  is_published: boolean;
  preface: CoursePreface | null;
  modules: AdminModule[];
}
export interface AdminCourseRow {
  id: number;
  slug: string;
  title: string;
  is_published: boolean;
}

interface RawChapter {
  id: number;
  slug: string;
  title: string;
  description: string;
  video: string;
  poster: string;
  subtitles: Subtitle[];
  content: ContentBlock[];
  references: Reference[];
}
interface RawModule {
  id: number;
  slug: string;
  title: string;
  chapters: RawChapter[];
}
export interface RawCourse {
  id: number;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  is_published: boolean;
  preface: Partial<CoursePreface> | null;
  modules: RawModule[];
}

export const blankChapter = (): AdminChapter => ({
  _key: uid(), slug: "", title: "", description: "",
  video: "", poster: "", subtitles: [], content: [], references: [],
});
export const blankModule = (): AdminModule => ({
  _key: uid(), slug: "", title: "", chapters: [],
});
export const blankCourse = (): AdminCourse => ({
  _key: uid(), slug: "", title: "", description: "", thumbnail: "",
  is_published: false, preface: null, modules: [],
});

/** server tree -> editable tree. Reuses _keys from `prev` by position so selection survives a save. */
export function hydrateCourse(raw: RawCourse, prev?: AdminCourse | null): AdminCourse {
  const p = raw.preface && Object.keys(raw.preface).length ? raw.preface : null;
  return {
    _key: prev?._key ?? uid(),
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description ?? "",
    thumbnail: raw.thumbnail ?? "",
    is_published: raw.is_published,
    preface: p
      ? {
          eyebrow: p.eyebrow ?? "",
          title: p.title ?? "",
          intro: p.intro ?? "",
          sections: p.sections ?? [],
          references: p.references ?? [],
        }
      : null,
    modules: raw.modules.map((m, mi) => ({
      _key: prev?.modules[mi]?._key ?? uid(),
      id: m.id,
      slug: m.slug,
      title: m.title,
      chapters: m.chapters.map((c, ci) => ({
        _key: prev?.modules[mi]?.chapters[ci]?._key ?? uid(),
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description ?? "",
        video: c.video ?? "",
        poster: c.poster ?? "",
        subtitles: c.subtitles ?? [],
        content: c.content ?? [],
        references: c.references ?? [],
      })),
    })),
  };
}

function toPayload(c: AdminCourse) {
  return {
    slug: c.slug,
    title: c.title,
    description: c.description,
    thumbnail: c.thumbnail,
    is_published: c.is_published,
    preface: c.preface ?? {},
    modules: c.modules.map((m) => ({
      ...(m.id ? { id: m.id } : {}),
      slug: m.slug,
      title: m.title,
      chapters: m.chapters.map((ch) => ({
        ...(ch.id ? { id: ch.id } : {}),
        slug: ch.slug,
        title: ch.title,
        description: ch.description,
        video: ch.video,
        poster: ch.poster,
        subtitles: ch.subtitles,
        content: ch.content,
        references: ch.references,
      })),
    })),
  };
}

/* ---------- calls ---------- */

export const listAdminCourses = () => request<AdminCourseRow[]>("/courses/");

export async function getAdminCourse(id: number): Promise<AdminCourse> {
  return hydrateCourse(await request<RawCourse>(`/courses/${id}/`));
}

export function saveAdminCourse(c: AdminCourse): Promise<RawCourse> {
  const body = JSON.stringify(toPayload(c));
  return c.id
    ? request<RawCourse>(`/courses/${c.id}/`, { method: "PUT", body })
    : request<RawCourse>("/courses/", { method: "POST", body });
}

export const deleteAdminCourse = (id: number) =>
  request<void>(`/courses/${id}/`, { method: "DELETE" });