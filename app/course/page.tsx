import Link from "next/link";
import Image from "next/image";
import { getCourses, totalChapterCount } from "./api/courseApi";

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <main style={{ maxWidth: "1100px", margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>Courses</h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>Pick a course to get started.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/course/${course.slug}`}
            style={{
              display: "block",
              border: "1px solid #e2e2e2",
              borderRadius: "12px",
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                backgroundColor: "#f2f2f2",
              }}
            >
              <Image
                src={course.thumbnail}
                alt={course.title}
                fill
                style={{ objectFit: "cover" }}
              />
            </div>
            <div style={{ padding: "16px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>{course.title}</h2>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>{course.description}</p>
              <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "8px" }}>
                {course.modules.length} modules · {totalChapterCount(course)} chapters
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}