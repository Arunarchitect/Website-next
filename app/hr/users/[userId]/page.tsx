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
import { format } from "date-fns";

export default function UserDetailsPage() {
  const params = useParams();

  // Safely extract userId from params
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  // Call all hooks unconditionally at the top with skip option
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useGetUserDetailsQuery(userId || '', { skip: !userId });

  const {
    data: organisations = [],
    isLoading: isOrgsLoading,
    isError: isOrgsError,
  } = useGetUserOrganisationsQuery(userId || '', { skip: !userId });

  const {
    data: deliverables = [],
    isLoading: isDeliverablesLoading,
    isError: isDeliverablesError,
  } = useGetUserDeliverablesQuery(userId || '', { skip: !userId });

  const {
    data: worklogs = [],
    isLoading: isWorklogsLoading,
    isError: isWorklogsError,
  } = useGetUserWorkLogsQuery(userId || '', { skip: !userId });

  // Guard against undefined or invalid userId
  if (!userId || typeof userId !== 'string') {
    return (
      <div className="p-8 text-red-500">
        Invalid user ID. Please check the URL.
      </div>
    );
  }

  if (isUserLoading || isOrgsLoading || isDeliverablesLoading || isWorklogsLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="p-8 text-red-500">
        Error loading user details. Please try again later.
      </div>
    );
  }

  const totalHours = worklogs.reduce((sum, log) => {
    return sum + (log.duration || 0);
  }, 0);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">User Details</h1>

      {/* Personal Info */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Personal Information
        </h2>
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

      {/* Organisation Memberships */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Organisation Memberships
        </h2>
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
                      <div className="text-sm text-gray-900">
                        {org.organisation.name}
                      </div>
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

      {/* Assigned Deliverables */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Assigned Deliverables
        </h2>
        {isDeliverablesError ? (
          <p className="text-red-500">Error loading deliverables</p>
        ) : deliverables.length === 0 ? (
          <p className="text-gray-500">No deliverables assigned</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deliverable
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deliverables.map((deliverable) => (
                  <tr key={deliverable.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {deliverable.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {deliverable.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {deliverable.stage_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          deliverable.status === "passed"
                            ? "bg-green-100 text-green-800"
                            : deliverable.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : deliverable.status === "ready"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {deliverable.status_name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Work Logs */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Work Logs</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-500">Total Hours Worked</p>
          <p className="text-xl font-semibold text-gray-900">
            {totalHours.toFixed(2)} hours
          </p>
        </div>
        {isWorklogsError ? (
          <p className="text-red-500">Error loading work logs</p>
        ) : worklogs.length === 0 ? (
          <p className="text-gray-500">No work logs found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deliverable
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration (hours)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {worklogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(log.start_time), "yyyy-MM-dd")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.deliverable}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.project}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(log.start_time), "HH:mm")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.end_time
                        ? format(new Date(log.end_time), "HH:mm")
                        : "In progress"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.duration?.toFixed(2) ?? "N/A"}
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