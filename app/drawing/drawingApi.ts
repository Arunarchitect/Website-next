// app/drawing/drawingApi.ts
// app/main/client/documentsApi.ts

import axios from 'axios';
import { DrawingDocument, DocumentCategory } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const token = 
    localStorage.getItem('access') || 
    localStorage.getItem('access_token') || 
    localStorage.getItem('token') || 
    sessionStorage.getItem('access') || 
    sessionStorage.getItem('access_token') || 
    null;

  return token;
};

// Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ [DocumentsApi] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED DATA WITH LOCAL FILES
// ─────────────────────────────────────────────────────────────────────────────

const HARDCODED_DOCUMENTS: DrawingDocument[] = [
  {
    id: 1,
    title: 'Floor Plan - Level 01',
    description: 'Architectural floor plan showing room layouts and dimensions for level 01',
    file_type: 'image',
    file_url: '/dwg/test.png',
    thumbnail_url: '/dwg/test.png',
    uploaded_at: '2026-07-10T10:30:00Z',
    uploaded_by: 'John Architect',
    project_name: 'Main Office Building',
    category: 'Architectural',
    size: 2457600,
    is_favorite: true,
    tags: ['floor plan', 'architectural', 'level 01'],
    version: 'v2.1',
    status: 'published',
    file_path: '/dwg/test.png'
  },
  {
    id: 2,
    title: 'Electrical Schematic - Panel B',
    description: 'Electrical distribution schematic for panel B, including load calculations',
    file_type: 'pdf',
    file_url: '/doc/test.pdf',
    thumbnail_url: '/doc/test.pdf',
    uploaded_at: '2026-07-09T14:15:00Z',
    uploaded_by: 'Sarah Electrical',
    project_name: 'Main Office Building',
    category: 'Electrical',
    size: 1254400,
    is_favorite: false,
    tags: ['electrical', 'schematic', 'panel B'],
    version: 'v1.0',
    status: 'published',
    file_path: '/doc/test.pdf'
  },
  {
    id: 3,
    title: 'Structural Details - Foundation',
    description: 'Structural drawings showing foundation details and reinforcement',
    file_type: 'image',
    file_url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400',
    uploaded_at: '2026-07-08T09:00:00Z',
    uploaded_by: 'Mike Structural',
    project_name: 'Residential Complex',
    category: 'Structural',
    size: 3123200,
    is_favorite: true,
    tags: ['structural', 'foundation', 'reinforcement'],
    version: 'v3.0',
    status: 'published'
  },
  {
    id: 4,
    title: 'HVAC Layout - Floor 02',
    description: 'HVAC duct layout and equipment placement for second floor',
    file_type: 'pdf',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    thumbnail_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    uploaded_at: '2026-07-07T16:45:00Z',
    uploaded_by: 'Tom HVAC',
    project_name: 'Main Office Building',
    category: 'Mechanical',
    size: 987600,
    is_favorite: false,
    tags: ['hvac', 'duct layout', 'mechanical'],
    version: 'v1.1',
    status: 'draft'
  },
  {
    id: 5,
    title: 'Site Plan - Overall',
    description: 'Comprehensive site plan including buildings, parking, and landscape',
    file_type: 'image',
    file_url: 'https://images.unsplash.com/photo-1570168007204-db4f1f3d7d32?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1570168007204-db4f1f3d7d32?w=400',
    uploaded_at: '2026-07-06T11:20:00Z',
    uploaded_by: 'Lisa Landscape',
    project_name: 'Residential Complex',
    category: 'Site Plan',
    size: 4568000,
    is_favorite: true,
    tags: ['site plan', 'landscape', 'overall'],
    version: 'v4.2',
    status: 'published'
  },
  {
    id: 6,
    title: 'Plumbing Riser Diagram',
    description: 'Vertical plumbing riser diagram showing all fixtures and connections',
    file_type: 'pdf',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    thumbnail_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    uploaded_at: '2026-07-05T13:30:00Z',
    uploaded_by: 'Dave Plumbing',
    project_name: 'Main Office Building',
    category: 'Plumbing',
    size: 876500,
    is_favorite: false,
    tags: ['plumbing', 'riser diagram'],
    version: 'v1.0',
    status: 'published'
  },
  {
    id: 7,
    title: 'Interior Elevations - Lobby',
    description: 'Interior elevation drawings for main lobby area',
    file_type: 'image',
    file_url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800',
    thumbnail_url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=400',
    uploaded_at: '2026-07-04T08:50:00Z',
    uploaded_by: 'Emma Interior',
    project_name: 'Main Office Building',
    category: 'Interior',
    size: 2340000,
    is_favorite: false,
    tags: ['interior', 'elevations', 'lobby'],
    version: 'v2.0',
    status: 'published'
  },
  {
    id: 8,
    title: 'Fire Protection Layout',
    description: 'Fire sprinkler system layout and alarm device placement',
    file_type: 'pdf',
    file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    thumbnail_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    uploaded_at: '2026-07-03T15:10:00Z',
    uploaded_by: 'Frank Safety',
    project_name: 'Residential Complex',
    category: 'Safety',
    size: 1120000,
    is_favorite: false,
    tags: ['fire protection', 'sprinkler', 'safety'],
    version: 'v1.2',
    status: 'archived'
  }
];

