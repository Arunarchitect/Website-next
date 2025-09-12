// app/courses/page.tsx (Server Component, no "use client")
import { generateMetadata } from "@/lib/generateMetadata";
import CoursesPageClient from "./CoursesPageClient";

export const metadata = generateMetadata({
  title: "Courses",
  description: "Skill Up for Free using OpenSource Technologies",
  imageText: "Course",
});

export default function Page() {
  return <CoursesPageClient />;
}
