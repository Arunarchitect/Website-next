"use client";

import { useState, ChangeEvent, FormEvent, useMemo } from "react";
import { useCreateWorklogMutation } from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";

interface Project {
  id: number;
  name: string;
}

interface Deliverable {
  id: number;
  name: string;
  project: number;
}

interface WorklogFormProps {
  userId: number;
  onSuccess: () => void;
}

const WorklogForm: React.FC<WorklogFormProps> = ({ userId, onSuccess }) => {
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: allDeliverables = [] } = useGetDeliverablesQuery();
  const [createWorklog, { isLoading }] = useCreateWorklogMutation();

  const [formData, setFormData] = useState({
    project: "",
    deliverable: "",
    start_time: "",
    end_time: "",
    remarks: "", // Added remarks field
  });

  const filteredDeliverables = useMemo(() => {
    if (!formData.project) return [];
    return allDeliverables.filter(
      (deliverable: Deliverable) => deliverable.project === Number(formData.project)
    );
  }, [formData.project, allDeliverables]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> // Added HTMLTextAreaElement
  ): void => {
    const { name, value } = e.target;

    if (name === "project") {
      setFormData((prev) => ({
        ...prev,
        project: value,
        deliverable: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!userId) return;

    const payload = {
      project: Number(formData.project),
      deliverable: Number(formData.deliverable),
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
      employee: userId,
      remarks: formData.remarks, // Added remarks to payload
    };

    try {
      await createWorklog(payload).unwrap();
      console.log("✅ Worklog created successfully!");
      setFormData({
        project: "",
        deliverable: "",
        start_time: "",
        end_time: "",
        remarks: "", // Reset remarks
      });
      onSuccess();
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
          disabled={!formData.project}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Select deliverable</option>
          {filteredDeliverables.map((deliverable: Deliverable) => (
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

      {/* Added Remarks field */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Remarks (Optional)</label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Any additional notes about this worklog..."
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