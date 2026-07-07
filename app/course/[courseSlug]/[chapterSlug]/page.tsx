import Link from "next/link";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import VideoPlayer from "../../components/VideoPlayer";
import ChapterContent from "../../components/ChapterContent";
import {
  getCourseBySlug,
  getChapterBySlug,
  getAdjacentChapters,
  getAllChapters,
} from "../../api/courseApi";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

interface Props {
  params: Promise<{ courseSlug: string; chapterSlug: string }>;
}

export default async function ChapterPage({ params }: Props) {
  const { courseSlug, chapterSlug } = await params;
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    notFound();
  }

  const result = getChapterBySlug(course, chapterSlug);

  if (!result) {
    notFound();
  }

  const { chapter, courseModule } = result;
  const { prev, next } = getAdjacentChapters(course, chapter);

  const allChapters = getAllChapters(course);
  const completedCount = allChapters.filter((ch) => ch.completed).length;
  const isDone = !!chapter.completed;
  const hasVideo = !!chapter.video;
  const hasContent = !!chapter.content && chapter.content.length > 0;

  return (
    <main className={`${display.variable} ${mono.variable} chapter-page`}>
      <style>{`
        .chapter-page {
          --paper: #F7F5EF;
          --ink: #1E1E1A;
          --blue: #2C5F8A;
          --blue-deep: #17324A;
          --slate: #6E6B62;
          --line: #DFDACB;
          --green: #2f7a4f;

          max-width: 1000px;
          margin: 0 auto;
          padding: 24px 24px 60px;
          background: var(--paper);
          color: var(--ink);
        }
        .chapter-back {
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
        .chapter-back:hover { color: var(--blue-deep); }

        .chapter-progress-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 22px 0 6px;
        }
        .chapter-progress-bar {
          flex: 1;
          height: 4px;
          background: var(--line);
          border-radius: 2px;
          overflow: hidden;
        }
        .chapter-progress-fill {
          height: 100%;
          background: var(--blue);
          border-radius: 2px;
        }
        .chapter-progress-label {
          font-family: var(--font-mono), monospace;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
          color: var(--slate);
          white-space: nowrap;
        }

        .chapter-module-label {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.12em;
          color: var(--blue);
          margin: 16px 0 6px;
          text-transform: uppercase;
        }

        .chapter-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px 12px;
          margin-bottom: 8px;
        }
        .chapter-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.6rem, 3.6vw, 2.2rem);
          letter-spacing: -0.02em;
          margin: 0;
        }
        .chapter-done-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono), monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #fff;
          background: var(--green);
          border-radius: 999px;
          padding: 4px 10px 4px 8px;
          flex-shrink: 0;
        }
        .chapter-done-badge svg { width: 10px; height: 10px; }

        .chapter-desc {
          font-size: 15px;
          color: var(--slate);
          line-height: 1.55;
          margin: 0 0 28px;
          max-width: 720px;
        }

        .chapter-media-empty {
          padding: 48px 20px;
          text-align: center;
          border: 1px dashed var(--line);
          border-radius: 6px;
          background: #fff;
          color: var(--slate);
          font-size: 0.9rem;
          margin-bottom: 8px;
        }

        .chapter-nav {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 40px;
        }
        .chapter-nav-link {
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-width: 46%;
          padding: 14px 18px;
          border: 1px solid var(--line);
          border-radius: 4px;
          background: #fff;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.18s ease, transform 0.18s ease;
        }
        .chapter-nav-link:hover {
          border-color: var(--blue);
          transform: translateY(-1px);
        }
        .chapter-nav-link.next {
          margin-left: auto;
          text-align: right;
          align-items: flex-end;
          background: var(--blue-deep);
          border-color: var(--blue-deep);
          color: #fff;
        }
        .chapter-nav-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--blue);
        }
        .chapter-nav-link.next .chapter-nav-eyebrow { color: #cfe0ee; }
        .chapter-nav-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 0.92rem;
        }
        .chapter-nav-spacer { flex: 1; }

        @media (max-width: 640px) {
          .chapter-page { padding: 16px 16px 48px; }
          .chapter-desc { font-size: 14.5px; margin-bottom: 22px; }
          .chapter-nav {
            flex-direction: column;
          }
          .chapter-nav-link,
          .chapter-nav-link.next {
            max-width: 100%;
            width: 100%;
            margin-left: 0;
            text-align: left;
            align-items: flex-start;
          }
        }
      `}</style>

      <Link href={`/course/${course.slug}`} className="chapter-back">
        &larr; {course.title}
      </Link>

      <div className="chapter-progress-row">
        <div className="chapter-progress-bar">
          <div
            className="chapter-progress-fill"
            style={{ width: `${allChapters.length ? (completedCount / allChapters.length) * 100 : 0}%` }}
          />
        </div>
        <span className="chapter-progress-label">
          {completedCount}/{allChapters.length} complete
        </span>
      </div>

      <p className="chapter-module-label">{courseModule.title}</p>

      <div className="chapter-title-row">
        <h1 className="chapter-title">{chapter.title}</h1>
        {isDone && (
          <span className="chapter-done-badge">
            <svg viewBox="0 0 12 12" fill="none">
              <path d="M2 6.2L4.6 9L10 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Completed
          </span>
        )}
      </div>
      <p className="chapter-desc">{chapter.description}</p>

      {hasVideo ? (
        <VideoPlayer
          src={chapter.video!}
          poster={chapter.poster ?? ""}
          subtitles={chapter.subtitles}
        />
      ) : !hasContent ? (
        <div className="chapter-media-empty">No video for this lesson — text/notes only.</div>
      ) : null}

      {hasContent && (
        <div className="chapter-body" style={{ marginTop: hasVideo ? 28 : 0 }}>
          <ChapterContent content={chapter.content!} references={chapter.references} />
        </div>
      )}

      <div className="chapter-nav">
        {prev ? (
          <Link href={`/course/${course.slug}/${prev.slug}`} className="chapter-nav-link">
            <span className="chapter-nav-eyebrow">&larr; Previous</span>
            <span className="chapter-nav-title">{prev.title}</span>
          </Link>
        ) : (
          <span className="chapter-nav-spacer" />
        )}

        {next ? (
          <Link href={`/course/${course.slug}/${next.slug}`} className="chapter-nav-link next">
            <span className="chapter-nav-eyebrow">Next</span>
            <span className="chapter-nav-title">{next.title} &rarr;</span>
          </Link>
        ) : (
          <Link href={`/course/${course.slug}`} className="chapter-nav-link next">
            <span className="chapter-nav-eyebrow">Course</span>
            <span className="chapter-nav-title">Finish course &rarr;</span>
          </Link>
        )}
      </div>
    </main>
  );
}