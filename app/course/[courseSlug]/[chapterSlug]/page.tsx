import Link from "next/link";
import { notFound } from "next/navigation";
import VideoPlayer from "../../components/VideoPlayer";
import {
  getCourseBySlug,
  getChapterBySlug,
  getAdjacentChapters,
} from "../../api/courseApi";

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

  return (
    <main style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 20px" }}>
      <Link href={`/course/${course.slug}`} style={{ fontSize: "0.9rem", color: "#666" }}>
        &larr; {course.title}
      </Link>

      <p style={{ fontSize: "0.8rem", color: "#999", margin: "16px 0 4px" }}>{courseModule.title}</p>
      <h1 style={{ fontSize: "1.8rem", margin: "0 0 8px" }}>{chapter.title}</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>{chapter.description}</p>

      {chapter.video ? (
        <VideoPlayer
          src={chapter.video}
          poster={chapter.poster ?? ""}
          subtitles={chapter.subtitles}
        />
      ) : (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            border: "1px dashed #ccc",
            borderRadius: "10px",
            color: "#999",
            marginBottom: "8px",
          }}
        >
          No video for this lesson — text/notes only.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
        {prev ? (
          <Link
            href={`/course/${course.slug}/${prev.slug}`}
            style={{
              padding: "10px 18px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            href={`/course/${course.slug}/${next.slug}`}
            style={{
              padding: "10px 18px",
              backgroundColor: "#111",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Next: {next.title} &rarr;
          </Link>
        ) : (
          <Link
            href={`/course/${course.slug}`}
            style={{
              padding: "10px 18px",
              backgroundColor: "#111",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Finish course
          </Link>
        )}
      </div>
    </main>
  );
}