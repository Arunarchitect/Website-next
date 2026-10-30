import { slugify } from "./editors";
import { blankChapter, blankModule } from "../api/adminApi";
import type { AdminChapter, AdminCourse } from "../api/adminApi";

import type { ContentBlock, Reference, Subtitle } from "../types";

const BLOCK_TYPES = ["heading", "paragraph", "list", "callout", "image", "divider"];

const INSTRUCTIONS =
    "Improve the wording, clarity, accuracy and structure of the text content. " +
    "Return the SAME JSON structure. Do NOT change any 'slug' values, do not rename keys, " +
    "and do not add other block types than: heading(level 2|3), paragraph, list, callout, image, divider. " +
    "Inline runs use types: text, bold, italic, highlight, code, link(href), ref(refId). " +
    "Keep video/poster/src paths unchanged. Return ONLY valid JSON.";

/* ---------------- export ---------------- */

const chapterFields = (ch: AdminChapter) => ({
    slug: ch.slug,
    title: ch.title,
    description: ch.description,
    video: ch.video,
    poster: ch.poster,
    subtitles: ch.subtitles,
    content: ch.content,
    references: ch.references,
});

export function chapterToAiJson(ch: AdminChapter, moduleTitle: string) {
    return { _instructions: INSTRUCTIONS, scope: "chapter", module: moduleTitle, chapter: chapterFields(ch) };
}

export function courseToAiJson(c: AdminCourse) {
    return {
        _instructions: INSTRUCTIONS,
        scope: "course",
        course: {
            slug: c.slug,
            title: c.title,
            description: c.description,
            thumbnail: c.thumbnail,
            preface: c.preface,
            modules: c.modules.map((m) => ({
                slug: m.slug,
                title: m.title,
                chapters: m.chapters.map(chapterFields),
            })),
        },
    };
}

