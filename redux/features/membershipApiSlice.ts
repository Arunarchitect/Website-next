import { apiSlice } from "@/redux/services/apiSlice";

export interface Organisation {
  id: number;
  name: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface OrganisationMembership {
  id: number;
  organisation: number;  // organisation ID
  user: User;
  role: 'admin' | 'manager' | 'member' | 'client';
}

export const membershipApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Gets all memberships for the current user
    getMyMemberships: builder.query<OrganisationMembership[], void>({
      query: () => "/my-memberships/",
      providesTags: ["Memberships"],  // Changed to use "Memberships" tag
    }),

    // Gets all organizations where the user is a member
    getMyOrganisations: builder.query<Organisation[], void>({
      query: () => "/my-organisations/",
      providesTags: ["Organisations"],  // Changed to use "Organisations" tag
    }),

    // Gets all members of a specific organization (for HR dashboard)
    getOrganisationMembers: builder.query<OrganisationMembership[], number>({
      query: (orgId) => `/organisations/${orgId}/members/`,
      providesTags: (result, error, orgId) => 
        result ? [{ type: 'OrganisationMembers', id: orgId }] : [],  // Corrected tag association
    }),

    // Gets all projects for a specific organization
    getOrganisationProjects: builder.query<Project[], number>({
      query: (orgId) => `/organisations/${orgId}/projects/`,
      providesTags: (result, error, orgId) => 
        result ? [{ type: 'OrganisationProjects', id: orgId }] : [],  // Corrected tag association
    }),
  }),
});

export const { 
  useGetMyMembershipsQuery,
  useGetMyOrganisationsQuery,
  useGetOrganisationMembersQuery,
  useGetOrganisationProjectsQuery 
} = membershipApiSlice;

// Additional types for projects and deliverables
export interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
  organisation: number;
}

export interface Deliverable {
  id: number;
  project: number;
  name: string;
  stage: string;
  status: string;
  remarks?: string;
  start_date?: string;
  end_date?: string;
  assignee?: number;
  validator?: number;
  validation_date?: string;
}
