'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppSelector } from '@/redux/hooks'; // Ensure to use the selector to get the token from Redux

interface WorkType {
  name: string;
  duration: number; // Duration in seconds
}

interface Deliverable {
  name: string;
  stage: string;
  status: string;
  remarks: string;
}

interface ProjectDetails {
  project: string;
  current_stage: string;
  total_duration: number;
  work_types: WorkType[];
  deliverables: Deliverable[];
}

const ProjectDetailPage = () => {
  const { id } = useParams();
  const { token } = useAppSelector(state => state.auth); // Get token from Redux state
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Project ID:', id); // Log the project ID from params
    console.log('Token from Redux:', token); // Log the token to ensure it's available

    // Fallback: Check localStorage if token isn't available in Redux state
    if (!token && localStorage.getItem('access')) {
      const tokenFromStorage = localStorage.getItem('access');
      if (tokenFromStorage) {
        console.log('Token from localStorage:', tokenFromStorage);
      }
    }

    if (!id || !token) {
      console.log('Missing project ID or token. Exiting fetch.');
      return; // If there's no ID or token, don't proceed
    }

    const fetchProjectDetails = async () => {
      console.log('Fetching project details with token:', token); // Log before making the API request
      try {
        const res = await fetch(`https://api.modelflick.com/api/projects/${id}/summary/`, {
          headers: {
            Authorization: `Bearer ${token}`, // Pass the token in the Authorization header
          },
        });

        console.log('Response status:', res.status); // Log the response status

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('API Error Response:', errorData); // Log the error response if the status is not OK
          throw new Error(`Failed to fetch project details. Status: ${res.status}`);
        }

        const data: ProjectDetails = await res.json();
        console.log('Fetched project details:', data); // Log the fetched project details
        setProjectDetails(data);
      } catch (err) {
        console.error('Error fetching project details:', err); // Log any errors during the fetch
        setError('Error loading project details');
      } finally {
        setLoading(false); // Set loading to false after fetch completes (either success or failure)
      }
    };

    fetchProjectDetails();
  }, [id, token]); // Add token to the dependency array to ensure it's available

  if (loading) return <p>Loading project details...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  if (!projectDetails) return <p>No project details available.</p>;

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold">Project: {projectDetails.project}</h1>
      <p className="text-sm text-gray-300">Current Stage: {projectDetails.current_stage}</p>
      <p className="text-sm text-gray-400">Total Duration: {(projectDetails.total_duration / 3600).toFixed(2)} hours</p> {/* Convert total duration to hours */}

      <h2 className="text-xl font-semibold mt-4">Work Types</h2>
      <ul className="space-y-2">
        {projectDetails.work_types.map((work, index) => (
          <li key={index} className="text-sm">
            {work.name}: {(work.duration / 3600).toFixed(2)} hours {/* Convert duration to hours */}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold mt-4">Deliverables</h2>
      <ul className="space-y-2">
        {projectDetails.deliverables.map((deliverable, index) => (
          <li key={index} className="text-sm">
            <strong>{deliverable.name}</strong> (Stage: {deliverable.stage}, Status: {deliverable.status})
            <p className="text-gray-400">Remarks: {deliverable.remarks}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProjectDetailPage;