const CATEGORIES: DocumentCategory[] = [
  { id: 'all', name: 'All Documents', icon: 'ti-files', count: 8 },
  { id: 'architectural', name: 'Architectural', icon: 'ti-building-arch', count: 2 },
  { id: 'structural', name: 'Structural', icon: 'ti-columns', count: 1 },
  { id: 'electrical', name: 'Electrical', icon: 'ti-bolt', count: 1 },
  { id: 'mechanical', name: 'Mechanical', icon: 'ti-settings', count: 1 },
  { id: 'plumbing', name: 'Plumbing', icon: 'ti-droplet', count: 1 },
  { id: 'interior', name: 'Interior', icon: 'ti-armchair', count: 1 },
  { id: 'site-plan', name: 'Site Plan', icon: 'ti-map', count: 1 },
  { id: 'safety', name: 'Safety', icon: 'ti-shield', count: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS (using hardcoded data for now)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all drawings and documents
 */
export const getDocuments = async (category?: string, search?: string): Promise<DrawingDocument[]> => {
  try {
    console.log('🔄 [DocumentsApi] Fetching documents...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let filtered = [...HARDCODED_DOCUMENTS];
    
    // Filter by category
    if (category && category !== 'all') {
      filtered = filtered.filter(doc => 
        doc.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Filter by search term
    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(term) ||
        doc.description.toLowerCase().includes(term) ||
        doc.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    console.log(`✅ [DocumentsApi] Found ${filtered.length} documents`);
    return filtered;
    
  } catch (error) {
    console.error('❌ [DocumentsApi] Error fetching documents:', error);
    return [];
  }
};

/**
 * Get document categories
 */
export const getDocumentCategories = async (): Promise<DocumentCategory[]> => {
  try {
    console.log('🔄 [DocumentsApi] Fetching categories...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update counts based on actual documents
    const categories = CATEGORIES.map(cat => {
      if (cat.id === 'all') {
        return { ...cat, count: HARDCODED_DOCUMENTS.length };
      }
      const count = HARDCODED_DOCUMENTS.filter(
        doc => doc.category.toLowerCase() === cat.name.toLowerCase()
      ).length;
      return { ...cat, count };
    });
    
    console.log(`✅ [DocumentsApi] Found ${categories.length} categories`);
    return categories;
    
  } catch (error) {
    console.error('❌ [DocumentsApi] Error fetching categories:', error);
    return CATEGORIES;
  }
};

/**
 * Get a single document by ID
 */
export const getDocumentById = async (id: number): Promise<DrawingDocument | null> => {
  try {
    console.log(`🔄 [DocumentsApi] Fetching document ${id}...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const doc = HARDCODED_DOCUMENTS.find(d => d.id === id) || null;
    
    if (doc) {
      console.log(`✅ [DocumentsApi] Found document: ${doc.title}`);
    } else {
      console.warn(`⚠️ [DocumentsApi] Document ${id} not found`);
    }
    
    return doc;
    
  } catch (error) {
    console.error(`❌ [DocumentsApi] Error fetching document ${id}:`, error);
    return null;
  }
};

/**
 * Toggle favorite status
 */
export const toggleFavorite = async (id: number): Promise<boolean> => {
  try {
    console.log(`🔄 [DocumentsApi] Toggling favorite for ${id}...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const doc = HARDCODED_DOCUMENTS.find(d => d.id === id);
    if (doc) {
      doc.is_favorite = !doc.is_favorite;
      console.log(`✅ [DocumentsApi] Favorite toggled: ${doc.is_favorite}`);
      return doc.is_favorite;
    }
    
    return false;
    
  } catch (error) {
    console.error(`❌ [DocumentsApi] Error toggling favorite:`, error);
    return false;
  }
};

/**
 * Upload a document (placeholder)
 */
export const uploadDocument = async (file: File, metadata: any): Promise<DrawingDocument | null> => {
  try {
    console.log('🔄 [DocumentsApi] Uploading document...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create a new document entry
    const newDoc: DrawingDocument = {
      id: HARDCODED_DOCUMENTS.length + 1,
      title: metadata.title || 'Untitled Document',
      description: metadata.description || '',
      file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
      file_url: URL.createObjectURL(file),
      thumbnail_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'Current User',
      project_name: metadata.project_name || 'Unassigned',
      category: metadata.category || 'General',
      size: file.size,
      is_favorite: false,
      tags: metadata.tags?.split(',').map((t: string) => t.trim()) || [],
      version: 'v1.0',
      status: 'draft'
    };
    
    HARDCODED_DOCUMENTS.push(newDoc);
    console.log(`✅ [DocumentsApi] Document uploaded: ${newDoc.title}`);
    return newDoc;
    
  } catch (error) {
    console.error('❌ [DocumentsApi] Error uploading document:', error);
    return null;
  }
};

/**
 * Download document
 */
export const downloadDocument = async (doc: DrawingDocument): Promise<void> => {
  try {
    console.log(`🔄 [DocumentsApi] Downloading ${doc.title}...`);
    
    // For local files, open in new window or trigger download
    if (doc.file_path) {
      // Create a download link for local files
      const link = document.createElement('a');
      link.href = doc.file_path;
      link.download = doc.title + (doc.file_type === 'pdf' ? '.pdf' : '.png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (doc.file_url) {
      // For external URLs, open in new window
      window.open(doc.file_url, '_blank');
    } else {
      throw new Error('No file URL available');
    }
    
    console.log(`✅ [DocumentsApi] Document download initiated`);
    
  } catch (error) {
    console.error('❌ [DocumentsApi] Error downloading document:', error);
    throw error;
  }
};