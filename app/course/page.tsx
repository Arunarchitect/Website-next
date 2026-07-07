import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getCourses, totalChapterCount } from "./api/courseApi";
import CertificateVerifier from "./components/CertificateVerifier";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <main className={`${display.variable} ${mono.variable} courses-page`}>
      <style>{`
        .courses-page {
          --paper: #F7F5EF;
          --ink: #1E1E1A;
          --blue: #2C5F8A;
          --blue-deep: #17324A;
          --slate: #6E6B62;
          --line: #DFDACB;

          max-width: 1120px;
          margin: 0 auto;
          padding: 2px 24px 10px;
          background: var(--paper);
          color: var(--ink);
        }
        .courses-header-row {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 48px;
          align-items: start;
          margin-bottom: 2px;
        }
        @media (max-width: 780px) {
          .courses-header-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        .courses-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--blue);
        }
        .courses-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 4vw, 2.6rem);
          letter-spacing: -0.02em;
          margin: 0 0 2px;
        }
        .courses-sub {
          font-size: 15px;
          color: var(--slate);
          margin: 0 0 12px;
          line-height: 1.55;
        }
        .courses-oss {
          font-size: 14px;
          color: var(--ink);
          margin: 0;
          line-height: 1.6;
          padding-left: 14px;
          border-left: 2px solid var(--blue);
        }
        .courses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 28px;
        }
        .course-card {
          display: block;
          text-decoration: none;
          color: inherit;
          border: 1px solid var(--line);
          border-radius: 4px;
          overflow: hidden;
          background: #fff;
          transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }
        .course-card:hover,
        .course-card:focus-visible {
          border-color: var(--blue);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(23, 50, 74, 0.1);
          outline: none;
        }
        .course-thumb {
          position: relative;
          aspect-ratio: 16 / 10;
          background-color: #EEF3F6;
          background-image:
            linear-gradient(var(--line) 1px, transparent 1px),
            linear-gradient(90deg, var(--line) 1px, transparent 1px);
          background-size: 22px 22px;
          overflow: hidden;
        }
        .course-thumb::before,
        .course-thumb::after {
          content: "";
          position: absolute;
          width: 14px;
          height: 14px;
          border: 1.5px solid var(--blue);
          opacity: 0.55;
        }
        .course-thumb::before { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .course-thumb::after { bottom: 10px; right: 10px; border-left: none; border-top: none; }
        .course-num {
          position: absolute;
          top: 10px;
          right: 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--blue);
        }
        .course-monogram {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: 3.4rem;
          letter-spacing: 0.02em;
          color: transparent;
          -webkit-text-stroke: 1.5px var(--blue-deep);
          opacity: 0.8;
          user-select: none;
        }
        .course-body { padding: 18px 20px 20px; }
        .course-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 1.05rem;
          margin: 0 0 6px;
          position: relative;
          display: inline-block;
        }
        .course-title::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -3px;
          height: 1.5px;
          width: 0;
          background: var(--blue);
          transition: width 0.2s ease;
        }
        .course-card:hover .course-title::after { width: 100%; }
        .course-desc {
          font-size: 0.88rem;
          color: var(--slate);
          line-height: 1.5;
          margin: 0 0 14px;
        }
        .course-meta {
          font-family: var(--font-mono), monospace;
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          color: var(--blue);
          text-transform: uppercase;
        }
      `}</style>

      <div className="courses-header-row">
        <div>
          <p className="courses-eyebrow">Modelflick — index</p>
          <h1 className="courses-title">Courses</h1>
          <p className="courses-sub">Pick a course to get started.</p>
          <p className="courses-oss">
            Beyond course delivery, Modelflick backs open source initiatives and shares the
            actual workflows behind them — so what you learn here maps to tools you can
            inspect, run, and contribute to yourself.
          </p>
        </div>
        <CertificateVerifier />
      </div>

      <div className="courses-grid">
        {courses.map((course, i) => (
          <Link key={course.id} href={`/course/${course.slug}`} className="course-card">
            <div className="course-thumb">
              <span className="course-num">N&deg;{String(i + 1).padStart(2, "0")}</span>
              <span className="course-monogram">{course.title.charAt(0)}</span>
              {/* Swap in a real thumbnail once available:
              <Image src={course.thumbnail} alt={course.title} fill style={{ objectFit: "cover" }} /> */}
            </div>
            <div className="course-body">
              <h2 className="course-title">{course.title}</h2>
              <p className="course-desc">{course.description}</p>
              <p className="course-meta">
                {course.modules.length} modules &middot; {totalChapterCount(course)} chapters
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}