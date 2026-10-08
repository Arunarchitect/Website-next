"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getCourseBySlug } from "../api/courseApi";
import ChapterContent from "../components/ChapterContent";
import type { Course, ContentBlock } from "../types";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

interface Props {
  params: Promise<{ courseSlug: string }>;
}

export default function CourseOverviewPage({ params }: Props) {
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      const { courseSlug } = await params;
      const found = await getCourseBySlug(courseSlug);
      setCourse(found ?? null);
    })();
  }, [params]);

  if (course === undefined) return null;
  if (course === null) {
    notFound();
    return null;
  }

  const modules = [...course.modules].sort((a, b) => a.order - b.order);
  let chapterCounter = 0;

  const totalChapters = modules.reduce((n, m) => n + m.chapters.length, 0);
  const doneChapters = modules.reduce(
    (n, m) => n + m.chapters.filter((c) => c.completed).length,
    0
  );
  const progress = totalChapters ? Math.round((doneChapters / totalChapters) * 100) : 0;

  const prefaceBlocks: ContentBlock[] =
    course.preface?.sections.flatMap((section) => [
      { type: "heading", level: 2, text: section.heading, id: section.id },
      ...section.blocks,
    ]) ?? [];

  function toggleModule(moduleId: number) {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }

  return (
    <div className={`${display.variable} ${mono.variable} course-overview-page`}>
      <style>{`
        /* Prevent sideways scroll from 100vw (scrollbar width) while this page is mounted */
        body:has(.course-overview-page) { overflow-x: clip; }
        /* Smooth jump-to-modules scroll, only while this page is mounted */
        html:has(.course-overview-page) { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          html:has(.course-overview-page) { scroll-behavior: auto; }
        }

        .course-overview-page {
          --paper: #F7F5EF;
          --ink: #1E1E1A;
          --blue: #2C5F8A;
          --blue-deep: #17324A;
          --slate: #6E6B62;
          --line: #DFDACB;
          --green: #2f7a4f;
          --green-soft: #F1F6F2;
          --green-line: #D3E2D7;

          /* Break out of layout.tsx wrapper (max-w-7xl + my-8) */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-top: -2rem;
          margin-bottom: -2rem;
          box-sizing: border-box;

          min-height: 80vh;
          background: var(--paper);
          color: var(--ink);
        }
        .course-overview-inner {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 28px clamp(16px, 4vw, 64px) 80px;
          box-sizing: border-box;
        }
        .course-overview-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono), monospace;
          font-size: 0.74rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--blue);
          text-decoration: none;
        }
        .course-overview-back:hover { color: var(--blue-deep); }

        /* ---- Hero (compact) ---- */
        .course-hero {
          margin: 18px 0 28px;
        }
        .course-overview-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--blue);
          margin: 0 0 8px;
        }
        .course-overview-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.7rem, 3.4vw, 2.6rem);
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin: 0 0 10px;
          max-width: 980px;
        }
        .course-overview-desc {
          font-size: 1rem;
          color: var(--slate);
          line-height: 1.55;
          margin: 0 0 20px;
          max-width: 720px;
        }

        /* ---- Progress strip (stats + progress + jump) ---- */
        .course-strip {
          display: flex;
          align-items: center;
          gap: 28px;
          background: var(--blue-deep);
          color: #fff;
          border-radius: 10px;
          padding: 14px 18px 14px 22px;
        }
        .course-strip-stats {
          display: flex;
          gap: 22px;
          flex-shrink: 0;
        }
        .course-strip-stat {
          display: flex;
          align-items: baseline;
          gap: 7px;
          white-space: nowrap;
        }
        .course-strip-stat strong {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: 1.35rem;
          line-height: 1;
        }
        .course-strip-stat span {
          font-family: var(--font-mono), monospace;
          font-size: 0.66rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
        }
        .course-strip-progress {
          flex: 1;
          min-width: 0;
        }
        .course-strip-progress-text {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-family: var(--font-mono), monospace;
          font-size: 0.66rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
          margin-bottom: 7px;
        }
        .course-progress-track {
          height: 5px;
          background: rgba(255, 255, 255, 0.16);
          border-radius: 99px;
          overflow: hidden;
        }
        .course-progress-fill {
          height: 100%;
          background: #5fd08f;
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .course-jump {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: #fff;
          color: var(--blue-deep);
          border-radius: 7px;
          font-family: var(--font-mono), monospace;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .course-jump:hover,
        .course-jump:focus-visible {
          background: #E6EEF4;
          transform: translateY(-1px);
          outline: none;
        }
        .course-jump svg { transition: transform 0.18s ease; }
        .course-jump:hover svg { transform: translateY(2px); }

        @media (max-width: 860px) {
          .course-strip {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            padding: 16px 18px;
          }
          .course-strip-stats { gap: 18px; }
          .course-jump { width: 100%; }
        }

        /* ---- Preface (the main block) ---- */
        .course-preface {
          position: relative;
          border: 1px solid var(--line);
          border-top: 3px solid var(--blue);
          background: #fff;
          border-radius: 10px;
          padding: 40px clamp(24px, 5vw, 72px) 16px;
          margin: 0 0 56px;
          box-shadow: 0 8px 28px rgba(23, 50, 74, 0.06);
        }
        .course-preface-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--blue);
          margin: 0 0 8px;
        }
        .course-preface-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.6rem, 3vw, 2.3rem);
          line-height: 1.15;
          letter-spacing: -0.02em;
          margin: 0 0 14px;
        }
        .course-preface-intro {
          font-size: 1.1rem;
          color: #3d3b35;
          line-height: 1.7;
          margin: 0 0 22px;
          max-width: 840px;
        }
        .course-preface-body { padding-bottom: 24px; max-width: 920px; }
        @media (max-width: 640px) {
          .course-preface { padding: 26px 18px 6px; margin-bottom: 40px; }
          .course-preface-intro { font-size: 1.02rem; }
        }

        /* ---- Section label ---- */
        .modules-label {
          font-family: var(--font-mono), monospace;
          font-size: 0.75rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--slate);
          margin: 0 0 16px;
          scroll-margin-top: 24px;
        }

        /* ---- Modules ---- */
        .modules-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: start;
        }
        .module-block {
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fff;
          overflow: hidden;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .module-block:hover {
          border-color: #c9c2ad;
          box-shadow: 0 6px 20px rgba(23, 50, 74, 0.06);
        }
        .module-header {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 20px 22px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          color: inherit;
        }
        .module-header:hover { background: rgba(44, 95, 138, 0.04); }

        .module-check {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .module-check.done {
          border-color: var(--green);
          background: var(--green);
        }
        .module-check svg { width: 12px; height: 12px; }

        .module-title-wrap { flex: 1; min-width: 0; }
        .module-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 1.08rem;
          line-height: 1.3;
          margin: 0;
        }
        .module-count {
          font-family: var(--font-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          color: var(--slate);
          text-transform: uppercase;
          margin-top: 4px;
        }
        .module-chevron {
          flex-shrink: 0;
          color: var(--blue);
          transition: transform 0.2s ease;
        }
        .module-header[aria-expanded="true"] .module-chevron {
          transform: rotate(180deg);
        }

        .module-collapsible {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.22s ease;
        }
        .module-collapsible.open { grid-template-rows: 1fr; }
        .module-collapsible-inner { overflow: hidden; }

        .chapter-list {
          list-style: none;
          padding: 0 16px 16px;
          margin: 0;
        }
        .chapter-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          margin-top: 8px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--paper);
          text-decoration: none;
          color: inherit;
          transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
        }
        /* Completed: quiet green tint, text stays fully readable */
        .chapter-card.done {
          background: var(--green-soft);
          border-color: var(--green-line);
        }
        .chapter-card:hover,
        .chapter-card:focus-visible {
          border-color: var(--blue);
          transform: translateY(-1px);
          outline: none;
        }
        .chapter-check {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px solid var(--line);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chapter-check.done {
          border-color: var(--green);
          background: var(--green);
        }
        .chapter-check svg { width: 10px; height: 10px; }

        .chapter-num {
          font-family: var(--font-mono), monospace;
          font-size: 0.76rem;
          color: var(--blue);
          width: 22px;
          flex-shrink: 0;
        }
        .chapter-text { flex: 1; min-width: 0; }
        .chapter-title {
          display: block;
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 0.95rem;
          margin: 0 0 2px;
        }
        .chapter-desc {
          font-size: 0.82rem;
          color: var(--slate);
          margin: 0;
          line-height: 1.4;
        }
        .chapter-video-tag {
          font-family: var(--font-mono), monospace;
          font-size: 0.66rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--blue);
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 3px 8px;
          flex-shrink: 0;
        }

        /* ---- Responsive ---- */
        @media (min-width: 1000px) {
          .modules-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      <main className="course-overview-inner">
        <Link href="/course" className="course-overview-back">
          &larr; All courses
        </Link>

        <header className="course-hero">
          <p className="course-overview-eyebrow">Modelflick — course</p>
          <h1 className="course-overview-title">{course.title}</h1>
          <p className="course-overview-desc">{course.description}</p>

          <div className="course-strip" aria-label="Course progress">
            <div className="course-strip-stats">
              <div className="course-strip-stat">
                <strong>{modules.length}</strong>
                <span>Modules</span>
              </div>
              <div className="course-strip-stat">
                <strong>{totalChapters}</strong>
                <span>Chapters</span>
              </div>
            </div>

            <div className="course-strip-progress">
              <div className="course-strip-progress-text">
                <span>{doneChapters} of {totalChapters} chapters done</span>
                <span>{progress}%</span>
              </div>
              <div className="course-progress-track">
                <div className="course-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <a href="#curriculum" className="course-jump">
              Modules
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 2.5V11M3 7.5L7 11.5L11 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </header>

        {course.preface && (
          <section className="course-preface" aria-label="Course preface">
            {course.preface.eyebrow && (
              <p className="course-preface-eyebrow">{course.preface.eyebrow}</p>
            )}
            <h2 className="course-preface-title">{course.preface.title}</h2>
            <p className="course-preface-intro">{course.preface.intro}</p>
            {prefaceBlocks.length > 0 && (
              <div className="course-preface-body">
                <ChapterContent
                  content={prefaceBlocks}
                  references={course.preface.references}
                />
              </div>
            )}
          </section>
        )}

        <p id="curriculum" className="modules-label">Curriculum</p>
        <div className="modules-grid">
          {modules.map((courseModule) => {
            const sortedChapters = [...courseModule.chapters].sort((a, b) => a.order - b.order);
            const isOpen = !!openModules[courseModule.id];
            const allDone = sortedChapters.length > 0 && sortedChapters.every((ch) => ch.completed);

            return (
              <section key={courseModule.id} className="module-block">
                <button
                  type="button"
                  className="module-header"
                  aria-expanded={isOpen}
                  onClick={() => toggleModule(courseModule.id)}
                >
                  <span className={`module-check${allDone ? " done" : ""}`}>
                    {allDone && (
                      <svg viewBox="0 0 12 12" fill="none">
                        <path d="M2 6.2L4.6 9L10 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="module-title-wrap">
                    <h2 className="module-title">{courseModule.title}</h2>
                    <div className="module-count">{sortedChapters.length} chapters</div>
                  </span>
                  <svg className="module-chevron" width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className={`module-collapsible${isOpen ? " open" : ""}`}>
                  <div className="module-collapsible-inner">
                    <ol className="chapter-list">
                      {sortedChapters.map((chapter) => {
                        chapterCounter += 1;
                        const isDone = !!chapter.completed;
                        return (
                          <li key={chapter.id}>
                            <Link
                              href={`/course/${course.slug}/${chapter.slug}`}
                              className={`chapter-card${isDone ? " done" : ""}`}
                            >
                              <span className={`chapter-check${isDone ? " done" : ""}`}>
                                {isDone && (
                                  <svg viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6.2L4.6 9L10 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <span className="chapter-num">{String(chapterCounter).padStart(2, "0")}</span>
                              <span className="chapter-text">
                                <span className="chapter-title">{chapter.title}</span>
                                <p className="chapter-desc">{chapter.description}</p>
                              </span>
                              {chapter.video && <span className="chapter-video-tag">Video</span>}
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}