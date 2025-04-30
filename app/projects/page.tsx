'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { setToken } from '@/redux/features/authSlice';

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
}

// Slightly darker color palette for better contrast with black text
const NOTE_COLORS = [
  '#fde047', // brighter yellow
  '#86efac', // brighter green
  '#93c5fd', // brighter blue
  '#fca5a5', // brighter red
  '#c4b5fd', // brighter purple
  '#f9a8d4', // brighter pink
  '#fdba74', // brighter orange
  '#5eead4', // brighter teal
];

export default function ProjectsPage() {
  const { isAuthenticated, token } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token && localStorage.getItem('access')) {
      const tokenFromStorage = localStorage.getItem('access');
      if (tokenFromStorage) {
        dispatch(setToken(tokenFromStorage));
      }
    }

    if (isAuthenticated && token) {
      fetchProjects(token);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, dispatch]);

  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch('https://api.modelflick.com/api/projects/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch projects. Status: ${res.status}`);
      }

      const data = await res.json();
      setProjects(data);
    } catch (err) {
      setError('Error loading projects');
    } finally {
      setLoading(false);
    }
  };

  const getProjectColor = (index: number) => {
    return NOTE_COLORS[index % NOTE_COLORS.length];
  };

  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-gray-900">
        <h1 className="text-2xl font-bold">Please Log In to Access Projects</h1>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 p-10 text-white">
      <p>Loading projects...</p>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-gray-900 p-10 text-white">
      <p className="text-red-500">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-8">Project Dashboard</h1>

      {projects.length === 0 ? (
        <p className="text-white">No projects found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {projects.map((project, index) => (
            <Link 
              key={project.id} 
              href={`/projects/${project.id}`}
              className="sticky-note transform hover:scale-105 transition-transform duration-200"
              style={{ 
                backgroundColor: getProjectColor(index),
                transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)`,
              }}
            >
              <div className="p-5 h-full flex flex-col text-gray-900">
                <h2 className="text-xl font-bold mb-3 break-words">{project.name}</h2>
                <div className="mb-4 flex-grow">
                  <p className="text-sm font-semibold mb-1">Client:</p>
                  <p className="text-sm break-words">{project.client_name}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Location:</p>
                  <p className="text-sm break-words">{project.location}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}