/* ---------------- parse + validate ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAiJson(text: string): any {
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); // AI often wraps in ```json
    if (fence) t = fence[1].trim();
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    try {
        return JSON.parse(t);
    } catch (e) {
        throw new Error("Not valid JSON: " + (e as Error).message);
    }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkBlocks(blocks: any, where: string) {
    if (!Array.isArray(blocks)) throw new Error(`${where}: content must be an array`);
    blocks.forEach((b, i) => {
        const w = `${where} block ${i + 1}`;
        if (!isObj(b) || !BLOCK_TYPES.includes(b.type as string)) throw new Error(`${w}: invalid "type"`);
        if (b.type === "heading" && typeof b.text !== "string") throw new Error(`${w}: heading needs "text"`);
        if ((b.type === "paragraph" || b.type === "callout") && !Array.isArray(b.runs))
            throw new Error(`${w}: needs "runs" array`);
        if (b.type === "list" && (!Array.isArray(b.items) || b.items.some((it: unknown) => !Array.isArray(it))))
            throw new Error(`${w}: list "items" must be an array of run-arrays`);
        if (b.type === "image" && typeof b.src !== "string") throw new Error(`${w}: image needs "src"`);
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkRefs(refs: any, where: string) {
    if (!Array.isArray(refs)) throw new Error(`${where}: references must be an array`);
    refs.forEach((r, i) => {
        if (!isObj(r) || typeof r.id !== "string" || typeof r.text !== "string")
            throw new Error(`${where} reference ${i + 1}: needs "id" and "text"`);
    });
}

/* ---------------- apply (mutates the cloned draft) ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyChapterFields(t: AdminChapter, s: any, where: string) {
    if (!isObj(s)) throw new Error(`${where}: must be an object`);
    for (const k of ["title", "description", "video", "poster"] as const) {
        if (k in s) {
            if (typeof s[k] !== "string") throw new Error(`${where}: "${k}" must be a string`);
            t[k] = s[k] as string;
        }
    }
    if ("subtitles" in s) {
        if (!Array.isArray(s.subtitles) || s.subtitles.some((x: unknown) => !isObj(x) || typeof x.src !== "string"))
            throw new Error(`${where}: invalid subtitles`);
        t.subtitles = s.subtitles as Subtitle[];
    }
    if ("content" in s) {
        checkBlocks(s.content, where);
        t.content = s.content as ContentBlock[];
    }
    if ("references" in s) {
        checkRefs(s.references, where);
        t.references = s.references as Reference[];
    }
}

export function applyChapterJson(c: AdminCourse, chapKey: string, data: unknown): string {
    const root = data as Record<string, unknown>;
    if (isObj(root) && root.scope === "course") throw new Error("This is course JSON — use it with no chapter needed, or copy chapter JSON.");
    const src = isObj(root) && isObj(root.chapter) ? root.chapter : root;
    let target: AdminChapter | undefined;
    for (const m of c.modules) target ??= m.chapters.find((x) => x._key === chapKey);
    if (!target) throw new Error("Selected chapter not found.");
    applyChapterFields(target, src, "Chapter"); // slug is never changed
    return `Updated chapter “${target.title}”. Review, then Save.`;
}

export function applyCourseJson(c: AdminCourse, data: unknown): string {
    const root = data as Record<string, unknown>;
    if (isObj(root) && root.scope === "chapter") throw new Error("This is chapter JSON — select that chapter first.");
    const src = isObj(root) && isObj(root.course) ? root.course : root;
    if (!isObj(src)) throw new Error("Course JSON must be an object.");

    for (const k of ["title", "description", "thumbnail"] as const) {
        if (k in src) {
            if (typeof src[k] !== "string") throw new Error(`Course: "${k}" must be a string`);
            c[k] = src[k] as string;
        }
    }

    if (isObj(src.preface) && Object.keys(src.preface).length) {
        const p = src.preface as Record<string, unknown>;
        const sections = Array.isArray(p.sections) ? p.sections : [];
        sections.forEach((s: unknown, i: number) => {
            if (!isObj(s) || typeof s.heading !== "string") throw new Error(`Preface section ${i + 1}: needs "heading"`);
            checkBlocks(s.blocks ?? [], `Preface section ${i + 1}`);
        });
        const refs = p.references ?? [];
        checkRefs(refs, "Preface");
        c.preface = {
            eyebrow: (p.eyebrow as string) ?? "",
            title: (p.title as string) ?? "",
            intro: (p.intro as string) ?? "",
            sections: sections.map((s: Record<string, unknown>) => ({
                id: (s.id as string) || slugify(s.heading as string),
                heading: s.heading as string,
                blocks: (s.blocks as never[]) ?? [],
            })),
            references: refs as never[],
        };
    }

    let updated = 0;
    let added = 0;
    if ("modules" in src) {
        if (!Array.isArray(src.modules)) throw new Error("Course: modules must be an array");
        src.modules.forEach((sm: unknown, mi: number) => {
            const mw = `Module ${mi + 1}`;
            if (!isObj(sm)) throw new Error(`${mw}: must be an object`);
            if (typeof sm.slug !== "string" || !sm.slug) throw new Error(`${mw}: slug required`);
            let mod = c.modules.find((x) => x.slug === sm.slug);
            if (!mod) {
                mod = blankModule();
                mod.slug = sm.slug;
                mod.title = (sm.title as string) ?? sm.slug;
                c.modules.push(mod);
                added++;
            } else if (typeof sm.title === "string") {
                mod.title = sm.title;
            }
            const chs = Array.isArray(sm.chapters) ? sm.chapters : [];
            chs.forEach((sc: unknown, ci: number) => {
                const cw = `${mw} › chapter ${ci + 1}`;
                if (!isObj(sc)) throw new Error(`${cw}: must be an object`);
                if (typeof sc.slug !== "string" || !sc.slug) throw new Error(`${cw}: slug required`);
                let found: AdminChapter | undefined;
                for (const m of c.modules) found ??= m.chapters.find((x) => x.slug === sc.slug);
                if (found) {
                    applyChapterFields(found, sc, cw);
                    updated++;
                } else {
                    const nc = blankChapter();
                    nc.slug = (sc.slug as string) || slugify((sc.title as string) ?? "");
                    applyChapterFields(nc, sc, cw);
                    mod!.chapters.push(nc);
                    added++;
                }
            });
        });
    }
    return `Updated ${updated} chapter(s), added ${added} new item(s). Review, then Save.`;
}