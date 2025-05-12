"use client";

import { useRouter } from "next/navigation";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import { useGetMyMembershipsQuery } from "@/redux/features/membershipApiSlice";
import { 
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation
} from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";
import WorklogForm from "@/components/forms/WorklogForm";
import WorklogsTable, { EditableWorklog } from "@/components/tables/WorklogsTable";
import { List, Spinner } from "@/components/common";
import { downloadCSV } from "@/components/utils/CsvDownload";

export default function DashboardPage() {
  const router = useRouter();

  // User data
  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useRetrieveUserQuery();

  // Memberships data
  const {
    data: memberships = [],
    isLoading: isMembershipsLoading,
    isFetching: isMembershipsFetching,
  } = useGetMyMembershipsQuery();

  // Worklogs data
  const { 
    data: allWorklogs = [], 
    refetch: refetchWorklogs 
  } = useGetWorklogsQuery();
  
  // Projects data
  const { 
    data: projects = [] 
  } = useGetProjectsQuery();
  
  // Deliverables data
  const { 
    data: deliverables = [] 
  } = useGetDeliverablesQuery();

  // Mutations
  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();

  const isLoading =
    isUserLoading ||
    isUserFetching ||
    isMembershipsLoading ||
    isMembershipsFetching;

  // Filter worklogs for current user
  const userWorklogs = allWorklogs.filter(
    (worklog) => worklog.employee === user?.id
  );

  // Check if user is admin
  const isAdmin = memberships.some((m) => m.role === "admin");

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

  const handleDownload = async (endpoint: string, filename: string) => {
    try {
      await downloadCSV(endpoint, filename);
    } catch (error) {
      console.error(`Failed to download ${filename}:`, error);
    }
  };

  if (isLoading) {
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

        {isAdmin && (
          <div className="mt-4 space-x-4 flex">
            <button
              onClick={() => router.push("/projects")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Projects
            </button>

            <button
              onClick={() => handleDownload(
                "https://api.modelflick.com/api/work-logs/download_csv/",
                "worklogs.csv"
              )}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Download Worklogs
            </button>

            <button
              onClick={() => handleDownload(
                "https://api.modelflick.com/api/deliverables/download_csv/",
                "deliverables.csv"
              )}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Download Deliverables
            </button>
          </div>
        )}
      </div>

      {user?.id && (
        <WorklogForm 
          userId={user.id} 
          onSuccess={refetchWorklogs} 
        />
      )}

      <WorklogsTable
        worklogs={userWorklogs}
        projects={projects}
        deliverables={deliverables}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        refetch={refetchWorklogs}
      />
    </div>
  );
}