"use client";

import { useParams } from "next/navigation";
import {
  useGetUserDetailsQuery,
  useGetUserOrganisationsQuery,
  useGetUserDeliverablesQuery,
  useGetUserWorkLogsQuery,
} from "@/redux/features/userApiSlice";
import { Spinner } from "@/components/common";
import WorkTable from "@/components/tables/workTable";
import DeliverablesTable from "@/components/tables/deliverablesTable";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  isAfter,
  differenceInMinutes,
} from "date-fns";
import { UserWorkLog } from "@/types/worklogs";

export default function UserDetailsPage() {
  const params = useParams();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useGetUserDetailsQuery(userId || "", { skip: !userId });

  const {
    data: organisations = [],
    isLoading: isOrgsLoading,
    isError: isOrgsError,
  } = useGetUserOrganisationsQuery(userId || "", { skip: !userId });

  const {
    data: deliverables = [],
    isLoading: isDeliverablesLoading,
    isError: isDeliverablesError,
  } = useGetUserDeliverablesQuery(userId || "", { skip: !userId });

  const {
    data: worklogsData = [],
    isLoading: isWorklogsLoading,
    isError: isWorklogsError,
  } = useGetUserWorkLogsQuery(userId || "", { skip: !userId });

  const calculateDuration = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  };

  const worklogs: UserWorkLog[] = worklogsData.map((log) => ({
    id: log.id,
    start_time: log.start_time,
    end_time: log.end_time || log.start_time,
    duration: log.duration || calculateDuration(log.start_time, log.end_time || log.start_time),
    deliverable: log.deliverable?.toString() || 'Unknown',
    project: log.project?.toString() || 'Unknown',
    organisation: log.organisation?.toString(),
    remarks: log.remarks || null,
    employee: Number(userId)
  }));

  const activeWorkSession = worklogs.find((log) => 
    !log.end_time || isAfter(new Date(log.end_time), new Date())
  );

  if (!userId || typeof userId !== "string") {
    return <div className="p-8 text-red-500">Invalid user ID</div>;
  }

  if (isUserLoading || isOrgsLoading || isDeliverablesLoading || isWorklogsLoading) {
    return <div className="flex justify-center my-8"><Spinner lg /></div>;
  }

  if (isUserError || !user) {
    return <div className="p-8 text-red-500">Error loading user details</div>;
  }

  const getCurrentDuration = () => {
    if (!activeWorkSession) return null;
    const start = new Date(activeWorkSession.start_time);
    const end = activeWorkSession.end_time ? new Date(activeWorkSession.end_time) : new Date();
    const minutes = differenceInMinutes(end, start);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getWorkStatusMessage = () => {
    if (activeWorkSession) {
      const startTime = new Date(activeWorkSession.start_time);
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <p className="text-gray-600">
            Working on <span className="font-semibold">{activeWorkSession.deliverable}</span>
            {' '}since {format(startTime, "h:mm a")}
          </p>
        </div>
      );
    }

    if (worklogs.length === 0) return <p className="text-gray-600">No work activity</p>;

    const mostRecentLog = [...worklogs].sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )[0];

    if (!mostRecentLog.end_time) return null;
    const endTime = new Date(mostRecentLog.end_time);

    const timeMessage = isToday(endTime) 
      ? `today at ${format(endTime, "h:mm a")}`
      : isYesterday(endTime)
      ? `yesterday at ${format(endTime, "h:mm a")}`
      : `${formatDistanceToNow(endTime)} ago`;

    return (
      <p className="text-gray-600">
        Last worked on <span className="font-semibold">{mostRecentLog.deliverable}</span> {timeMessage}
      </p>
    );
  };

  const totalHours = worklogs.reduce((sum, log) => sum + log.duration, 0) / 60;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">User Details</h1>
        <div className="text-right space-y-1">
          {getWorkStatusMessage()}
          {activeWorkSession && (
            <p className="text-gray-600">
              Current session: <span className="font-semibold">{getCurrentDuration()}</span>
            </p>
          )}
        </div>
      </div>

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
          <p className="text-gray-500">No memberships found</p>
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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        org.role === "admin" ? "bg-purple-100 text-purple-800" :
                        org.role === "manager" ? "bg-blue-100 text-blue-800" :
                        "bg-green-100 text-green-800"
                      }`}>
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
      <WorkTable 
        worklogs={worklogs} 
        isError={isWorklogsError} 
        totalHours={totalHours}
        showOnlyCurrentMonth={true}
      />
    </div>
  );
}