"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import {
  useGetMyMembershipsQuery,
  useGetMyOrganisationsQuery,
} from "@/redux/features/membershipApiSlice";
import {
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation,
} from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";
import WorklogForm from "@/components/forms/WorklogForm";
import WorklogsTable from "@/components/tables/WorklogsTable";
import { EditableWorklog } from "@/types/worklogs";
import { Spinner } from "@/components/common";

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // User data
  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useRetrieveUserQuery();

  // Memberships data (contains organization info with roles)
  const {
    data: memberships = [],
    isLoading: isMembershipLoading,
    isFetching: isMembershipFetching,
  } = useGetMyMembershipsQuery();

  // Organizations data (for names)
  const {
    data: organisations = [],
    isLoading: isOrgLoading,
    isFetching: isOrgFetching,
  } = useGetMyOrganisationsQuery();

  // Worklogs data
  const { data: allWorklogs = [], refetch: refetchWorklogs } =
    useGetWorklogsQuery();

  // Projects and deliverables data
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();

  // Mutations
  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Loading states
  const isLoading =
    isUserLoading ||
    isUserFetching ||
    isMembershipLoading ||
    isMembershipFetching ||
    isOrgLoading ||
    isOrgFetching;

  // Filter worklogs for current user
  const userWorklogs = allWorklogs.filter(
    (worklog) => worklog.employee === user?.id
  );

  // Get admin organizations from memberships
  const adminMemberships = memberships.filter(
    (membership) => membership.role === "admin"
  );

  // Create admin organizations array with names
  const adminOrganizations = adminMemberships.map((membership) => {
    const org = organisations.find((o) => o.id === membership.organisation);
    return {
      id: membership.organisation,
      name: org?.name || `Organization ${membership.organisation}`,
    };
  });

  const isAdmin = adminOrganizations.length > 0;

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
      if (typeof worklog.id !== "number") {
        throw new Error("Invalid worklog ID");
      }

      await updateWorklog({
        id: worklog.id,
        project: worklog.project,
        deliverable: worklog.deliverable,
        start_time: worklog.start_time,
        end_time: worklog.end_time,
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

  if (isLoading || !isMounted) {
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
            <button
              onClick={() => router.push("/hr")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              HR Dashboard
            </button>
          </div>
        )}
      </div>

      {user?.id && <WorklogForm userId={user.id} onSuccess={refetchWorklogs} />}

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
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Select an Organization
            </h2>
            <select
              value={selectedOrgId ?? ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            >
              <option value="">-- Choose an organization --</option>
              {adminOrganizations.map((org) => (
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
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  !selectedOrgId ? "opacity-50 cursor-not-allowed" : ""
                }`}
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
