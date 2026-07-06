import type { Course, Chapter, Module } from "../types";

const COURSES: Course[] = [
  {
    id: 1,
    slug: "bonsai-bim-openbim",
    title: "BonsaiBIM (OpenBIM / Blender) Architectural BIM",
    description:
      "A full architectural BIM workflow using BonsaiBIM and Blender, from client brief to final IFC deliverables.",
    thumbnail: "/courses/bonsai-bim/thumb.jpg",
    modules: [
      {
        id: 1,
        slug: "client-requirements-project-setup",
        title: "Module 1: Client Requirements & BIM Fundamental Project Setup",
        order: 1,
        chapters: [
          {
            id: 1,
            slug: "client-brief-analysis",
            title: "Client Brief Analysis",
            description: "Understand and break down a real client brief before modeling begins.",
            order: 1,
          },
          {
            id: 2,
            slug: "space-requirements-functional-programming",
            title: "Space Requirements & Functional Programming",
            description: "Translate the brief into a functional space program.",
            order: 2,
          },
          {
            id: 3,
            slug: "site-analysis",
            title: "Site Analysis (Orientation, Access, Terrain)",
            description: "Analyze site orientation, access points, and terrain constraints.",
            order: 3,
          },
          {
            id: 4,
            slug: "importing-cad-pdf-references",
            title: "Importing CAD/PDF References",
            description: "Bring survey drawings and PDF references into Blender as underlays.",
            video: "/videos/bonsai/m1/importing-references.mp4",
            poster: "/videos/bonsai/m1/importing-references-poster.jpg",
            subtitles: [
              {
                label: "English",
                language: "en",
                src: "/videos/bonsai/m1/importing-references.vtt",
                default: true,
              },
            ],
            order: 4,
          },
          {
            id: 5,
            slug: "setting-up-bonsaibim-project",
            title: "Setting Up the BonsaiBIM Project",
            description: "Install and configure BonsaiBIM, and create a new IFC project.",
            video: "/videos/bonsai/m1/project-setup.mp4",
            poster: "/videos/bonsai/m1/project-setup-poster.jpg",
            order: 5,
          },
          {
            id: 6,
            slug: "coordinate-system-project-origin",
            title: "Coordinate System & Project Origin",
            description: "Set true north, survey point, and project origin correctly.",
            order: 6,
          },
          {
            id: 7,
            slug: "storeys-grids-project-organization",
            title: "Storeys, Grids & Project Organization",
            description: "Structure the project with storeys, grids, and a clean outliner hierarchy.",
            order: 7,
          },
        ],
      },
      {
        id: 2,
        slug: "creating-the-architectural-bim-model",
        title: "Module 2: Creating the Architectural BIM Model",
        order: 2,
        chapters: [
          {
            id: 8,
            slug: "ifc-fundamentals",
            title: "IFC Fundamentals",
            description: "Core IFC concepts: entities, relationships, property sets, and schema basics.",
            video: "/videos/bonsai/m2/ifc-fundamentals.mp4",
            poster: "/videos/bonsai/m2/ifc-fundamentals-poster.jpg",
            order: 8,
          },
          {
            id: 9,
            slug: "walls-slabs-roofs-ceilings",
            title: "Walls, Slabs, Roofs, and Ceilings",
            description: "Model the primary building envelope elements.",
            video: "/videos/bonsai/m2/walls-slabs-roofs.mp4",
            poster: "/videos/bonsai/m2/walls-slabs-roofs-poster.jpg",
            order: 9,
          },
          {
            id: 10,
            slug: "doors-and-windows",
            title: "Doors and Windows",
            description: "Place parametric doors and windows and manage their properties.",
            order: 10,
          },
          {
            id: 11,
            slug: "columns-beams-stairs",
            title: "Columns, Beams, and Stairs",
            description: "Model structural columns, beams, and stair assemblies.",
            order: 11,
          },
          {
            id: 12,
            slug: "openings-and-voids",
            title: "Openings and Voids",
            description: "Create and manage openings and boolean voids in building elements.",
            order: 12,
          },
          {
            id: 13,
            slug: "spaces-rooms-and-zoning",
            title: "Spaces (Rooms) and Zoning",
            description: "Define IFC spaces, assign zones, and organize rooms for area reporting.",
            order: 13,
          },
          {
            id: 14,
            slug: "materials-and-classifications",
            title: "Materials and Classifications",
            description: "Assign materials and map elements to classification systems (e.g. Uniclass).",
            order: 14,
          },
          {
            id: 15,
            slug: "model-validation-and-quality-checks",
            title: "Model Validation and Quality Checks",
            description: "Run quality checks and validate the IFC model before deliverables.",
            order: 15,
          },
        ],
      },
      {
        id: 3,
        slug: "preparing-client-deliverables",
        title: "Module 3: Preparing Client Deliverables",
        order: 3,
        chapters: [
          {
            id: 16,
            slug: "floor-plans",
            title: "Floor Plans",
            description: "Generate annotated floor plans from the BIM model.",
            order: 16,
          },
          {
            id: 17,
            slug: "elevations",
            title: "Elevations",
            description: "Set up and annotate building elevations.",
            order: 17,
          },
          {
            id: 18,
            slug: "sections",
            title: "Sections",
            description: "Create building sections for client and construction review.",
            order: 18,
          },
          {
            id: 19,
            slug: "3d-views-and-perspectives",
            title: "3D Views and Perspectives",
            description: "Set up presentation-ready 3D views and perspective renders.",
            video: "/videos/bonsai/m3/3d-views.mp4",
            poster: "/videos/bonsai/m3/3d-views-poster.jpg",
            order: 19,
          },
          {
            id: 20,
            slug: "room-door-window-area-schedules",
            title: "Room, Door, Window, and Area Schedules",
            description: "Generate schedules for rooms, doors, windows, and areas directly from the model.",
            order: 20,
          },
          {
            id: 21,
            slug: "quantity-takeoffs-boq-basics",
            title: "Quantity Take-offs (BOQ Basics)",
            description: "Extract quantities from the model for a basic bill of quantities.",
            order: 21,
          },
          {
            id: 22,
            slug: "sheet-creation-and-annotations",
            title: "Sheet Creation and Annotations",
            description: "Lay out sheets and annotate drawings for issue.",
            order: 22,
          },
          {
            id: 23,
            slug: "ifc-export-and-openbim-deliverables",
            title: "IFC Export and OpenBIM Deliverables",
            description: "Export clean IFC deliverables for OpenBIM coordination.",
            order: 23,
          },
          {
            id: 24,
            slug: "model-revisions-and-final-submission",
            title: "Model Revisions and Final Project Submission",
            description: "Handle revision cycles and prepare the final project submission.",
            order: 24,
          },
        ],
      },
    ],
  },
];

export async function getCourses(): Promise<Course[]> {
  return COURSES;
}

export async function getCourseBySlug(slug: string): Promise<Course | undefined> {
  return COURSES.find((c) => c.slug === slug);
}

export function getAllChapters(course: Course): Chapter[] {
  return [...course.modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) => m.chapters)
    .sort((a, b) => a.order - b.order);
}

export function getChapterBySlug(
  course: Course,
  chapterSlug: string
): { chapter: Chapter; courseModule: Module } | undefined {
  for (const courseModule of course.modules) {
    const chapter = courseModule.chapters.find((ch) => ch.slug === chapterSlug);
    if (chapter) return { chapter, courseModule };
  }
  return undefined;
}

export function getAdjacentChapters(course: Course, currentChapter: Chapter) {
  const sorted = getAllChapters(course);
  const idx = sorted.findIndex((ch) => ch.id === currentChapter.id);
  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

export function totalChapterCount(course: Course): number {
  return course.modules.reduce((sum, m) => sum + m.chapters.length, 0);
}