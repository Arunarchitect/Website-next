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

export default function ProjectsPage() {
  const { isAuthenticated, token } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Auth status:', isAuthenticated);
    console.log('Token from Redux:', token);

    // Set token from localStorage if it's available and not in state
    if (!token && localStorage.getItem('access')) {
      const tokenFromStorage = localStorage.getItem('access');
      if (tokenFromStorage) {
        dispatch(setToken(tokenFromStorage)); // Set token in Redux state
      }
    }

    if (isAuthenticated && token) {
      fetchProjects(token);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, dispatch]);

  const fetchProjects = async (token: string) => {
    console.log('Fetching projects with token:', token);

    try {
      const res = await fetch('https://api.modelflick.com/api/projects/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        throw new Error(`Failed to fetch projects. Status: ${res.status}`);
      }

      const data = await res.json();
      console.log('Fetched projects:', data);
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Error loading projects');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-black">
        <h1 className="text-2xl font-bold">Please Log In to Access Projects</h1>
      </div>
    );
  }

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
    </div>
  );
}
