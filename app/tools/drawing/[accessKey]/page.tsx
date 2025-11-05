"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useDrawingViewer } from "../hooks/useDrawingViewer";
import { Drawing } from "../types";
import { AccessKeyForm } from "../components/AccessKeyForm";
import { OrganisationHeader } from "../components/OrganisationHeader";
import { ProjectsGrid } from "../components/ProjectsGrid";
import { DeliverablesList } from "../components/DeliverablesList";
import { DrawingsList } from "../components/DrawingsList";
import { Spinner } from "../components/LoadingState";
import { ImageViewer } from "../components/ImageViewer";

const API_BASE_URL = "http://localhost:8000/api/drawings";

export default function DrawingViewerPage() {
  const router = useRouter();
  const params = useParams();
  const urlAccessKey = params.accessKey as string;

  const {
    state,
    updateState,
    fetchProjects,
    fetchDeliverables,
    fetchDrawings,
  } = useDrawingViewer(urlAccessKey || "");

  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
  }>({
    isOpen: false,
    imageUrl: '',
    title: ''
  });

  // Auto-load projects if access key is in URL
  useEffect(() => {
    if (urlAccessKey && urlAccessKey.trim()) {
      updateState({ accessKey: urlAccessKey });
      fetchProjects(urlAccessKey);
    }
  }, [urlAccessKey, updateState, fetchProjects]);

  const isFileAvailable = useCallback((drawing: Drawing, fileType: string): boolean =>
    drawing.available_files?.includes(fileType) ?? false, []);

  const handleProjectSelect = useCallback((project: { id: number }) => {
    updateState({ selectedProject: project });
    fetchDeliverables(project.id);
  }, [updateState, fetchDeliverables]);

  const handleDeliverableSelect = useCallback((deliverable: { id: number }) => {
    updateState({ selectedDeliverable: deliverable });
    if (state.selectedProject) {
      fetchDrawings(state.selectedProject.id, deliverable.id);
    }
  }, [state.selectedProject, updateState, fetchDrawings]);

  const openImageViewer = (imageUrl: string, title: string) => {
    setViewerState({
      isOpen: true,
      imageUrl,
      title
    });
  };

  const closeImageViewer = () => {
    setViewerState({
      isOpen: false,
      imageUrl: '',
      title: ''
    });
  };

  const handleViewDocument = useCallback((drawing: Drawing) => {
    const hasPng = isFileAvailable(drawing, "png");
    const hasPdf = isFileAvailable(drawing, "pdf");

    if (hasPng) {
      const pngUrl = `${API_BASE_URL}/public/access/${state.accessKey}/files/png/${drawing.id}/`;
      // Open in our custom image viewer
      openImageViewer(pngUrl, drawing.drawing_name);
    } else if (hasPdf) {
      const pdfUrl = `${API_BASE_URL}/public/access/${state.accessKey}/files/pdf/${drawing.id}/`;
      // For PDFs, still open in new tab since we can't display PDFs in our viewer
      window.open(pdfUrl, "_blank");
    } else {
      alert(`No viewable document available for "${drawing.drawing_name}".`);
    }
  }, [state.accessKey, isFileAvailable]);

  const handleDownloadPdf = useCallback((drawing: Drawing) => {
    if (!isFileAvailable(drawing, "pdf")) {
      alert(`PDF not available for "${drawing.drawing_name}".`);
      return;
    }

    const pdfUrl = `${API_BASE_URL}/public/access/${state.accessKey}/files/pdf/${drawing.id}/`;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${drawing.drawing_name}.pdf`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.accessKey, isFileAvailable]);

  const handleDownloadSvg = useCallback((drawing: Drawing) => {
    if (!isFileAvailable(drawing, "svg")) {
      alert(`SVG not available for "${drawing.drawing_name}".`);
      return;
    }

    const svgUrl = `${API_BASE_URL}/public/access/${state.accessKey}/files/svg/${drawing.id}/`;
    const link = document.createElement("a");
    link.href = svgUrl;
    link.download = `${drawing.drawing_name}.svg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [state.accessKey, isFileAvailable]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (state.accessKey.trim()) {
      fetchProjects(state.accessKey);
    } else {
      updateState({ error: "Please enter an access key" });
    }
  }, [state.accessKey, fetchProjects, updateState]);

  const handleReset = useCallback(() => {
    router.push("/tools/drawing");
    updateState({
      accessKey: "",
      organisation: null,
      projects: [],
      selectedProject: null,
      deliverables: [],
      selectedDeliverable: null,
      drawings: [],
      error: "",
    });
  }, [router, updateState]);

  const handleAccessKeyChange = useCallback((value: string) => {
    updateState({ accessKey: value });
  }, [updateState]);

  // Render conditions
  const showAccessKeyForm = !urlAccessKey || (urlAccessKey && state.projects.length === 0 && !state.isLoading);
  const showEmptyState = !state.isLoading && state.projects.length === 0 && state.organisation;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">Drawing Viewer</h1>
          <p className="text-gray-600 text-lg">Access and view your project drawings with secure access keys</p>
        </div>

        {/* Access Key Form */}
        {showAccessKeyForm && (
          <AccessKeyForm
            accessKey={state.accessKey}
            isLoading={state.isLoading}
            error={state.error}
            onSubmit={handleSubmit}
            onAccessKeyChange={handleAccessKeyChange}
          />
        )}

        {/* Organisation Info */}
        {state.organisation && (
          <OrganisationHeader
            organisation={state.organisation}
            accessKey={urlAccessKey}
            onReset={handleReset}
          />
        )}

        {/* Projects Grid */}
        {state.projects.length > 0 && (
          <ProjectsGrid
            projects={state.projects}
            selectedProject={state.selectedProject}
            onProjectSelect={handleProjectSelect}
          />
        )}

        {/* Deliverables List */}
        {state.selectedProject && (
          <DeliverablesList
            deliverables={state.deliverables}
            selectedDeliverable={state.selectedDeliverable}
            selectedProject={state.selectedProject}
            onDeliverableSelect={handleDeliverableSelect}
            isLoading={state.isLoadingDeliverables}
          />
        )}

        {/* Drawings List */}
        {state.selectedDeliverable && (
          <DrawingsList
            drawings={state.drawings}
            selectedDeliverable={state.selectedDeliverable}
            onViewDocument={handleViewDocument}
            onDownloadPdf={handleDownloadPdf}
            onDownloadSvg={handleDownloadSvg}
            isLoading={state.isLoadingDrawings}
          />
        )}

        {/* Global Loading State */}
        {state.isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center">
              <Spinner size="lg" className="mb-3" />
              <span className="text-gray-600">Loading...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {showEmptyState && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
            <p className="text-gray-500">There are no projects with drawings for this access key.</p>
          </div>
        )}

        {/* Image Viewer */}
        <ImageViewer
          isOpen={viewerState.isOpen}
          onClose={closeImageViewer}
          imageUrl={viewerState.imageUrl}
          title={viewerState.title}
        />
      </div>
    </div>
  );
}