'use client';

import { useRetrieveUserQuery } from '@/redux/features/authApiSlice';
import { List, Spinner } from '@/components/common';
import { useRouter } from 'next/navigation';
import WorklogForm from '@/components/forms/WorklogForm';
import { 
  useGetWorklogsQuery, 
  useDeleteWorklogMutation,
  useUpdateWorklogMutation 
} from '@/redux/features/worklogApiSlice';
import { useGetProjectsQuery, useGetDeliverablesQuery } from '@/redux/features/worklogApiSlice';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface EditableWorklog extends Omit<Worklog, 'start_time' | 'end_time'> {
  start_time: string; // ISO string for input
  end_time: string; // ISO string for input
}

export default function DashboardPage() {
  const { data: user, isLoading: isUserLoading, isFetching: isUserFetching } = useRetrieveUserQuery();
  const { data: allWorklogs = [], refetch } = useGetWorklogsQuery();
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();
  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableWorklog, setEditableWorklog] = useState<EditableWorklog | null>(null);
  const router = useRouter();

  // Filter worklogs for the current user only
  const userWorklogs = allWorklogs.filter(worklog => worklog.employee === user?.id);

  const handleDelete = async (id: number) => {
    try {
      await deleteWorklog(id).unwrap();
      refetch();
    } catch (err) {
      console.error('Failed to delete worklog:', err);
    }
  };

  const handleEdit = (worklog: Worklog) => {
    setEditingId(worklog.id);
    setEditableWorklog({
      ...worklog,
      start_time: format(parseISO(worklog.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(worklog.end_time), "yyyy-MM-dd'T'HH:mm")
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditableWorklog(null);
  };

  const handleSaveEdit = async () => {
    if (!editableWorklog) return;

    try {
      await updateWorklog({
        id: editableWorklog.id,
        project: editableWorklog.project,
        deliverable: editableWorklog.deliverable,
        start_time: new Date(editableWorklog.start_time).toISOString(),
        end_time: new Date(editableWorklog.end_time).toISOString(),
      }).unwrap();
      
      refetch();
      setEditingId(null);
      setEditableWorklog(null);
    } catch (err) {
      console.error('Failed to update worklog:', err);
    }
  };

  const handleFieldChange = (field: keyof EditableWorklog, value: string | number) => {
    if (!editableWorklog) return;
    
    setEditableWorklog({
      ...editableWorklog,
      [field]: value
    });
  };

  if (isUserLoading || isUserFetching) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  const userConfig = [
    { label: 'First Name', value: user?.first_name },
    { label: 'Last Name', value: user?.last_name },
    { label: 'Email', value: user?.email },
  ];

  // Helper function to get project/deliverable names
  const getProjectName = (id: number) => projects.find(p => p.id === id)?.name || 'Unknown';
  const getDeliverableName = (id: number) => deliverables.find(d => d.id === id)?.name || 'Unknown';

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </header>
      
      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <List config={userConfig} />
        <button
          onClick={() => router.push('/projects')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Projects
        </button>
      </div>
      
      {user?.id && <WorklogForm userId={user.id} onSuccess={refetch} />}

      {/* Worklogs Table */}
      <div className="bg-white shadow-sm rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Worklogs</h2>
        {userWorklogs.length === 0 ? (
          <p className="text-gray-500">No worklogs found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliverable</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userWorklogs.map((worklog) => (
                  <tr key={worklog.id}>
                    {/* Project */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === worklog.id ? (
                        <select
                          value={editableWorklog?.project || ''}
                          onChange={(e) => handleFieldChange('project', Number(e.target.value))}
                          className="border rounded p-1"
                        >
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getProjectName(worklog.project)
                      )}
                    </td>

                    {/* Deliverable */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === worklog.id ? (
                        <select
                          value={editableWorklog?.deliverable || ''}
                          onChange={(e) => handleFieldChange('deliverable', Number(e.target.value))}
                          className="border rounded p-1"
                        >
                          {deliverables.map((deliverable) => (
                            <option key={deliverable.id} value={deliverable.id}>
                              {deliverable.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getDeliverableName(worklog.deliverable)
                      )}
                    </td>

                    {/* Start Time */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === worklog.id ? (
                        <input
                          type="datetime-local"
                          value={editableWorklog?.start_time || ''}
                          onChange={(e) => handleFieldChange('start_time', e.target.value)}
                          className="border rounded p-1"
                        />
                      ) : (
                        format(parseISO(worklog.start_time), 'PPpp')
                      )}
                    </td>

                    {/* End Time */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingId === worklog.id ? (
                        <input
                          type="datetime-local"
                          value={editableWorklog?.end_time || ''}
                          onChange={(e) => handleFieldChange('end_time', e.target.value)}
                          className="border rounded p-1"
                        />
                      ) : (
                        format(parseISO(worklog.end_time), 'PPpp')
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === worklog.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-600 hover:text-green-900"
                            title="Save"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-red-600 hover:text-red-900"
                            title="Cancel"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(worklog)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(worklog.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
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
        )}
      </div>
    </div>
  );
}