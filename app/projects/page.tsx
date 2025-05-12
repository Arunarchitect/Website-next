'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { setToken, logout } from '@/redux/features/authSlice';

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  organisation: number;
}

interface Membership {
  id: number;
  organisation: number;
  role: string;
}

const NOTE_COLORS = [
  '#fde047', '#86efac', '#93c5fd', '#fca5a5', 
  '#c4b5fd', '#f9a8d4', '#fdba74', '#5eead4'
];

export default function ProjectsPage() {
  const { isAuthenticated, token } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  const [projects, setProjects] = useState<Project[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem('refresh');
      if (!refreshToken) return null;

      const response = await fetch('https://api.modelflick.com/api/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) throw new Error('Failed to refresh token');

      const data = await response.json();

      localStorage.setItem('old_refresh', refreshToken);
      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh || refreshToken);
      dispatch(setToken(data.access));

      return data.access;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }, [dispatch]);

  const fetchProjectsAndMemberships = useCallback(async (accessToken: string, retry = true) => {
    try {
      const [projectsRes, membershipsRes] = await Promise.all([
        fetch('https://api.modelflick.com/api/projects/', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('https://api.modelflick.com/api/my-memberships/', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if ((projectsRes.status === 401 || membershipsRes.status === 401) && retry) {
        const newToken = await refreshAuthToken();
        if (newToken) {
          return fetchProjectsAndMemberships(newToken, false);
        } else {
          dispatch(logout());
          throw new Error('Session expired. Please login again.');
        }
      }

      if (!projectsRes.ok || !membershipsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const projectsData = await projectsRes.json();
      const membershipsData = await membershipsRes.json();

      setProjects(projectsData);
      setMemberships(membershipsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [refreshAuthToken, dispatch]);

  useEffect(() => {
    const initializeAuth = () => {
      const access = localStorage.getItem('access');
      const refresh = localStorage.getItem('refresh');
      const oldRefresh = localStorage.getItem('old_refresh');

      if (access && !token) {
        dispatch(setToken(access));
      }
      if (!refresh && oldRefresh) {
        localStorage.setItem('refresh', oldRefresh);
      }
    };

    initializeAuth();
  }, [token, dispatch]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchProjectsAndMemberships(token);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchProjectsAndMemberships]);

  const getProjectColor = (index: number) => NOTE_COLORS[index % NOTE_COLORS.length];

  const getAdminOrganisationIds = () => 
    memberships.filter(m => m.role === 'admin').map(m => m.organisation);

  const adminOrganisationIds = getAdminOrganisationIds();

  const filteredProjects = projects.filter(project => 
    adminOrganisationIds.includes(project.organisation)
  );

  const handleDownload = async (endpoint: string, filename: string) => {
    if (!token) return;

    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Failed to download ${filename}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-gray-900">
        <h1 className="text-2xl font-bold">Please Log In to Access Projects</h1>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p>Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-2xl font-bold text-white mb-4 md:mb-0">Project Dashboard</h1>

        <div className="flex space-x-4">
          <button
            onClick={() => handleDownload('https://api.modelflick.com/api/deliverables/download_csv/', 'deliverables.csv')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Download Deliverables
          </button>
          <button
            onClick={() => handleDownload('https://api.modelflick.com/api/work-logs/download_csv/', 'worklogs.csv')}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Download Worklogs
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <p className="text-white">No projects found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProjects.map((project, index) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div
                className="sticky-note transform hover:scale-105 transition-transform duration-200"
                style={{ 
                  backgroundColor: getProjectColor(index),
                  rotate: `${index % 2 === 0 ? '-1deg' : '1deg'}`,
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
