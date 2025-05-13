"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import { useGetMyMembershipsQuery, useGetMyOrganisationsQuery } from "@/redux/features/membershipApiSlice";
import {
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation,
} from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";
import WorklogForm from "@/components/forms/WorklogForm";
import WorklogsTable, { EditableWorklog } from "@/components/tables/WorklogsTable";
import { Spinner } from "@/components/common";

export default function DashboardPage() {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useRetrieveUserQuery();

  const {
    data: organisations = [],
    isLoading: isOrganisationsLoading,
    isFetching: isOrganisationsFetching,
  } = useGetMyOrganisationsQuery();  // Fetch organizations

  const {
    data: allWorklogs = [],
    refetch: refetchWorklogs,
  } = useGetWorklogsQuery();

  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();

  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();

  const isLoading =
    isUserLoading || isUserFetching || isMembershipsLoading || isMembershipsFetching || isOrganisationsLoading || isOrganisationsFetching;

  const userWorklogs = allWorklogs.filter(
    (worklog) => worklog.employee === user?.id
  );

  // Update to use organisations directly instead of memberships
  const adminOrgs = organisations.map((org) => ({
    id: org.id,
    name: org.name,
  }));

  const isAdmin = adminOrgs.length > 0;

  const handleDelete = async (id: number) => {
    try {
      await deleteWorklog(id).unwrap();
      refetchWorklogs();
    } catch (err) {
      console.error("Failed to delete worklog:", err);
    }
  };

  const handleUpdate = async (worklog: EditableWorklog): Promise<void> => {
    try {
      await updateWorklog({
        id: worklog.id,
        project: worklog.project,
        deliverable: worklog.deliverable,
        start_time: new Date(worklog.start_time).toISOString(),
        end_time: new Date(worklog.end_time).toISOString(),
      }).unwrap();
      console.log("✅ Worklog updated successfully!");
    } catch (err) {
      console.error("❌ Failed to update worklog:", err);
    }
  };

  const handleGoToProjects = () => {
    if (selectedOrgId) {
      setIsModalOpen(false);
      router.push(`/projects?org=${selectedOrgId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </header>

      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <p className="text-lg text-gray-700">
          Hi {user?.first_name} {user?.last_name}, welcome onboard!
        </p>

        <p className="text-sm text-gray-500 mt-1">
          Your registered email is {user?.email}
        </p>

        {isAdmin && (
          <div className="mt-4 space-x-4 flex">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Projects
            </button>
          </div>
        )}
      </div>

      {user?.id && (
        <WorklogForm userId={user.id} onSuccess={refetchWorklogs} />
      )}

      <WorklogsTable
        worklogs={userWorklogs}
        projects={projects}
        deliverables={deliverables}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        refetch={refetchWorklogs}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Select an Organization</h2>

            <select
              value={selectedOrgId ?? ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            >
              <option value="">-- Choose an organization --</option>
              {adminOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={handleGoToProjects}
                disabled={!selectedOrgId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Go to Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
