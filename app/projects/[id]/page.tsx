'use client';

import { useParams } from 'next/navigation';
import { useGetProjectSummaryQuery } from '@/redux/features/projectApiSlice';
import { useState, useEffect } from 'react';

interface Deliverable {
  name: string;
  stage: string;
  status: string;
  end_date: string;
  remarks?: string;
}

interface ProjectDetails {
  project: string;
  current_stage: string; // Note: There's a typo here ('current_stage' vs 'current_stage')
  total_duration_seconds: number;
  deliverables: Deliverable[];
  deliverables_summary?: Array<{
    name: string;
    duration_seconds: number;
  }>;
}

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-500',
  ongoing: 'bg-blue-500 animate-pulse',
  ready: 'bg-yellow-500 animate-pulse',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  discrepancy: 'bg-purple-500 animate-pulse',
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  ongoing: 'Ongoing',
  ready: 'Ready for Validation',
  passed: 'Passed Validation',
  failed: 'Failed Validation',
  discrepancy: 'Site Discrepancy',
};

const ProjectDetailPage = () => {
  const { id } = useParams();
  const [isClient, setIsClient] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>('');
  
  useEffect(() => {
    setIsClient(true);
    // Set current date in YYYY-MM-DD format for comparison
    setCurrentDate(new Date().toISOString().split('T')[0]);
  }, []);

  const {
    data: projectDetails,
    isLoading,
    isError,
    error,
  } = useGetProjectSummaryQuery(id as string, { skip: !id });

  // Properly type the project details
  const typedProjectDetails = projectDetails as ProjectDetails | undefined;

  const isPastDue = (endDate: string) => {
    if (!endDate || !currentDate) return false;
    return endDate < currentDate;
  };

  if (isLoading) return <p>Loading project details...</p>;
  if (isError) {
    console.error('Error loading project details:', error);
    return <p className="text-red-500">Error loading project details</p>;
  }
  if (!typedProjectDetails) return <p>No project details available.</p>;

  const getDurationForDeliverable = (name: string) => {
    const match = typedProjectDetails.deliverables_summary?.find(d => d.name === name);
    return match ? (match.duration_seconds / 3600).toFixed(2) : '—';
  };

  // Group deliverables by stage
  const deliverablesByStage: Record<string, Deliverable[]> = {};
  typedProjectDetails.deliverables.forEach((deliverable) => {
    if (!deliverablesByStage[deliverable.stage]) {
      deliverablesByStage[deliverable.stage] = [];
    }
    deliverablesByStage[deliverable.stage].push(deliverable);
  });

  // Get unique stages and sort them
  const stages = Object.keys(deliverablesByStage).sort();

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Project: {typedProjectDetails.project}</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300">Current Stage: {typedProjectDetails.current_stage}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Total Duration: {(typedProjectDetails.total_duration_seconds / 3600).toFixed(2)} hours
      </p>

      {/* Status Legend */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-300">Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center space-x-2">
              <span className={`inline-block w-3 h-3 rounded-full ${statusColors[status]}`}></span>
              <span className="text-sm text-gray-300">{label}</span>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-900"></span>
            <span className="text-sm text-gray-300">Past Due Date</span>
          </div>
        </div>
      </div>

      {/* Stage Cards Section */}
      <h2 className="text-xl font-semibold mt-6 text-gray-700 dark:text-gray-300">Project Stages</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => (
          <div key={stage} className="border border-gray-600 rounded-lg p-4 bg-gray-800">
            <h3 className="text-lg font-semibold mb-3 text-gray-300">Stage {stage}</h3>
            <div className="space-y-3">
              {deliverablesByStage[stage].map((deliverable, index) => (
                <div 
                  key={`${stage}-${index}`} 
                  className={`border-b border-gray-700 pb-2 last:border-b-0 rounded p-2 ${
                    isPastDue(deliverable.end_date) ? 'bg-red-900/50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-gray-200">{deliverable.name}</p>
                    {isClient && (
                      <span 
                        className={`inline-block w-3 h-3 rounded-full mt-1 ${statusColors[deliverable.status]}`}
                        title={statusLabels[deliverable.status]}
                      ></span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{statusLabels[deliverable.status]}</span>
                    <span>{getDurationForDeliverable(deliverable.name)} hrs</span>
                  </div>
                  <div className={`text-xs mt-1 ${
                    isPastDue(deliverable.end_date) ? 'text-red-300' : 'text-gray-400'
                  }`}>
                    End Date: {deliverable.end_date}
                    {isPastDue(deliverable.end_date) && (
                      <span className="ml-2 text-red-300">(Past Due)</span>
                    )}
                  </div>
                  {deliverable.remarks && (
                    <p className="text-xs text-gray-500 mt-1">Remarks: {deliverable.remarks}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectDetailPage;