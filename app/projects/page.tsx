"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetMyMembershipsQuery, useGetMyOrganisationsQuery } from "@/redux/features/membershipApiSlice";
import {
  useDownloadDeliverablesCSVQuery,
  useDownloadWorklogsCSVQuery,
} from "@/redux/features/csvApiSlice";
import { logout } from "@/redux/features/authSlice";

const NOTE_COLORS = [
  "#fde047", "#86efac", "#93c5fd", "#fca5a5",
  "#c4b5fd", "#f9a8d4", "#fdba74", "#5eead4"
];

export default function ProjectsPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get("org");
  const [filterOrgId, setFilterOrgId] = useState<number | null>(null);

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useGetProjectsQuery();
  const { data: organisations = [], isLoading: organisationsLoading, error: organisationsError } = useGetMyOrganisationsQuery();
  const { data: deliverablesCSVData } = useDownloadDeliverablesCSVQuery();
  const { data: worklogsCSVData } = useDownloadWorklogsCSVQuery();

  const getProjectColor = (index: number) => NOTE_COLORS[index % NOTE_COLORS.length];

  // Debugging: Log the organisations data to ensure it's correct
  useEffect(() => {
    console.log("Organisations:", organisations);
  }, [organisations]);

  const adminOrganisations = useMemo(() => {
    return organisations.map((org) => ({
      id: org.id,
      name: org.name || `Organization ${org.id}`,
    }));
  }, [organisations]);

  const adminOrganisationIds = useMemo(() => adminOrganisations.map((org) => org.id), [adminOrganisations]);

  useEffect(() => {
    if (orgIdParam) {
      const orgId = Number(orgIdParam);
      setFilterOrgId(adminOrganisationIds.includes(orgId) ? orgId : null);
    }
  }, [orgIdParam, adminOrganisationIds]);

  const filteredProjects = useMemo(() => {
    if (!filterOrgId || !adminOrganisationIds.includes(filterOrgId)) return [];
    return projects.filter((p) => p.organisation === filterOrgId);
  }, [projects, filterOrgId, adminOrganisationIds]);

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(logout());
    }
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated) {
    return (
      <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-gray-900">
        <h1 className="text-2xl font-bold">Please Log In to Access Projects</h1>
      </div>
    );
  }

  if (projectsLoading || organisationsLoading || membershipsLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p>Loading projects...</p>
      </div>
    );
  }

  if (projectsError || organisationsError || membershipsError) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p className="text-red-500">Error loading projects. Please try again.</p>
      </div>
    );
  }

  if (adminOrganisations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 p-10 text-white">
        <p className="text-red-500">You don&apos;t have admin access to any organizations.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6 mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-white">Projects</h1>

          <div className="flex items-center space-x-2">
            <span className="text-white">Filter by:</span>
            <select
              value={filterOrgId ?? ""}
              onChange={(e) => setFilterOrgId(e.target.value ? Number(e.target.value) : null)}
              className="bg-gray-800 text-white rounded px-3 py-2"
            >
              <option value="">All Organizations</option>
              {adminOrganisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex space-x-4">
          {deliverablesCSVData && (
            <button
              onClick={() => {
                const blob = new Blob([deliverablesCSVData], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "deliverables.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Download Deliverables
            </button>
          )}
          {worklogsCSVData && (
            <button
              onClick={() => {
                const blob = new Blob([worklogsCSVData], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "worklogs.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Download Worklogs
            </button>
          )}
        </div>
      </div>

      {filterOrgId && (
        <h2 className="text-xl text-white mb-6">
          {adminOrganisations.find((o) => o.id === filterOrgId)?.name}
        </h2>
      )}

      {filteredProjects.length === 0 ? (
        <div className="text-white p-4 bg-gray-800 rounded-lg">
          {filterOrgId
            ? "No projects found for the selected organization."
            : "Please select an organization to view projects."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProjects.map((project, index) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div
                className="sticky-note transform hover:scale-105 transition-transform duration-200"
                style={{
                  backgroundColor: getProjectColor(index),
                  rotate: `${index % 2 === 0 ? "-1deg" : "1deg"}`,
                }}
              >
                <div className="p-5 h-full flex flex-col text-gray-900">
                  <h2 className="text-xl font-bold mb-3 break-words">{project.name}</h2>
                  <div className="mb-4 flex-grow">
                    <p className="text-sm font-semibold mb-1">Client:</p>
                    <p className="text-sm break-words">{project.client_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Location:</p>
                    <p className="text-sm break-words">{project.location || "N/A"}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
