// app/hr/users/[userId]/page.tsx
"use client";

import { useParams } from "next/navigation";
import {
  useGetUserDetailsQuery,
  useGetUserOrganisationsQuery,
  useGetUserDeliverablesQuery,
  useGetUserWorkLogsQuery,
} from "@/redux/features/userApiSlice";
import { Spinner } from "@/components/common";
import type { WorkLog } from "@/components/tables/workTable";
import type { Deliverable } from "@/components/tables/deliverablesTable";
import WorkTable from "@/components/tables/workTable";
import DeliverablesTable from "@/components/tables/deliverablesTable";

interface Organisation {
  id: number;
  organisation: {
    name: string;
  };
  role: string;
}

export default function UserDetailsPage() {
  const params = useParams();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useGetUserDetailsQuery(userId || '', { skip: !userId });

  const {
    data: organisations = [] as Organisation[],
    isLoading: isOrgsLoading,
    isError: isOrgsError,
  } = useGetUserOrganisationsQuery(userId || '', { skip: !userId });

  const {
    data: deliverables = [] as Deliverable[],
    isLoading: isDeliverablesLoading,
    isError: isDeliverablesError,
  } = useGetUserDeliverablesQuery(userId || '', { skip: !userId });

  const {
    data: worklogsData = [],
    isLoading: isWorklogsLoading,
    isError: isWorklogsError,
  } = useGetUserWorkLogsQuery(userId || '', { skip: !userId });

  // Convert API response to WorkLog type
  const worklogs: WorkLog[] = worklogsData.map(log => ({
    id: log.id,
    start_time: log.start_time,
    end_time: log.end_time ?? null,
    duration: log.duration ?? null,
    deliverable: log.deliverable,
    project: log.project
  }));

  if (!userId || typeof userId !== 'string') {
    return <div className="p-8 text-red-500">Invalid user ID. Please check the URL.</div>;
  }

  if (isUserLoading || isOrgsLoading || isDeliverablesLoading || isWorklogsLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  if (isUserError || !user) {
    return <div className="p-8 text-red-500">Error loading user details. Please try again later.</div>;
  }

  const totalHours = worklogs.reduce((sum, log) => sum + (log.duration || 0), 0);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">User Details</h1>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">First Name</p>
            <p className="text-gray-900">{user.first_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last Name</p>
            <p className="text-gray-900">{user.last_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-gray-900">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="text-gray-900">{user.phone || "Not provided"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Organisation Memberships</h2>
        {isOrgsError ? (
          <p className="text-red-500">Error loading organisations</p>
        ) : organisations.length === 0 ? (
          <p className="text-gray-500">No organisation memberships found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organisation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organisations.map((org) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{org.organisation.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          org.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : org.role === "manager"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                        }`}
                      >
                        {org.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeliverablesTable deliverables={deliverables} isError={isDeliverablesError} />
      <WorkTable worklogs={worklogs} isError={isWorklogsError} totalHours={totalHours} />
    </div>
  );
}