"use client";

import { useState } from "react";
import { 
  useGetMyOrganisationsQuery,
  useGetOrganisationMembersQuery 
} from "@/redux/features/membershipApiSlice";
import { Spinner } from "@/components/common";

export default function HRPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // Get organizations the user has access to
  const {
    data: organisations = [],
    isLoading: isOrgsLoading,
    isError: isOrgsError,
  } = useGetMyOrganisationsQuery();

  // Get members for selected organization
  const {
    data: members = [],
    isLoading: isMembersLoading,
    isError: isMembersError,
  } = useGetOrganisationMembersQuery(selectedOrgId || 0, {
    skip: !selectedOrgId, // Skip query if no org selected
  });

  if (isOrgsLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  if (isOrgsError) {
    return (
      <div className="p-8 text-red-500">
        Error loading organizations. Please try again later.
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">HR Dashboard</h1>
      <p className="text-gray-700 mb-6">
        Manage organization members and their roles.
      </p>

      {/* Organization Selector */}
      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Organization:
        </label>
        <select
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedOrgId || ""}
          onChange={(e) => setSelectedOrgId(Number(e.target.value) || null)}
        >
          <option value="">-- Select an organization --</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {/* Members Table */}
      {selectedOrgId && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Members of {organisations.find(o => o.id === selectedOrgId)?.name}
            </h2>
          </div>

          {isMembersLoading ? (
            <div className="flex justify-center p-8">
              <Spinner lg />
            </div>
          ) : isMembersError ? (
            <div className="p-4 text-red-500">
              Error loading members. Please try again.
            </div>
          ) : members.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.user.first_name} {member.user.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {member.user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            member.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'}`}>
                          {member.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No members found in this organization.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
