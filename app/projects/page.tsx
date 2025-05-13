"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetMyOrganisationsQuery } from "@/redux/features/membershipApiSlice";
import { logout } from "@/redux/features/authSlice";
import ProjectFilter from "@/components/project/ProjectFilter";
import ProjectCard from "@/components/project/ProjectCard";
import DownloadCSVButtons from "@/components/project/DownloadCSVButtons";

export default function ProjectsPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get("org");
  const [filterOrgId, setFilterOrgId] = useState<number | null>(null);

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useGetProjectsQuery();
  const { data: organisations = [], isLoading: organisationsLoading, error: organisationsError } = useGetMyOrganisationsQuery();

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(logout());
    }
  }, [isAuthenticated, dispatch]);

  const adminOrganisations = useMemo(() => organisations.map((org) => ({
    id: org.id,
    name: org.name || `Organization ${org.id}`,
  })), [organisations]);

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

  if (!isAuthenticated) {
    return <div className="p-10 text-white flex flex-col items-center space-y-4 min-h-screen bg-gray-900">Please Log In to Access Projects</div>;
  }

  if (projectsLoading || organisationsLoading) {
    return <div className="min-h-screen bg-gray-900 p-10 text-white">Loading projects...</div>;
  }

  if (projectsError || organisationsError) {
    return <div className="min-h-screen bg-gray-900 p-10 text-white">Error loading projects. Please try again.</div>;
  }

  if (adminOrganisations.length === 0) {
    return <div className="min-h-screen bg-gray-900 p-10 text-white">You don&apos;t have admin access to any organizations.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <ProjectFilter filterOrgId={filterOrgId} setFilterOrgId={setFilterOrgId} organisations={adminOrganisations} />
        <DownloadCSVButtons />
      </div>

      {filterOrgId && <h2 className="text-xl text-white mb-6">{adminOrganisations.find((o) => o.id === filterOrgId)?.name}</h2>}

      {filteredProjects.length === 0 ? (
        <div className="text-white p-4 bg-gray-800 rounded-lg">
          {filterOrgId ? "No projects found for the selected organization." : "Please select an organization to view projects."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProjects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
