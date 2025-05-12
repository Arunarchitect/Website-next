'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { useGetProjectsQuery } from '@/redux/features/projectApiSlice';
import { useGetMyMembershipsQuery } from '@/redux/features/membershipApiSlice';
import { useDownloadDeliverablesCSVQuery, useDownloadWorklogsCSVQuery } from '@/redux/features/csvApiSlice';
import { logout } from '@/redux/features/authSlice';

const NOTE_COLORS = [
  '#fde047', '#86efac', '#93c5fd', '#fca5a5', 
  '#c4b5fd', '#f9a8d4', '#fdba74', '#5eead4'
];

export default function ProjectsPage() {
  const { isAuthenticated } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useGetProjectsQuery();
  const { data: memberships = [], isLoading: membershipsLoading, error: membershipsError } = useGetMyMembershipsQuery();
  const { data: deliverablesCSVData } = useDownloadDeliverablesCSVQuery();
  const { data: worklogsCSVData } = useDownloadWorklogsCSVQuery();

  const getProjectColor = (index: number) => NOTE_COLORS[index % NOTE_COLORS.length];

  const adminOrganisationIds = memberships
    .filter(m => m.role === 'admin')
    .map(m => m.organisation);

  

  const filteredProjects = projects.filter(project =>
    adminOrganisationIds.includes(project.organisation)
  );

  console.log(projects[0]); // Log a project to see its structure

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(logout());
    }
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-gray-900">
        <h1 className="text-2xl font-bold">Please Log In to Access Projects</h1>
      </div>
    );
  }

  if (projectsLoading || membershipsLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p>Loading projects...</p>
      </div>
    );
  }

  if (projectsError || membershipsError) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p className="text-red-500">Error loading projects. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-2xl font-bold text-white mb-4 md:mb-0">Project Dashboard</h1>

        <div className="flex space-x-4">
          {deliverablesCSVData && (
            <button
              onClick={() => {
                const blob = new Blob([deliverablesCSVData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'deliverables.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Download Deliverables
            </button>
          )}
          {worklogsCSVData && (
            <button
              onClick={() => {
                const blob = new Blob([worklogsCSVData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'worklogs.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Download Worklogs
            </button>
          )}
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
