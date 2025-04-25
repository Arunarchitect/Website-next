'use client';

import { useState } from 'react';
import { useCreateWorklogMutation } from '@/redux/features/worklogApiSlice';
import { useRetrieveUserQuery } from '@/redux/features/authApiSlice';

interface User {
  id: number; // Add id to your User interface
  first_name: string;
  last_name: string;
  email: string;
}

export default function WorklogForm() {
  const { data: user } = useRetrieveUserQuery();
  const [createWorklog, { isLoading, error }] = useCreateWorklogMutation();
  const [formData, setFormData] = useState({
    project: '',
    work_type: '',
    start_time: '',
    end_time: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    try {
      await createWorklog({
        project: Number(formData.project),
        work_type: Number(formData.work_type),
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        employee: user.id,
      }).unwrap();
      
      // Reset form on success
      setFormData({
        project: '',
        work_type: '',
        start_time: '',
        end_time: '',
      });
    } catch (err) {
      console.error('Failed to create worklog:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 max-w-md mx-auto bg-white rounded-lg shadow">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Project ID</label>
        <input
          type="number"
          name="project"
          value={formData.project}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Work Type ID</label>
        <input
          type="number"
          name="work_type"
          value={formData.work_type}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        />
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

      {error && (
        <div className="text-red-500 text-sm">
          Error creating worklog: {('data' in error) ? (error.data as { detail?: string }).detail : 'An error occurred'}
        </div>
      )}

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