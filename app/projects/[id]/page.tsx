'use client';

import { useParams } from 'next/navigation';
import { useGetProjectSummaryQuery } from '@/redux/features/projectApiSlice';

const ProjectDetailPage = () => {
  const { id } = useParams();
  
  const {
    data: projectDetails,
    isLoading,
    isError,
    error,
  } = useGetProjectSummaryQuery(id as string, { skip: !id });

  if (isLoading) return <p>Loading project details...</p>;
  if (isError) {
    console.error('Error loading project details:', error);
    return <p className="text-red-500">Error loading project details</p>;
  }
  if (!projectDetails) return <p>No project details available.</p>;

  const getDurationForDeliverable = (name: string) => {
    const match = projectDetails.deliverables_summary?.find(d => d.name === name);
    return match ? (match.duration_seconds / 3600).toFixed(2) : '—';
  };

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Project: {projectDetails.project}</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300">Current Stage: {projectDetails.current_stage}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Total Duration: {(projectDetails.total_duration_seconds / 3600).toFixed(2)} hours
      </p>

      <h2 className="text-xl font-semibold mt-6 text-gray-700 dark:text-gray-300">Deliverables Summary</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-600 text-sm">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-4 py-2 border-b border-gray-600 text-left">Name</th>
              <th className="px-4 py-2 border-b border-gray-600 text-left">Stage</th>
              <th className="px-4 py-2 border-b border-gray-600 text-left">Status</th>
              <th className="px-4 py-2 border-b border-gray-600 text-left">Remarks</th>
              <th className="px-4 py-2 border-b border-gray-600 text-left">Duration (hrs)</th>
            </tr>
          </thead>
          <tbody>
            {projectDetails.deliverables.map((deliverable, index) => (
              <tr key={index} className="border-t border-gray-700 hover:bg-gray-800">
                <td className="px-4 py-2">{deliverable.name}</td>
                <td className="px-4 py-2">{deliverable.stage}</td>
                <td className="px-4 py-2">{deliverable.status}</td>
                <td className="px-4 py-2">{deliverable.remarks || '—'}</td>
                <td className="px-4 py-2">
                  {getDurationForDeliverable(deliverable.name)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
