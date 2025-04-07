'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';

interface WorkTypeDuration {
  name: string;
  duration: number;
}

interface ProjectSummary {
  project: string;
  total_duration: number;
  work_types: WorkTypeDuration[];
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

export default function ProjectPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise); // ✅ unwrap the promise
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const res = await fetch(`https://api.modelflick.com/projects/projects/${params.id}/summary/`);
      const data = await res.json();
      setSummary(data);
      setLoading(false);
    };

    fetchSummary();
  }, [params.id]);

  if (loading) return <p>Loading...</p>;
  if (!summary) return <p>No data found.</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{summary.project}</h1>
      <p>Total Duration: <strong>{formatDuration(summary.total_duration)}</strong></p>
      <h2 className="text-xl font-semibold mt-4">Work Type Breakdown:</h2>
      <ul className="list-disc pl-6 space-y-2">
        {summary.work_types.map((wt, i) => (
          <li key={i}>
            {wt.name}: <strong>{formatDuration(wt.duration)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
