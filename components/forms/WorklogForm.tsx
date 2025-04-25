'use client';

import { useState } from 'react';
import {
  useCreateWorklogMutation,
  useGetProjectsQuery,
  useGetWorkTypesQuery
} from '@/redux/features/worklogApiSlice';

interface Project {
  id: number;
  name: string;
}

interface WorkType {
  id: number;
  name: string;
}

// Define props interface to accept userId
interface WorklogFormProps {
  userId: number;
}

export default function WorklogForm({ userId }: WorklogFormProps) {
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: workTypes = [] } = useGetWorkTypesQuery();

  const [createWorklog, { isLoading }] = useCreateWorklogMutation();

  const [formData, setFormData] = useState({
    project: '',
    work_type: '',
    start_time: '',
    end_time: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const payload = {
      project: Number(formData.project),
      work_type: Number(formData.work_type),
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
      employee: userId,
    };

    console.log("Submitting worklog payload:", payload);

    try {
      await createWorklog(payload).unwrap();
      console.log("✅ Worklog created successfully!");
      setFormData({ project: '', work_type: '', start_time: '', end_time: '' });
    } catch (err) {
      console.error('❌ Failed to create worklog:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 max-w-md mx-auto bg-white rounded-lg shadow">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Project</label>
        <select
          name="project"
          value={formData.project}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Select a project</option>
          {projects.map((p: Project) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Work Type</label>
        <select
          name="work_type"
          value={formData.work_type}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Select work type</option>
          {workTypes.map((w: WorkType) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Start Time</label>
        <input
          type="datetime-local"
          name="start_time"
          value={formData.start_time}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">End Time</label>
        <input
          type="datetime-local"
          name="end_time"
          value={formData.end_time}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <button 
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
      >
        {isLoading ? 'Submitting...' : 'Create Worklog'}
      </button>
    </form>
  );
}
