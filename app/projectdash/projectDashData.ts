// ---------------------------------------------------------------------------
// projectDashData.ts
// Extended project data for the Project Dashboard prototype.
// Swap the hardcoded arrays with fetch() calls when connecting a backend.
// ---------------------------------------------------------------------------

export type ProjectStatus = "Active" | "On Hold" | "Completed" | "Cancelled";
export type DeliverableStatus = "Not Started" | "In Progress" | "Review" | "Done";

export interface Client {
  name: string;
  contact: string;       // email or phone
  location: string;      // city, country
}

export interface DeliverableItem {
  id: string;
  name: string;
  assignedTo: string;    // user name
  status: DeliverableStatus;
  dueDate: string;       // ISO date string "YYYY-MM-DD"
  hoursLogged: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  organisation: string;
  status: ProjectStatus;
  client: Client;
  startDate: string;     // ISO date string
  endDate: string;       // ISO date string
  revenue: number;       // in INR
  currency: string;
  description: string;
  tags: string[];
  deliverables: DeliverableItem[];
  teamMembers: string[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const projectDetails: ProjectDetail[] = [
  {
    id: "proj-1",
    name: "Sunilkumar Residence",
    organisation: "Sunilkumar Associates",
    status: "Active",
    client: {
      name: "Sunil Kumar",
      contact: "sunil@example.com",
      location: "Thiruvananthapuram, Kerala",
    },
    startDate: "2025-01-10",
    endDate: "2025-08-31",
    revenue: 1850000,
    currency: "INR",
    description:
      "Design and documentation for a 3-bedroom luxury residence including landscaping, interior layouts, and structural drawings.",
    tags: ["Residential", "Luxury", "Kerala"],
    teamMembers: ["Arun Ravikumar", "Meera Nair", "Jithin Thomas"],
    deliverables: [
      {
        id: "del-1",
        name: "Floor Plan",
        assignedTo: "Arun Ravikumar",
        status: "Done",
        dueDate: "2025-02-28",
        hoursLogged: 18,
      },
      {
        id: "del-2",
        name: "Elevation Drawing",
        assignedTo: "Arun Ravikumar",
        status: "In Progress",
        dueDate: "2025-04-15",
        hoursLogged: 9,
      },
      {
        id: "del-3a",
        name: "Landscape Plan",
        assignedTo: "Meera Nair",
        status: "Not Started",
        dueDate: "2025-06-01",
        hoursLogged: 0,
      },
      {
        id: "del-3b",
        name: "Interior Layout",
        assignedTo: "Jithin Thomas",
        status: "Review",
        dueDate: "2025-05-10",
        hoursLogged: 22,
      },
    ],
  },
  {
    id: "proj-2",
    name: "Test Office Block",
    organisation: "Test Corp",
    status: "On Hold",
    client: {
      name: "Rajesh Menon",
      contact: "+91 98765 43210",
      location: "Kochi, Kerala",
    },
    startDate: "2024-11-01",
    endDate: "2025-06-30",
    revenue: 3200000,
    currency: "INR",
    description:
      "Commercial office block — 6 floors, open-plan with modular workstations. Structural, MEP, and façade documentation.",
    tags: ["Commercial", "Office", "MEP"],
    teamMembers: ["Arun Ravikumar", "Priya Krishnan"],
    deliverables: [
      {
        id: "del-3",
        name: "Site Layout",
        assignedTo: "Arun Ravikumar",
        status: "Done",
        dueDate: "2024-12-15",
        hoursLogged: 30,
      },
      {
        id: "del-4",
        name: "Structural Report",
        assignedTo: "Priya Krishnan",
        status: "In Progress",
        dueDate: "2025-03-30",
        hoursLogged: 14,
      },
      {
        id: "del-4b",
        name: "MEP Drawings",
        assignedTo: "Priya Krishnan",
        status: "Not Started",
        dueDate: "2025-05-15",
        hoursLogged: 0,
      },
    ],
  },
  {
    id: "proj-3",
    name: "Greenfield Mall",
    organisation: "Greenfield Ltd",
    status: "Active",
    client: {
      name: "Greenfield Developers",
      contact: "projects@greenfield.in",
      location: "Bangalore, Karnataka",
    },
    startDate: "2025-02-01",
    endDate: "2026-03-31",
    revenue: 8750000,
    currency: "INR",
    description:
      "Large-format retail mall — 3 levels, 120 tenants. Full architectural, structural, and interior design package.",
    tags: ["Retail", "Large-scale", "Interior"],
    teamMembers: ["Arun Ravikumar", "Meera Nair", "Deepak Pillai", "Asha Varma"],
    deliverables: [
      {
        id: "del-5",
        name: "3D Render",
        assignedTo: "Arun Ravikumar",
        status: "In Progress",
        dueDate: "2025-04-30",
        hoursLogged: 11,
      },
      {
        id: "del-6",
        name: "Tenant Layout Plan",
        assignedTo: "Meera Nair",
        status: "Not Started",
        dueDate: "2025-07-01",
        hoursLogged: 0,
      },
      {
        id: "del-7",
        name: "Façade Design",
        assignedTo: "Deepak Pillai",
        status: "Not Started",
        dueDate: "2025-08-15",
        hoursLogged: 0,
      },
      {
        id: "del-8",
        name: "Interior Concept",
        assignedTo: "Asha Varma",
        status: "Review",
        dueDate: "2025-05-20",
        hoursLogged: 28,
      },
    ],
  },
  {
    id: "proj-4",
    name: "Horizon Villa Complex",
    organisation: "Horizon Builders",
    status: "Completed",
    client: {
      name: "Horizon Builders Pvt Ltd",
      contact: "info@horizonbuilders.com",
      location: "Kozhikode, Kerala",
    },
    startDate: "2024-03-01",
    endDate: "2024-12-31",
    revenue: 5100000,
    currency: "INR",
    description:
      "Cluster of 8 premium villas with shared amenities — pool, gym, and landscaped gardens. Full documentation delivered.",
    tags: ["Residential", "Villa", "Completed"],
    teamMembers: ["Arun Ravikumar", "Jithin Thomas"],
    deliverables: [
      {
        id: "del-9",
        name: "Master Site Plan",
        assignedTo: "Arun Ravikumar",
        status: "Done",
        dueDate: "2024-05-01",
        hoursLogged: 35,
      },
      {
        id: "del-10",
        name: "Villa Floor Plans",
        assignedTo: "Jithin Thomas",
        status: "Done",
        dueDate: "2024-07-01",
        hoursLogged: 48,
      },
      {
        id: "del-11",
        name: "Landscape & Pool",
        assignedTo: "Arun Ravikumar",
        status: "Done",
        dueDate: "2024-10-01",
        hoursLogged: 20,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function searchProjects(query: string): ProjectDetail[] {
  const q = query.toLowerCase().trim();
  if (!q) return projectDetails;
  return projectDetails.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.organisation.toLowerCase().includes(q) ||
      p.client.name.toLowerCase().includes(q) ||
      p.client.location.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000)   return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const STATUS_COLOR: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: "#e8f5e9", text: "#2e7d32", dot: "#43a047" },
  "On Hold": { bg: "#fff8e1", text: "#f57f17", dot: "#ffc107" },
  Completed: { bg: "#e3f2fd", text: "#1565c0", dot: "#42a5f5" },
  Cancelled: { bg: "#fce4ec", text: "#b71c1c", dot: "#ef5350" },
};

export const DELIVERABLE_STATUS_COLOR: Record<DeliverableStatus, { bg: string; text: string }> = {
  "Not Started": { bg: "#f5f5f5",  text: "#757575" },
  "In Progress": { bg: "#fff3e0",  text: "#e65100" },
  Review:        { bg: "#f3e5f5",  text: "#6a1b9a" },
  Done:          { bg: "#e8f5e9",  text: "#2e7d32" },
};

/**
 * When moving to a backend, replace with:
 *
 *   export async function fetchProjectDetails(): Promise<ProjectDetail[]> {
 *     const res = await fetch("/api/projects");
 *     return res.json();
 *   }
 */