'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('https://api.modelflick.com/projects/projects/');
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error(err);
        setError('Error loading projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) return <p className="p-4">Loading projects...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">All Projects</h1>

      {projects.length === 0 ? (
        <p>No projects found.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id} className="border p-4 rounded-md hover:bg-gray-900 transition">
              <Link href={`/projects/${project.id}`} className="block text-xl font-semibold text-blue-400 hover:underline">
                {project.name}
              </Link>
              <p className="text-sm text-gray-300">Client: {project.client_name}</p>
              <p className="text-sm text-gray-400">Location: {project.location}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
