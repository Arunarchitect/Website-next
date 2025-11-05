import { Project } from "../types";
import { SectionTitle } from "./SectionTitle";
import { FolderIcon } from "./icons";

interface ProjectsGridProps {
  projects: Project[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
}

export const ProjectsGrid = ({
  projects,
  selectedProject,
  onProjectSelect,
}: ProjectsGridProps) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
    <SectionTitle
      icon={<FolderIcon className="w-5 h-5" />}
      title="Select Project"
    />

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onProjectSelect(project)}
          className={`p-4 text-left rounded-lg border transition-all ${
            selectedProject?.id === project.id
              ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
          }`}
        >
          <h4 className="font-semibold text-gray-800 mb-1">{project.name}</h4>
          <p className="text-sm text-gray-600 mb-1">
            {project.location} • {project.client_name}
          </p>
          <p className="text-sm text-gray-600">
            Stage {project.current_stage} • {project.deliverables_count || 0} deliverable(s)
          </p>
        </button>
      ))}
    </div>
  </div>
);