"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface Worklog {
  id: number;
  deliverable_name: string;
  start_time: string;
  end_time: string;
  employee: number;
}

interface WorklogsTableProps {
  worklogs: Worklog[];
  onDelete: (id: number) => void;
  onUpdate: (worklog: Worklog) => Promise<void>;
}

export default function WorklogsTable({
  worklogs,
  onDelete,
  onUpdate,
}: WorklogsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    start_time: string;
    end_time: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (worklog: Worklog) => {
    setEditingId(worklog.id);
    setEditData({
      start_time: format(parseISO(worklog.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(worklog.end_time), "yyyy-MM-dd'T'HH:mm"),
    });
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
    setError(null);
  };

  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    if (!editData) return;
    
    const newEditData = {
      ...editData,
      [field]: value
    };
    
    // Validate time range whenever either field changes
    if (newEditData.start_time && newEditData.end_time) {
      const startTime = new Date(newEditData.start_time);
      const endTime = new Date(newEditData.end_time);
      
      if (endTime <= startTime) {
        setError("End time must be after start time");
      } else {
        setError(null);
      }
    }
    
    setEditData(newEditData);
  };

  const handleSave = async (id: number) => {
    if (!editData) return;
    
    // Check validation again before saving
    const startTime = new Date(editData.start_time);
    const endTime = new Date(editData.end_time);
    
    if (endTime <= startTime) {
      setError("End time must be after start time");
      return;
    }
    
    try {
      const originalWorklog = worklogs.find(w => w.id === id);
      if (!originalWorklog) return;
      
      await onUpdate({
        ...originalWorklog,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });
      setEditingId(null);
      setError(null);
    } catch (error) {
      console.error('Failed to update worklog:', error);
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4">Worklogs</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deliverable
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                End Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {worklogs.map((worklog) => (
              <tr key={worklog.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {worklog.deliverable_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === worklog.id ? (
                    <input
                      type="datetime-local"
                      value={editData?.start_time || ''}
                      onChange={(e) => 
                        handleTimeChange('start_time', e.target.value)
                      }
                      className="border rounded p-1"
                    />
                  ) : (
                    format(parseISO(worklog.start_time), "PPpp")
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === worklog.id ? (
                    <input
                      type="datetime-local"
                      value={editData?.end_time || ''}
                      onChange={(e) => 
                        handleTimeChange('end_time', e.target.value)
                      }
                      className="border rounded p-1"
                    />
                  ) : (
                    format(parseISO(worklog.end_time), "PPpp")
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === worklog.id ? (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleSave(worklog.id)}
                        className={`text-green-600 hover:text-green-800 ${
                          error ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={!!error}
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={handleCancel}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEdit(worklog)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => onDelete(worklog.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
