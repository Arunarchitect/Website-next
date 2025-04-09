'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';

interface WorkTypeDuration {
  name: string;
  duration: number;
}

interface Deliverable {
  name: string;        // now a string instead of a relation object
  stage: string;
  status: string;
  remarks?: string;
}

interface ProjectSummary {
  project: string;
  current_stage: string;
  total_duration: number;
  work_types?: WorkTypeDuration[];
  deliverables?: Deliverable[];
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}h ${mins}m ${secs}s`;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'not_started':
      return 'bg-gray-200 text-gray-700';
    case 'ongoing':
      return 'bg-yellow-100 text-yellow-800';
    case 'ready':
      return 'bg-blue-100 text-blue-800';
    case 'passed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'discrepancy':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-300 text-gray-800';
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProjectPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`https://api.modelflick.com/projects/projects/${params.id}/summary/`);
        const data = await res.json();
        setSummary(data);
      } catch (error) {
        console.error('Error fetching summary:', error);
        setSummary(null); // prevent stale error
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [params.id]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!summary) return <p className="p-6 text-red-500">Could not load project summary.</p>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{summary.project}</h1>
        <p className="text-gray-600 mt-1">Current Stage: <span className="font-medium">Stage {summary.current_stage}</span></p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Deliverables</h2>
        <div className="mt-4 space-y-3">
          {summary.deliverables?.length ? (
            summary.deliverables.map((d, idx) => (
              <div key={idx} className="border p-3 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{d.name} <span className="text-sm text-gray-500">(Stage {d.stage})</span></h3>
                    {d.remarks && <p className="text-sm text-gray-500 mt-1">Remarks: {d.remarks}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadgeClass(d.status)}`}>
                    {formatStatus(d.status)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No deliverables found.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Work Type Breakdown</h2>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          {summary.work_types?.length ? (
            summary.work_types.map((wt, i) => (
              <li key={i}>
                {wt.name}: <strong>{formatDuration(wt.duration)}</strong>
              </li>
            ))
          ) : (
            <li className="text-gray-500">No work logs found.</li>
          )}
        </ul>
      </div>

      <div className="pt-4 border-t">
        <p>Total Work Hours: <strong>{formatDuration(summary.total_duration || 0)}</strong></p>
      </div>
    </div>
  );
}
