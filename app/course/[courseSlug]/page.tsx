"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getCourseBySlug } from "../api/courseApi";
import type { Course } from "../types";

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

  function toggleModule(moduleId: number) {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }

  return (
    <main className={`${display.variable} ${mono.variable} course-overview-page`}>
      <style>{`
        .course-overview-page {
          --paper: #F7F5EF;
          --ink: #1E1E1A;
          --blue: #2C5F8A;
          --blue-deep: #17324A;
          --slate: #6E6B62;
          --line: #DFDACB;
          --green: #2f7a4f;

          max-width: 900px;
          margin: 0 auto;
          padding: 24px 24px 60px;
          background: var(--paper);
          color: var(--ink);
        }
        .course-overview-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono), monospace;
          font-size: 0.78rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--blue);
          text-decoration: none;
        }
        .course-overview-back:hover { color: var(--blue-deep); }

        .course-overview-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--blue);
          margin: 22px 0 6px;
        }
        .course-overview-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.8rem, 4vw, 2.4rem);
          letter-spacing: -0.02em;
          margin: 0 0 10px;
        }
        .course-overview-desc {
          font-size: 15px;
          color: var(--slate);
          line-height: 1.55;
          margin: 0 0 40px;
          max-width: 640px;
        }

        .module-block {
          border: 1px solid var(--line);
          border-radius: 4px;
          background: #fff;
          margin-bottom: 14px;
          overflow: hidden;
        }
        .module-header {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 16px 18px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .module-header:hover { background: rgba(44, 95, 138, 0.04); }

        .module-check {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
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
        .module-check svg { width: 11px; height: 11px; }

        .module-title-wrap { flex: 1; min-width: 0; }
        .module-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 1.02rem;
          margin: 0;
        }
        .module-count {
          font-family: var(--font-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          color: var(--slate);
          text-transform: uppercase;
          margin-top: 2px;
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
          padding: 0 14px 14px;
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
          border-radius: 4px;
          background: var(--paper);
          text-decoration: none;
          color: inherit;
          transition: border-color 0.18s ease, transform 0.18s ease;
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
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 0.95rem;
          margin: 0 0 2px;
        }
        .chapter-title.done-text { color: var(--slate); text-decoration: line-through; text-decoration-color: var(--line); }
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
      `}</style>

      <Link href="/course" className="course-overview-back">
        &larr; All courses
      </Link>

      <p className="course-overview-eyebrow">Modelflick — course</p>
      <h1 className="course-overview-title">{course.title}</h1>
      <p className="course-overview-desc">{course.description}</p>

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
                        <Link href={`/course/${course.slug}/${chapter.slug}`} className="chapter-card">
                          <span className={`chapter-check${isDone ? " done" : ""}`}>
                            {isDone && (
                              <svg viewBox="0 0 12 12" fill="none">
                                <path d="M2 6.2L4.6 9L10 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className="chapter-num">{String(chapterCounter).padStart(2, "0")}</span>
                          <span className="chapter-text">
                            <span className={`chapter-title${isDone ? " done-text" : ""}`}>{chapter.title}</span>
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
    </main>
  );
}