'use client'

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { setToken, logout } from '@/redux/features/authSlice';

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
}

const NOTE_COLORS = [
  '#fde047', '#86efac', '#93c5fd', '#fca5a5', 
  '#c4b5fd', '#f9a8d4', '#fdba74', '#5eead4'
];

export default function ProjectsPage() {
  const { isAuthenticated, token } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem('refresh');
      if (!refreshToken) {
        dispatch(logout());
        return null;
      }

      const response = await fetch('https://api.modelflick.com/api/token/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      
      localStorage.setItem('old_refresh', refreshToken);
      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh || refreshToken);
      dispatch(setToken(data.access));
      
      return data.access;
    } catch (error) {
      console.error('Token refresh failed:', error);
      dispatch(logout());
      return null;
    }
  }, [dispatch]);

  const fetchProjects = useCallback(async (token: string, retry = true) => {
    try {
      const res = await fetch('https://api.modelflick.com/api/projects/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 && retry) {
        const newToken = await refreshAuthToken();
        if (newToken) {
          return fetchProjects(newToken, false);
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch projects. Status: ${res.status}`);
      }

      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'Error loading projects');
    } finally {
      setLoading(false);
    }
  }, [refreshAuthToken]);

  useEffect(() => {
    const initializeAuth = () => {
      const tokenFromStorage = localStorage.getItem('access');
      const refreshTokenFromStorage = localStorage.getItem('refresh');
      
      if (!token && tokenFromStorage) {
        dispatch(setToken(tokenFromStorage));
      }
      
      if (!refreshTokenFromStorage && localStorage.getItem('old_refresh')) {
        localStorage.setItem('refresh', localStorage.getItem('old_refresh')!);
      }
    };

    initializeAuth();
  }, [token, dispatch]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchProjects(token);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchProjects]);

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