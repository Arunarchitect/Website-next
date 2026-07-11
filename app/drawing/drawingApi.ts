// app/drawing/drawingApi.ts

import {
  Organisation,
  Project,
  Deliverable,
  DrawingDocument,
  DrawingDocumentResolved,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED DATA — mirrors Organisation → Project → Deliverable → Document
// ─────────────────────────────────────────────────────────────────────────────

const ORGANISATIONS: Organisation[] = [
  { id: 1, name: 'Elevate Design Studio' },
  { id: 2, name: 'Nimbus Architects' },
];

const PROJECTS: Project[] = [
  { id: 1, organisation_id: 1, name: 'Main Office Building', client_name: 'Kessler Group', location: 'Thiruvananthapuram' },
  { id: 2, organisation_id: 1, name: 'Residential Complex', client_name: 'Varma Estates', location: 'Kochi' },
  { id: 3, organisation_id: 2, name: 'Coastal Resort Phase 1', client_name: 'Blue Horizon Hospitality', location: 'Alappuzha' },
];

const DELIVERABLES: Deliverable[] = [
  { id: 1, project_id: 1, name: 'Floor Plans Package', stage: '2', status: 'ready' },
  { id: 2, project_id: 1, name: 'Electrical Package', stage: '3', status: 'ongoing' },
  { id: 3, project_id: 1, name: 'HVAC & Mechanical Package', stage: '3', status: 'not_started' },
  { id: 4, project_id: 1, name: 'Plumbing Package', stage: '3', status: 'passed' },
  { id: 5, project_id: 2, name: 'Structural Package', stage: '2', status: 'passed' },
  { id: 6, project_id: 2, name: 'Site Development Package', stage: '1', status: 'ongoing' },
  { id: 7, project_id: 2, name: 'Fire & Life Safety Package', stage: '4', status: 'discrepancy' },
  { id: 8, project_id: 3, name: 'Interior Design Package', stage: '2', status: 'ongoing' },
];

const HARDCODED_DOCUMENTS: DrawingDocument[] = [
  {
    id: 1,
    deliverable_id: 1,
    title: 'Floor Plan - Level 01',
    description: 'Architectural floor plan showing room layouts and dimensions for level 01',
    file_type: 'image',
    file_url: '/drawing/image/test.jpg',
    thumbnail_url: '/drawing/image/test.jpg',
    uploaded_at: '2026-07-10T10:30:00Z',
    uploaded_by: 'John Architect',
    category: 'Architectural',
    size: 2457600,
    is_favorite: true,
    tags: ['floor plan', 'architectural', 'level 01'],
    version: 'v2.1',
    status: 'published',
    file_path: '/drawing/image/test.jpg',
  },
  {
    id: 2,
    deliverable_id: 2,
    title: 'Electrical Schematic - Panel B',
    description: 'Electrical distribution schematic for panel B, including load calculations',
    file_type: 'pdf',
    file_url: '/drawing/doc/test.pdf',
    uploaded_at: '2026-07-09T14:15:00Z',
    uploaded_by: 'Sarah Electrical',
    category: 'Electrical',
    size: 1254400,
    is_favorite: false,
    tags: ['electrical', 'schematic', 'panel B'],
    version: 'v1.0',
    status: 'published',
    file_path: '/drawing/doc/test.pdf',
  },
  {
    id: 3,
    deliverable_id: 5,
    title: 'Structural Details - Foundation',
    description: 'Structural drawings showing foundation details and reinforcement',
    file_type: 'image',
    file_url: '/drawing/image/test.jpg',
    thumbnail_url: '/drawing/image/test.jpg',
    uploaded_at: '2026-07-08T09:00:00Z',
    uploaded_by: 'Mike Structural',
    category: 'Structural',
    size: 3123200,
    is_favorite: true,
    tags: ['structural', 'foundation', 'reinforcement'],
    version: 'v3.0',
    status: 'published',
    file_path: '/drawing/image/test.jpg',
  },
  {
    id: 4,
    deliverable_id: 3,
    title: 'HVAC Layout - Floor 02',
    description: 'HVAC duct layout and equipment placement for second floor',
    file_type: 'pdf',
    file_url: '/drawing/doc/test.pdf',
    uploaded_at: '2026-07-07T16:45:00Z',
    uploaded_by: 'Tom HVAC',
    category: 'Mechanical',
    size: 987600,
    is_favorite: false,
    tags: ['hvac', 'duct layout', 'mechanical'],
    version: 'v1.1',
    status: 'draft',
    file_path: '/drawing/doc/test.pdf',
  },
  {
    id: 5,
    deliverable_id: 6,
    title: 'Site Plan - Overall',
    description: 'Comprehensive site plan including buildings, parking, and landscape',
    file_type: 'image',
    file_url: '/drawing/image/test.jpg',
    thumbnail_url: '/drawing/image/test.jpg',
    uploaded_at: '2026-07-06T11:20:00Z',
    uploaded_by: 'Lisa Landscape',
    category: 'Site Plan',
    size: 4568000,
    is_favorite: true,
    tags: ['site plan', 'landscape', 'overall'],
    version: 'v4.2',
    status: 'published',
    file_path: '/drawing/image/test.jpg',
  },
  {
    id: 6,
    deliverable_id: 4,
    title: 'Plumbing Riser Diagram',
    description: 'Vertical plumbing riser diagram showing all fixtures and connections',
    file_type: 'pdf',
    file_url: '/drawing/doc/test.pdf',
    uploaded_at: '2026-07-05T13:30:00Z',
    uploaded_by: 'Dave Plumbing',
    category: 'Plumbing',
    size: 876500,
    is_favorite: false,
    tags: ['plumbing', 'riser diagram'],
    version: 'v1.0',
    status: 'published',
    file_path: '/drawing/doc/test.pdf',
  },
  {
    id: 7,
    deliverable_id: 8,
    title: 'Interior Elevations - Lobby',
    description: 'Interior elevation drawings for main lobby area',
    file_type: 'image',
    file_url: '/drawing/image/test.jpg',
    thumbnail_url: '/drawing/image/test.jpg',
    uploaded_at: '2026-07-04T08:50:00Z',
    uploaded_by: 'Emma Interior',
    category: 'Interior',
    size: 2340000,
    is_favorite: false,
    tags: ['interior', 'elevations', 'lobby'],
    version: 'v2.0',
    status: 'published',
    file_path: '/drawing/image/test.jpg',
  },
  {
    id: 8,
    deliverable_id: 7,
    title: 'Fire Protection Layout',
    description: 'Fire sprinkler system layout and alarm device placement',
    file_type: 'pdf',
    file_url: '/drawing/doc/test.pdf',
    uploaded_at: '2026-07-03T15:10:00Z',
    uploaded_by: 'Frank Safety',
    category: 'Safety',
    size: 1120000,
    is_favorite: false,
    tags: ['fire protection', 'sprinkler', 'safety'],
    version: 'v1.2',
    status: 'archived',
    file_path: '/drawing/doc/test.pdf',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getProjectById = (id: number) => PROJECTS.find((p) => p.id === id);
const getOrgById = (id: number) => ORGANISATIONS.find((o) => o.id === id);
const getDeliverableById = (id: number) => DELIVERABLES.find((d) => d.id === id);

/** Joins a raw document up through deliverable → project → organisation */
const resolveDocument = (doc: DrawingDocument): DrawingDocumentResolved | null => {
  const deliverable = getDeliverableById(doc.deliverable_id);
  if (!deliverable) return null;
  const project = getProjectById(deliverable.project_id);
  if (!project) return null;
  const organisation = getOrgById(project.organisation_id);
  if (!organisation) return null;

  return {
    ...doc,
    deliverable_name: deliverable.name,
    project_id: project.id,
    project_name: project.name,
    organisation_id: organisation.id,
    organisation_name: organisation.name,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS (hardcoded, no network calls)
// ─────────────────────────────────────────────────────────────────────────────

export const getOrganisations = async (): Promise<Organisation[]> => {
  await new Promise((r) => setTimeout(r, 100));
  return ORGANISATIONS;
};

export const getProjects = async (organisationId?: number): Promise<Project[]> => {
  await new Promise((r) => setTimeout(r, 100));
  if (!organisationId) return PROJECTS;
  return PROJECTS.filter((p) => p.organisation_id === organisationId);
};

export const getDeliverables = async (projectId?: number): Promise<Deliverable[]> => {
  await new Promise((r) => setTimeout(r, 100));
  if (!projectId) return DELIVERABLES;
  return DELIVERABLES.filter((d) => d.project_id === projectId);
};

export interface DocumentFilters {
  organisationId?: number;
  projectId?: number;
  deliverableId?: number;
  search?: string;
}

export const getDocuments = async (
  filters: DocumentFilters = {}
): Promise<DrawingDocumentResolved[]> => {
  await new Promise((r) => setTimeout(r, 300));

  const resolved = HARDCODED_DOCUMENTS
    .map(resolveDocument)
    .filter((d): d is DrawingDocumentResolved => d !== null);

  return resolved.filter((doc) => {
    if (filters.organisationId && doc.organisation_id !== filters.organisationId) return false;
    if (filters.projectId && doc.project_id !== filters.projectId) return false;
    if (filters.deliverableId && doc.deliverable_id !== filters.deliverableId) return false;

    if (filters.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      const haystack = [
        doc.title,
        doc.description,
        doc.deliverable_name,
        doc.project_name,
        doc.organisation_name,
        doc.category,
        ...doc.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
};

export const toggleFavorite = async (id: number): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 100));
  const doc = HARDCODED_DOCUMENTS.find((d) => d.id === id);
  if (doc) {
    doc.is_favorite = !doc.is_favorite;
    return doc.is_favorite;
  }
  return false;
};

export const downloadDocument = async (doc: DrawingDocument): Promise<void> => {
  const url = doc.file_path || doc.file_url;
  if (!url) throw new Error('No file available to download');

  const link = document.createElement('a');
  link.href = url;
  link.download = doc.title + (doc.file_type === 'pdf' ? '.pdf' : '.png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};