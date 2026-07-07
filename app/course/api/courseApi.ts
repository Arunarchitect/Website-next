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
            completed: true,
            content: [
              { type: "heading", level: 2, text: "Why the brief comes first" },
              {
                type: "paragraph",
                runs: [
                  { type: "text", text: "Every project starts as a document, not a model. A " },
                  { type: "bold", text: "client brief" },
                  {
                    type: "text",
                    text: " is the client's own account of what they need — rooms, budget, site, timeline — and it is usually incomplete, contradictory, or written in language that has nothing to do with construction.",
                  },
                ],
              },
              {
                type: "paragraph",
                runs: [
                  { type: "text", text: "Your job in this stage is " },
                  { type: "highlight", text: "translation, not modeling" },
                  {
                    type: "text",
                    text: ": turning ambiguous requirements into a structured, checkable list before a single wall goes into BonsaiBIM.",
                  },
                  { type: "ref", refId: "riba-plan-of-work" },
                ],
              },
              { type: "heading", level: 3, text: "What a good brief actually contains" },
              {
                type: "list",
                items: [
                  [{ type: "text", text: "Spatial requirements — room list, adjacencies, approximate areas" }],
                  [{ type: "text", text: "Site constraints — orientation, access, boundary conditions" }],
                  [
                    { type: "text", text: "Budget and " },
                    { type: "italic", text: "quality" },
                    { type: "text", text: " expectations, which are often in tension" },
                  ],
                  [{ type: "text", text: "Regulatory context — local building codes, setbacks, FAR" }],
                  [{ type: "text", text: "Timeline and phasing expectations" }],
                ],
              },
              {
                type: "callout",
                variant: "tip",
                title: "Turn vague language into questions",
                runs: [
                  {
                    type: "text",
                    text: "\"Open and airy\" is not a spec. Convert it into questions you can actually answer: ceiling height, glazing ratio, cross-ventilation, sightlines between spaces.",
                  },
                ],
              },
              {
                type: "image",
                src: "/courses/bonsai-bim/m1/brief-annotation-example.jpg",
                alt: "A client brief document annotated with margin notes translating requirements into spatial data",
                caption:
                  "A marked-up brief: vague client language on the left, translated spatial requirements on the right.",
                source: "Illustration: Modelflick course materials.",
              },
              { type: "heading", level: 3, text: "Reading between the lines" },
              {
                type: "list",
                ordered: true,
                items: [
                  [{ type: "text", text: "List every explicit requirement, verbatim, before interpreting anything." }],
                  [{ type: "text", text: "Flag contradictions (e.g. budget vs. finish level) for clarification, don't resolve them yourself." }],
                  [
                    { type: "text", text: "Cross-check against " },
                    { type: "italic", text: "typical" },
                    { type: "text", text: " program areas for the building type" },
                    { type: "ref", refId: "neufert" },
                    { type: "text", text: " to catch omissions." },
                  ],
                  [{ type: "text", text: "Produce a one-page requirements summary the client signs off on before Module 1 continues." }],
                ],
              },
              {
                type: "callout",
                variant: "warning",
                title: "Don't let assumptions become requirements",
                runs: [
                  {
                    type: "text",
                    text: "Anything you infer from the brief should be labelled as an assumption in your summary — not silently folded into the design as if the client asked for it.",
                  },
                ],
              },
              { type: "divider" },
              {
                type: "paragraph",
                runs: [
                  {
                    type: "text",
                    text: "Next, you'll take this requirements summary and convert it into a functional space program with target areas — the direct input to your first BonsaiBIM space layout.",
                  },
                ],
              },
            ],
            references: [
              {
                id: "riba-plan-of-work",
                style: "apa",
                text: "RIBA. (2020). RIBA Plan of Work 2020 overview. Royal Institute of British Architects.",
                url: "https://www.architecture.com/knowledge-and-resources/resources-landing-page/riba-plan-of-work",
              },
              {
                id: "neufert",
                style: "mla",
                text: "Neufert, Ernst, and Peter Neufert. Architects' Data. 4th ed., Wiley-Blackwell, 2012.",
              },
            ],
          },
          {
            id: 2,
            slug: "space-requirements-functional-programming",
            title: "Space Requirements & Functional Programming",
            description: "Translate the brief into a functional space program.",
            order: 2,
            completed: true,
          },
          {
            id: 3,
            slug: "site-analysis",
            title: "Site Analysis (Orientation, Access, Terrain)",
            description: "Analyze site orientation, access points, and terrain constraints.",
            order: 3,
            completed: true,
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
            completed: true,
          },
          {
            id: 5,
            slug: "setting-up-bonsaibim-project",
            title: "Setting Up the BonsaiBIM Project",
            description: "Install and configure BonsaiBIM, and create a new IFC project.",
            video: "/videos/bonsai/m1/project-setup.mp4",
            poster: "/videos/bonsai/m1/project-setup-poster.jpg",
            order: 5,
            completed: true,
          },
          {
            id: 6,
            slug: "coordinate-system-project-origin",
            title: "Coordinate System & Project Origin",
            description: "Set true north, survey point, and project origin correctly.",
            order: 6,
            completed: true,
          },
          {
            id: 7,
            slug: "storeys-grids-project-organization",
            title: "Storeys, Grids & Project Organization",
            description: "Structure the project with storeys, grids, and a clean outliner hierarchy.",
            order: 7,
            completed: true,
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
            completed: true,
            content: [
              { type: "heading", level: 2, text: "Key terms from this lesson" },
              {
                type: "list",
                items: [
                  [
                    { type: "bold", text: "IFC (Industry Foundation Classes)" },
                    { type: "text", text: " — the open, vendor-neutral schema BonsaiBIM reads and writes" },
                    { type: "ref", refId: "buildingsmart-ifc" },
                    { type: "text", text: "." },
                  ],
                  [
                    { type: "bold", text: "Property set (Pset)" },
                    { type: "text", text: " — a named group of properties attached to an IFC entity, e.g. Pset_WallCommon." },
                  ],
                  [
                    { type: "bold", text: "Spatial structure" },
                    { type: "text", text: " — the Project → Site → Building → Storey → Space hierarchy every element sits inside." },
                  ],
                ],
              },
              {
                type: "callout",
                variant: "note",
                title: "Watch the video first",
                runs: [
                  {
                    type: "text",
                    text: "This section is a written reference to revisit after the walkthrough above — it isn't a substitute for it.",
                  },
                ],
              },
            ],
            references: [
              {
                id: "buildingsmart-ifc",
                style: "apa",
                text: "buildingSMART International. (2024). IFC4.3 documentation.",
                url: "https://ifc43-docs.standards.buildingsmart.org/",
              },
            ],
          },
          {
            id: 9,
            slug: "walls-slabs-roofs-ceilings",
            title: "Walls, Slabs, Roofs, and Ceilings",
            description: "Model the primary building envelope elements.",
            video: "/videos/bonsai/m2/walls-slabs-roofs.mp4",
            poster: "/videos/bonsai/m2/walls-slabs-roofs-poster.jpg",
            order: 9,
            completed: true,
          },
          {
            id: 10,
            slug: "doors-and-windows",
            title: "Doors and Windows",
            description: "Place parametric doors and windows and manage their properties.",
            order: 10,
            completed: true,
          },
          {
            id: 11,
            slug: "columns-beams-stairs",
            title: "Columns, Beams, and Stairs",
            description: "Model structural columns, beams, and stair assemblies.",
            order: 11,
            completed: true,
          },
          {
            id: 12,
            slug: "openings-and-voids",
            title: "Openings and Voids",
            description: "Create and manage openings and boolean voids in building elements.",
            order: 12,
            completed: false,
          },
          {
            id: 13,
            slug: "spaces-rooms-and-zoning",
            title: "Spaces (Rooms) and Zoning",
            description: "Define IFC spaces, assign zones, and organize rooms for area reporting.",
            order: 13,
            completed: false,
          },
          {
            id: 14,
            slug: "materials-and-classifications",
            title: "Materials and Classifications",
            description: "Assign materials and map elements to classification systems (e.g. Uniclass).",
            order: 14,
            completed: false,
          },
          {
            id: 15,
            slug: "model-validation-and-quality-checks",
            title: "Model Validation and Quality Checks",
            description: "Run quality checks and validate the IFC model before deliverables.",
            order: 15,
            completed: false,
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
            completed: false,
          },
          {
            id: 17,
            slug: "elevations",
            title: "Elevations",
            description: "Set up and annotate building elevations.",
            order: 17,
            completed: false,
          },
          {
            id: 18,
            slug: "sections",
            title: "Sections",
            description: "Create building sections for client and construction review.",
            order: 18,
            completed: false,
          },
          {
            id: 19,
            slug: "3d-views-and-perspectives",
            title: "3D Views and Perspectives",
            description: "Set up presentation-ready 3D views and perspective renders.",
            video: "/videos/bonsai/m3/3d-views.mp4",
            poster: "/videos/bonsai/m3/3d-views-poster.jpg",
            order: 19,
            completed: false,
          },
          {
            id: 20,
            slug: "room-door-window-area-schedules",
            title: "Room, Door, Window, and Area Schedules",
            description: "Generate schedules for rooms, doors, windows, and areas directly from the model.",
            order: 20,
            completed: false,
          },
          {
            id: 21,
            slug: "quantity-takeoffs-boq-basics",
            title: "Quantity Take-offs (BOQ Basics)",
            description: "Extract quantities from the model for a basic bill of quantities.",
            order: 21,
            completed: false,
          },
          {
            id: 22,
            slug: "sheet-creation-and-annotations",
            title: "Sheet Creation and Annotations",
            description: "Lay out sheets and annotate drawings for issue.",
            order: 22,
            completed: false,
          },
          {
            id: 23,
            slug: "ifc-export-and-openbim-deliverables",
            title: "IFC Export and OpenBIM Deliverables",
            description: "Export clean IFC deliverables for OpenBIM coordination.",
            order: 23,
            completed: false,
          },
          {
            id: 24,
            slug: "model-revisions-and-final-submission",
            title: "Model Revisions and Final Project Submission",
            description: "Handle revision cycles and prepare the final project submission.",
            order: 24,
            completed: false,
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