// components/forms/WorklogForm.tsx
"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import {
  useCreateWorklogMutation,
  useGetProjectsQuery,
  useGetDeliverablesQuery,
} from "@/redux/features/worklogApiSlice";

interface Project {
  id: number;
  name: string;
}

interface Deliverable {
  id: number;
  name: string;
}

interface WorklogFormProps {
  userId: number;
  onSuccess: () => void; // Added onSuccess prop
}

const WorklogForm: React.FC<WorklogFormProps> = ({ userId, onSuccess }) => {
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();
  const [createWorklog, { isLoading }] = useCreateWorklogMutation();

  const [formData, setFormData] = useState({
    project: "",
    deliverable: "",
    start_time: "",
    end_time: "",
  });

  // Handle form data change
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submit
  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!userId) return; // Ensure userId is present

    const payload = {
      project: Number(formData.project),
      deliverable: Number(formData.deliverable),
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
      employee: userId, // Attach userId to worklog
    };

    try {
      await createWorklog(payload).unwrap();
      console.log("✅ Worklog created successfully!");
      setFormData({
        project: "",
        deliverable: "",
        start_time: "",
        end_time: "",
      });
      onSuccess(); // Trigger the onSuccess callback after successful creation
    } catch (err) {
      console.error("❌ Failed to create worklog:", err);
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
          {projects.map((project: Project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Deliverable</label>
        <select
          name="deliverable"
          value={formData.deliverable}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Select deliverable</option>
          {deliverables.map((deliverable: Deliverable) => (
            <option key={deliverable.id} value={deliverable.id}>
              {deliverable.name}
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
        {isLoading ? "Submitting..." : "Create Worklog"}
      </button>
    </form>
  );
};

export default WorklogForm;
