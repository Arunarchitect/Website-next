import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseBySlug } from "../api/courseApi";

interface Props {
  params: Promise<{ courseSlug: string }>;
}

export default async function CourseOverviewPage({ params }: Props) {
  const { courseSlug } = await params;
  const course = await getCourseBySlug(courseSlug);

  if (!course) {
    notFound();
  }

  const modules = [...course.modules].sort((a, b) => a.order - b.order);
  let chapterCounter = 0;

  return (
    <main style={{ maxWidth: "900px", margin: "40px auto", padding: "0 20px" }}>
      <Link href="/course" style={{ fontSize: "0.9rem", color: "#666" }}>
        &larr; All courses
      </Link>

      <h1 style={{ fontSize: "2rem", margin: "16px 0 8px" }}>{course.title}</h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>{course.description}</p>

      {modules.map((courseModule) => (
        <section key={courseModule.id} style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>{courseModule.title}</h2>

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[...courseModule.chapters]
              .sort((a, b) => a.order - b.order)
              .map((chapter) => {
                chapterCounter += 1;
                return (
                  <li key={chapter.id}>
                    <Link
                      href={`/course/${course.slug}/${chapter.slug}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        padding: "14px 16px",
                        border: "1px solid #e2e2e2",
                        borderRadius: "10px",
                        marginBottom: "10px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#999", width: "28px", flexShrink: 0 }}>
                        {chapterCounter}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 500 }}>{chapter.title}</span>
                        <span style={{ display: "block", fontSize: "0.85rem", color: "#666" }}>
                          {chapter.description}
                        </span>
                      </span>
                      {chapter.video && (
                        <span style={{ fontSize: "0.75rem", color: "#999" }}>Video</span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </main>
  );
}