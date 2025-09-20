// data.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Organisation {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  organisationId: string;
}

export interface ViewerFile {
  id: string;
  userId: string;
  organisationId: string;
  projectId: string;

  viewName: string;
  viewDate: string; // ISO string: "2025-09-20"

  file: string; // path to SVG in /public folder
  title: string;
  description?: string;

  tags?: string[]; // e.g. ["structure", "plan", "sections"]

  createdAt: string; // ISO timestamp
}

export interface ProjectAccessKey {
  id: string;
  organisationId: string;
  projectId: string;
  accessKey: string;
}

// -------------------
// Example dummy data
// -------------------

export const users: User[] = [
  { id: "u1", name: "Arun", email: "arun@example.com" },
];

export const organisations: Organisation[] = [
  { id: "org1", name: "Design Studio" },
];

export const projects: Project[] = [
  { id: "p1", name: "Mall Renovation", organisationId: "org1" },
];

export const svgFiles: ViewerFile[] = [
  {
    id: "f1",
    userId: "u1",
    organisationId: "org1",
    projectId: "p1",

    viewName: "Ground Floor Plan",
    viewDate: "2025-09-15",

    file: "sample.svg",
    title: "Ground Floor",
    description: "Main layout including lobby and shops",

    tags: ["plan", "structure", "sections"],

    createdAt: "2025-09-15T10:30:00Z",
  },
  {
    id: "f2",
    userId: "u1",
    organisationId: "org1",
    projectId: "p1",

    viewName: "Structural Section",
    viewDate: "2025-09-16",

    file: "logo.svg",
    title: "Building Section",
    description: "Cross-section showing structural details",

    tags: ["structure", "section"],

    createdAt: "2025-09-16T11:00:00Z",
  },
];

export const accessKeys: ProjectAccessKey[] = [
  {
    id: "ak1",
    organisationId: "org1",
    projectId: "p1",
    accessKey: "123", // mimic UUID short
  },
];
