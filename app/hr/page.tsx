"use client";

import { useState } from "react";

type Member = {
  id: number;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
  role: string;
};

type MembersByOrgId = {
  [key: number]: Member[];
};

const dummyOrganisations = [
  { id: 1, name: "OrgOne" },
  { id: 2, name: "OrgTwo" },
];

const dummyMembers: MembersByOrgId = {
  1: [
    {
      id: 101,
      user: { first_name: "Alice", last_name: "Johnson", email: "alice@orgone.com" },
      role: "admin",
    },
    {
      id: 102,
      user: { first_name: "Bob", last_name: "Smith", email: "bob@orgone.com" },
      role: "member",
    },
  ],
  2: [
    {
      id: 201,
      user: { first_name: "Charlie", last_name: "Brown", email: "charlie@orgtwo.com" },
      role: "manager",
    },
    {
      id: 202,
      user: { first_name: "Diana", last_name: "White", email: "diana@orgtwo.com" },
      role: "member",
    },
  ],
};

export default function HRPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const members = selectedOrgId ? dummyMembers[selectedOrgId] || [] : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">HR Dashboard</h1>
      <p className="text-gray-700 mb-6">Welcome to the HR section of the app.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Filter by Organisation:
        </label>
        <select
          className="border border-gray-300 rounded px-3 py-2 w-full max-w-sm"
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(Number(e.target.value))}
        >
          <option value="">-- Select an organisation --</option>
          {dummyOrganisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {selectedOrgId && (
        <>
          {members.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-600">
                    <th className="py-2 px-4 border-b">Name</th>
                    <th className="py-2 px-4 border-b">Email</th>
                    <th className="py-2 px-4 border-b">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="text-sm text-gray-700">
                      <td className="py-2 px-4 border-b">
                        {member.user.first_name} {member.user.last_name}
                      </td>
                      <td className="py-2 px-4 border-b">{member.user.email}</td>
                      <td className="py-2 px-4 border-b capitalize">{member.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 mt-4">No users found in this organisation.</p>
          )}
        </>
      )}
    </div>
  );
}