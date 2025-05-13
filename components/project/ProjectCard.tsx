import React from "react";
import Link from "next/link";

const NOTE_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fca5a5", "#c4b5fd", "#f9a8d4", "#fdba74", "#5eead4"];

interface ProjectCardProps {
  project: { id: number; name: string; client_name: string | null; location: string | null; organisation: number };
  index: number;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index }) => {
  const getProjectColor = (index: number) => NOTE_COLORS[index % NOTE_COLORS.length];

  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className="sticky-note transform hover:scale-105 transition-transform duration-200"
        style={{
          backgroundColor: getProjectColor(index),
          rotate: `${index % 2 === 0 ? "-1deg" : "1deg"}`,
        }}
      >
        <div className="p-5 h-full flex flex-col text-gray-900">
          <h2 className="text-xl font-bold mb-3 break-words">{project.name}</h2>
          <div className="mb-4 flex-grow">
            <p className="text-sm font-semibold mb-1">Client:</p>
            <p className="text-sm break-words">{project.client_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">Location:</p>
            <p className="text-sm break-words">{project.location || "N/A"}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
