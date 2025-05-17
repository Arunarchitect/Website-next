"use client";

import { useEffect, useState } from "react";
import { 
  useGetMyOrganisationsQuery,
  useGetOrganisationMembersQuery 
} from "@/redux/features/membershipApiSlice";
import { Spinner } from "@/components/common";
import { useRouter } from "next/navigation";

export default function HRPage() {
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const {
    data: organisations = [],
    isLoading: isOrgsLoading,
    isError: isOrgsError,
  } = useGetMyOrganisationsQuery();

  // Set default org (alphabetically first) after loading
  useEffect(() => {
    if (organisations.length && selectedOrgId === null) {
      const sorted = [...organisations].sort((a, b) => a.name.localeCompare(b.name));
      setSelectedOrgId(sorted[0].id);
    }
  }, [organisations, selectedOrgId]);

  const {
    data: members = [],
    isLoading: isMembersLoading,
    isError: isMembersError,
  } = useGetOrganisationMembersQuery(selectedOrgId || 0, {
    skip: !selectedOrgId,
  });

  const handleUserClick = (userId: number) => {
    router.push(`/hr/users/${userId}`);
  };

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

  const sortedOrgs = [...organisations].sort((a, b) => a.name.localeCompare(b.name));
  const selectedOrg = organisations.find(o => o.id === selectedOrgId);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">HR Dashboard</h1>
      <p className="text-gray-700 mb-6">
        Manage organization members and their roles.
      </p>

      {/* Organisation Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {sortedOrgs.map((org) => (
          <button
            key={org.id}
            onClick={() => setSelectedOrgId(org.id)}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
              selectedOrgId === org.id
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {org.name}
          </button>
        ))}
      </div>

      {/* Members Table */}
      {selectedOrgId && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Members of {selectedOrg?.name}
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
                    <tr 
                      key={member.id}
                      onClick={() => handleUserClick(member.user.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {member.user.first_name} {member.user.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.user.email}
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
