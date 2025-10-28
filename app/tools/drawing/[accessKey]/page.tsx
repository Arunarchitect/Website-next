"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Interfaces matching your Django models
interface Organisation {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  deliverables_count?: number;
}

interface Deliverable {
  id: number;
  name: string;
  description?: string;
  project: number;
  drawing_count?: number;
  drawings_count?: number;
}

interface Drawing {
  id: number;
  drawing_name: string;
  description?: string;
  original_file_type: "svg" | "png" | "pdf";
  status: string;
  created_at: string;
  updated_at: string;
  file_info?: {
    original?: {
      url?: string | null;
      type?: string;
    };
    svg?: {
      url?: string | null;
    };
    pdf?: {
      url?: string | null;
    };
    png?: {
      url?: string | null;
    };
  };
  available_files?: string[];
}

// API Response Interfaces
interface ProjectsResponse {
  organisation: Organisation;
  projects: Project[];
}

interface DeliverablesResponse {
  deliverables: Deliverable[];
  project: {
    id: number;
    name: string;
  };
}

interface DrawingsResponse {
  drawings: Drawing[];
  project: {
    id: number;
    name: string;
  };
  deliverable: {
    id: number;
    name: string;
  };
}

export default function DrawingViewerPage() {
  const router = useRouter();
  const params = useParams();
  
  // Get accessKey from URL params
  const urlAccessKey = params.accessKey as string;
  
  const [accessKey, setAccessKey] = useState(urlAccessKey || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Data states
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  // Base URL for API
  const API_BASE_URL = "http://localhost:8000";

  // If accessKey is provided in URL, automatically load projects
  useEffect(() => {
    if (urlAccessKey && urlAccessKey.trim()) {
      setAccessKey(urlAccessKey);
      fetchProjects(urlAccessKey);
    }
  }, [urlAccessKey]);

  // Fetch projects with deliverables count
  const fetchProjects = async (key: string) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drawings/public/access/${key}/projects/`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const data: ProjectsResponse = await response.json();
      
      // Debug log to see actual API response
      console.log('Projects API Response:', data);
      
      setOrganisation(data.organisation);
      setProjects(data.projects || []);
      setSelectedProject(null);
      setDeliverables([]);
      setSelectedDeliverable(null);
      setDrawings([]);

    } catch {
      setError("Invalid access key or failed to fetch projects");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch deliverables for selected project
  const fetchDeliverables = async (projectId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drawings/public/access/${accessKey}/projects/${projectId}/deliverables/`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch deliverables: ${response.status}`);
      }

      const data: DeliverablesResponse = await response.json();
      
      // Debug log to see actual API response
      console.log('Deliverables API Response:', data);
      
      setDeliverables(data.deliverables || []);
      setSelectedDeliverable(null);
      setDrawings([]);

    } catch {
      setError("Failed to fetch deliverables");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch drawings for selected deliverable
  const fetchDrawings = async (projectId: number, deliverableId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drawings/public/access/${accessKey}/projects/${projectId}/deliverables/${deliverableId}/drawings/`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch drawings: ${response.status}`);
      }

      const data: DrawingsResponse = await response.json();
      setDrawings(data.drawings || []);

    } catch {
      setError("Failed to fetch drawings");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle project selection
  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    fetchDeliverables(project.id);
  };

  // Handle deliverable selection
  const handleDeliverableSelect = (deliverable: Deliverable) => {
    setSelectedDeliverable(deliverable);
    if (selectedProject) {
      fetchDrawings(selectedProject.id, deliverable.id);
    }
  };

  // Check if file type is available for a drawing
  const isFileAvailable = (drawing: Drawing, fileType: string): boolean => {
    return drawing.available_files?.includes(fileType) ?? false;
  };

  // Handle view document - try PNG first, then PDF
  const handleViewDocument = async (drawing: Drawing) => {
    const hasPng = isFileAvailable(drawing, "png");
    const hasPdf = isFileAvailable(drawing, "pdf");

    if (hasPng) {
      const pngUrl = `${API_BASE_URL}/api/drawings/public/access/${accessKey}/files/png/${drawing.id}/`;
      window.open(pngUrl, "_blank");
    } else if (hasPdf) {
      const pdfUrl = `${API_BASE_URL}/api/drawings/public/access/${accessKey}/files/pdf/${drawing.id}/`;
      window.open(pdfUrl, "_blank");
    } else {
      alert(`No viewable document available for "${drawing.drawing_name}".`);
    }
  };

  // Handle download PDF
  const handleDownloadPdf = (drawing: Drawing) => {
    if (!isFileAvailable(drawing, "pdf")) {
      alert(`PDF not available for "${drawing.drawing_name}".`);
      return;
    }

    const pdfUrl = `${API_BASE_URL}/api/drawings/public/access/${accessKey}/files/pdf/${drawing.id}/`;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${drawing.drawing_name}.pdf`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle download SVG
  const handleDownloadSvg = (drawing: Drawing) => {
    if (!isFileAvailable(drawing, "svg")) {
      alert(`SVG not available for "${drawing.drawing_name}".`);
      return;
    }

    const svgUrl = `${API_BASE_URL}/api/drawings/public/access/${accessKey}/files/svg/${drawing.id}/`;
    const link = document.createElement("a");
    link.href = svgUrl;
    link.download = `${drawing.drawing_name}.svg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessKey.trim()) {
      fetchProjects(accessKey);
    } else {
      setError("Please enter an access key");
    }
  };

  // Reset and go back to main page
  const handleReset = () => {
    router.push("/tools/drawing");
    setAccessKey("");
    setOrganisation(null);
    setProjects([]);
    setSelectedProject(null);
    setDeliverables([]);
    setSelectedDeliverable(null);
    setDrawings([]);
    setError("");
  };

  // Get button styles based on availability
  const getButtonStyles = (isAvailable: boolean) => {
    const baseStyles = "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2";
    
    if (isAvailable) {
      return `${baseStyles} bg-blue-600 hover:bg-blue-700 text-white`;
    }
    
    return `${baseStyles} bg-gray-300 text-gray-500 cursor-not-allowed`;
  };

  const getDownloadPdfStyles = (isAvailable: boolean) => {
    const baseStyles = "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2";
    
    if (isAvailable) {
      return `${baseStyles} bg-green-600 hover:bg-green-700 text-white`;
    }
    
    return `${baseStyles} bg-gray-300 text-gray-500 cursor-not-allowed`;
  };

  const getDownloadSvgStyles = (isAvailable: boolean) => {
    const baseStyles = "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2";
    
    if (isAvailable) {
      return `${baseStyles} bg-purple-600 hover:bg-purple-700 text-white`;
    }
    
    return `${baseStyles} bg-gray-300 text-gray-500 cursor-not-allowed`;
  };

  // Get deliverable count for display - handle multiple possible field names
  const getDeliverableCount = (project: Project): number => {
    // Check all possible field names from API
    const count = project.deliverables_count || 0;
    console.log('Project deliverable count:', { project, count });
    return count;
  };

  // Get drawing count for deliverable - handle multiple possible field names
  const getDrawingCount = (deliverable: Deliverable): number => {
    // Check all possible field names from API
    const count = deliverable.drawing_count || deliverable.drawings_count || 0;
    console.log('Deliverable drawing count:', { deliverable, count });
    return count;
  };

  // Check if document is viewable (has PNG or PDF)
  const isDocumentViewable = (drawing: Drawing): boolean => {
    return isFileAvailable(drawing, "png") || isFileAvailable(drawing, "pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">Drawing Viewer</h1>
          <p className="text-gray-600 text-lg">Access and view your project drawings with secure access keys</p>
        </div>

        {/* Access Key Input - Only show if no access key in URL or no data loaded */}
        {(!urlAccessKey || (urlAccessKey && projects.length === 0 && !isLoading)) && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-8">
            <div className="flex items-center mb-5">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Enter Access Key</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter your access key"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      Access
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Organisation Info and Reset Button */}
        {organisation && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Organisation: {organisation.name}
                </h3>
                {urlAccessKey && (
                  <p className="text-sm text-gray-600 mt-1">
                    Access Key: {urlAccessKey}
                  </p>
                )}
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                New Access Key
              </button>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Select Project
            </h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project)}
                  className={`p-4 text-left rounded-lg border transition-all ${
                    selectedProject?.id === project.id
                      ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <h4 className="font-semibold text-gray-800 mb-1">{project.name}</h4>
                  <p className="text-sm text-gray-600">
                    {getDeliverableCount(project)} deliverable(s)
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Deliverables List - Show when project is selected */}
        {selectedProject && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Select Deliverable for {selectedProject.name}
            </h3>
            
            {deliverables.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p className="text-gray-600">Loading deliverables...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliverables.map((deliverable) => (
                  <button
                    key={deliverable.id}
                    onClick={() => handleDeliverableSelect(deliverable)}
                    className={`w-full p-4 text-left rounded-lg border transition-all ${
                      selectedDeliverable?.id === deliverable.id
                        ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">{deliverable.name}</h4>
                        {deliverable.description && (
                          <p className="text-sm text-gray-600">{deliverable.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {getDrawingCount(deliverable)} drawing(s) • Deliverable ID: {deliverable.id}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drawings List - Show when deliverable is selected */}
        {selectedDeliverable && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Documents for {selectedDeliverable.name}
            </h3>
            
            {drawings.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
                <p className="text-gray-600">Loading documents...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {drawings.map((drawing) => {
                  const hasPdf = isFileAvailable(drawing, "pdf");
                  const hasSvg = isFileAvailable(drawing, "svg");
                  const isViewable = isDocumentViewable(drawing);

                  return (
                    <div key={drawing.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">{drawing.drawing_name}</h4>
                          {drawing.description && (
                            <p className="text-sm text-gray-600 mb-2">{drawing.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Type: {drawing.original_file_type.toUpperCase()}</span>
                            <span>Status: {drawing.status}</span>
                            <span>
                              Created: {new Date(drawing.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {/* View Document Button - Always show but disabled if not viewable */}
                        <button
                          onClick={() => handleViewDocument(drawing)}
                          disabled={!isViewable}
                          className={getButtonStyles(isViewable)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Document
                        </button>

                        {/* Download PDF Button */}
                        <button
                          onClick={() => handleDownloadPdf(drawing)}
                          disabled={!hasPdf}
                          className={getDownloadPdfStyles(hasPdf)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download PDF
                        </button>

                        {/* Download SVG Button */}
                        <button
                          onClick={() => handleDownloadSvg(drawing)}
                          disabled={!hasSvg}
                          className={getDownloadSvgStyles(hasSvg)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Download SVG
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <span className="text-gray-600">Loading...</span>
            </div>
          </div>
        )}

        {/* Empty States */}
        {!isLoading && projects.length === 0 && organisation && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
            <p className="text-gray-500">There are no projects with drawings for this access key.</p>
          </div>
        )}
      </div>
    </div>
  );
}