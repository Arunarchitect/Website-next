'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
}

// Hardcoded PIN
const CORRECT_PIN = '1234';

export default function ProjectsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check stored PIN on load
  useEffect(() => {
    const savedPin = localStorage.getItem('projects_pin');
    if (savedPin === CORRECT_PIN) {
      setIsAuthenticated(true);
    } else {
      setLoading(false); // Only skip project loading if not authenticated
    }
  }, []);

  // Fetch projects after authentication
  useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated]);

  // Handle PIN form submit
  const handlePinSubmit = () => {
    if (pinInput === CORRECT_PIN) {
      localStorage.setItem('projects_pin', CORRECT_PIN);
      setIsAuthenticated(true);
      setLoading(true);
    } else {
      alert('Incorrect PIN');
    }
  };

  // Render PIN form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-black">
        <h1 className="text-2xl font-bold">Enter PIN to Access Projects</h1>
        <input
          type="password"
          className="p-2 rounded bg-gray-800 border border-gray-600"
          placeholder="Enter PIN"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
        />
        <button
          onClick={handlePinSubmit}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          Submit
        </button>
      </div>
    );
  }

  // Render loading / error / data
  if (loading) return <p className="p-4 text-white">Loading projects...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold">All Projects</h1>

      {projects.length === 0 ? (
        <p>No projects found.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id} className="border border-gray-700 p-4 rounded-md hover:bg-gray-900 transition">
              <Link href={`/projects/${project.id}`} className="block text-xl font-semibold text-blue-400 hover:underline">
                {project.name}
              </Link>
              <p className="text-sm text-gray-300">Client: {project.client_name}</p>
              <p className="text-sm text-gray-400">Location: {project.location}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Optional logout button */}
      <button
        onClick={() => {
          localStorage.removeItem('projects_pin');
          location.reload();
        }}
        className="mt-6 bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
      >
        Logout
      </button>
    </div>
  );
}
