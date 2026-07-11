// app/drawing/constants.ts

export interface ClientSection {
  label: string;
  description: string;
  icon: string;
  href: string;
  cta: string;
  requiresAreacalc?: boolean;
}

export const clientSections: ClientSection[] = [
  {
    label: "Drawings & Documents",
    description: "Access project drawings, schematics, and documentation",
    icon: "ti-file-text",
    href: "/main/client/documents",
    cta: "View Documents",
  },
  {
    label: "Dashboard",
    description: "Overview of your projects and activities",
    icon: "ti-layout-dashboard",
    href: "/new/dash/dashnormal",
    cta: "Go to Dashboard",
  },
  {
    label: "Areacalc",
    description: "Area calculation tools and measurements",
    icon: "ti-ruler-measure",
    href: "/tools/areacalc",
    cta: "Open Areacalc",
    requiresAreacalc: true,
  },
  {
    label: "Issues",
    description: "Report and track project issues",
    icon: "ti-bug",
    href: "/issues",
    cta: "View Issues",
  },
];