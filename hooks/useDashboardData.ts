"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import { useGetMyOrganisationsQuery } from "@/redux/features/membershipApiSlice";
import {
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation,
} from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";
import { EditableWorklog } from "@/types/worklogs";

export default function useDashboardData() {
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
    isLoading: isOrgLoading,
    isFetching: isOrgFetching,
  } = useGetMyOrganisationsQuery();

  const {
    data: allWorklogs = [],
    refetch: refetchWorklogs,
  } = useGetWorklogsQuery();

  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();

  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();

  const isLoading = isUserLoading || isUserFetching || isOrgLoading || isOrgFetching;

  const userWorklogs = allWorklogs.filter(
    (worklog) => worklog.employee === user?.id
  );

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

  return {
    isLoading,
    user,
    isAdmin,
    adminOrgs,
    isModalOpen,
    setIsModalOpen,
    selectedOrgId,
    setSelectedOrgId,
    handleGoToProjects,
    userWorklogs,
    projects,
    deliverables,
    handleDelete,
    handleUpdate,
    refetchWorklogs,
  };
}
