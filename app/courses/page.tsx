// app/courses/page.tsx
import { generateMetadata } from "@/lib/generateMetadata";
import CoursesPageClient from "./CoursesPageClient";

export const metadata = generateMetadata({
  title: "Courses",
  description: "Skill up for free with high-quality content focused on open-source technologies in the AEC industry and beyond. Through Modelflick, we promote tools like Blender and other powerful open-source software, making technical learning accessible to architects, designers, engineers, and creative professionals.",
  imageText: "Courses",
});


export default function Page() {
  return <CoursesPageClient />;
}
