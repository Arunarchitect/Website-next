// app/dashboard/page.tsx
"use client";

import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import { List, Spinner } from "@/components/common";
import { useRouter } from "next/navigation";
import WorklogForm from "@/components/forms/WorklogForm";
import {
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation,
} from "@/redux/features/worklogApiSlice";
import {
  useGetProjectsQuery,
  useGetDeliverablesQuery,
} from "@/redux/features/worklogApiSlice";
import WorklogsTable, { EditableWorklog } from "@/components/tables/WorklogsTable";

export default function DashboardPage() {
  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useRetrieveUserQuery();
  const { data: allWorklogs = [], refetch } = useGetWorklogsQuery();
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();
  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();
  const router = useRouter();

  const userWorklogs = allWorklogs.filter(
    (worklog) => worklog.employee === user?.id
  );

  const handleDelete = async (id: number) => {
    try {
      await deleteWorklog(id).unwrap();
      refetch();
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
  

  if (isUserLoading || isUserFetching) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  const userConfig = [
    { label: "First Name", value: user?.first_name },
    { label: "Last Name", value: user?.last_name },
    { label: "Email", value: user?.email },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </header>
      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <List config={userConfig} />
        <button
          onClick={() => router.push("/projects")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          View Projects
        </button>
      </div>
      {user?.id && <WorklogForm userId={user.id} onSuccess={refetch} />}
      
      <WorklogsTable
        worklogs={userWorklogs}
        projects={projects}
        deliverables={deliverables}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        refetch={refetch}
      />
    </div>
  );
}
