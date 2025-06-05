"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { useRetrieveUserQuery } from "@/redux/features/authApiSlice";
import {
  useGetMyMembershipsQuery,
  useGetMyOrganisationsQuery,
} from "@/redux/features/membershipApiSlice";
import {
  useGetWorklogsQuery,
  useDeleteWorklogMutation,
  useUpdateWorklogMutation,
} from "@/redux/features/worklogApiSlice";
import { useGetProjectsQuery } from "@/redux/features/projectApiSlice";
import { useGetDeliverablesQuery } from "@/redux/features/deliverableApiSlice";
import {
  useGetExpensesQuery,
  useDeleteExpenseMutation,
  useUpdateExpenseMutation,
  useCreateExpenseMutation,
} from "@/redux/features/expenseApiSlice";
import WorklogForm from "@/components/forms/WorklogForm";
import ExpenseForm from "@/components/forms/ExpenseForm";
import WorklogsTable from "@/components/tables/WorklogsTable";
import ExpensesTable from "@/components/tables/ExpensesTable";
import { EditableWorklog, Worklog } from "@/types/worklogs";
import {
  Expense,
  CreateExpenseRequest,
  EditableExpense,
} from "@/types/expenses";
import { Spinner } from "@/components/common";

interface Organization {
  id: number;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // User data
  const {
    data: user,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
  } = useRetrieveUserQuery();

  // Memberships data
  const {
    data: memberships = [],
    isLoading: isMembershipLoading,
    isFetching: isMembershipFetching,
  } = useGetMyMembershipsQuery();

  // Organizations data
  const {
    data: organisations = [],
    isLoading: isOrgLoading,
    isFetching: isOrgFetching,
  } = useGetMyOrganisationsQuery();

  // Worklogs data
  const { data: allWorklogs = [], refetch: refetchWorklogs } =
    useGetWorklogsQuery();

  // Projects and deliverables data
  const { data: projects = [] } = useGetProjectsQuery();
  const { data: deliverables = [] } = useGetDeliverablesQuery();

  const {
    data: expenses = [],
    refetch: refetchExpenses,
    isLoading: isExpensesLoading,
  } = useGetExpensesQuery({
    start_date: dateRange?.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : undefined,
    end_date: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
  });

  // Mutations
  const [deleteWorklog] = useDeleteWorklogMutation();
  const [updateWorklog] = useUpdateWorklogMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [updateExpense] = useUpdateExpenseMutation();
  const [createExpense] = useCreateExpenseMutation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Loading states
  const isLoading =
    isUserLoading ||
    isUserFetching ||
    isMembershipLoading ||
    isMembershipFetching ||
    isOrgLoading ||
    isOrgFetching;

  // Filter worklogs for current user
  const userWorklogs = allWorklogs.filter(
    (worklog: Worklog) => worklog.employee === user?.id
  );

  // Get admin organizations from memberships
  const adminMemberships = memberships.filter(
    (membership) => membership.role === "admin"
  );

  // Create admin organizations array with names
  const adminOrganizations: Organization[] = adminMemberships.map(
    (membership) => {
      const org = organisations.find((o) => o.id === membership.organisation);
      return {
        id: membership.organisation,
        name: org?.name || `Organization ${membership.organisation}`,
      };
    }
  );

  const isAdmin = adminOrganizations.length > 0;

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
      if (typeof worklog.id !== "number") {
        throw new Error("Invalid worklog ID");
      }

      await updateWorklog({
        id: worklog.id,
        project: worklog.project,
        deliverable: worklog.deliverable,
        start_time: worklog.start_time,
        end_time: worklog.end_time,
        remarks: worklog.remarks,
      }).unwrap();
    } catch (err) {
      console.error("Failed to update worklog:", err);
      throw err;
    }
  };

  const handleGoToProjects = () => {
    if (selectedOrgId) {
      setIsModalOpen(false);
      router.push(`/projects?org=${selectedOrgId}`);
    }
  };

  if (isLoading || !isMounted) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  const handleDeleteExpense = async (id: number) => {
    try {
      await deleteExpense(id).unwrap();
      refetchExpenses();
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
  };

  const handleUpdateExpense = async (
    expense: EditableExpense
  ): Promise<void> => {
    try {
      if (typeof expense.id !== "number") {
        throw new Error("Invalid expense ID");
      }

      const updateData = {
        project_id: expense.project_id, // Use project_id
        amount: Number(expense.amount), // Ensure number
        category: expense.category,
        date: new Date(expense.date).toISOString().split("T")[0], // Format date
        remarks: expense.remarks || "",
      };

      await updateExpense({
        id: expense.id,
        ...updateData,
      }).unwrap();

      refetchExpenses();
    } catch (err) {
      console.error("Failed to update expense:", err);
      throw err;
    }
  };

  // Add this handler function to your component
  const handleCreateExpense = async (expenseData: CreateExpenseRequest) => {
    try {
      const payload = {
        project_id: expenseData.project_id, // Make sure this matches API expectations
        amount: Number(expenseData.amount),
        category: expenseData.category,
        date: expenseData.date,
        remarks: expenseData.remarks || "",
      };

      await createExpense(payload).unwrap();
      refetchExpenses();
    } catch (err) {
      console.error("Failed to create expense:", err);
      throw err;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </header>

      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <p className="text-lg text-gray-700">
          Hi {user?.first_name} {user?.last_name}, welcome onboard!
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Your registered email is {user?.email}
        </p>

        {isAdmin && (
          <div className="mt-4 space-x-4 flex">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Projects
            </button>
            <button
              onClick={() => router.push("/hr")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              HR Dashboard
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add Worklog</h2>
          {user?.id && (
            <WorklogForm userId={user.id} onSuccess={refetchWorklogs} />
          )}
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add Expense</h2>
          <ExpenseForm
            projects={projects}
            onSuccess={() => refetchExpenses()}
            onSubmit={handleCreateExpense}
            onCancel={() => {}}
          />
        </div>
      </div>

      <WorklogsTable
        worklogs={userWorklogs}
        projects={projects}
        deliverables={deliverables}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        refetch={refetchWorklogs}
      />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Expenses</h2>
      </div>

      <ExpensesTable
        expenses={expenses}
        projects={projects}
        onDelete={handleDeleteExpense}
        onUpdate={handleUpdateExpense}
        refetch={refetchExpenses}
        isLoading={isExpensesLoading}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Select an Organization
            </h2>
            <select
              value={selectedOrgId ?? ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
            >
              <option value="">-- Choose an organization --</option>
              {adminOrganizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:underline"
              >
                Cancel
              </button>
              <button
                onClick={handleGoToProjects}
                disabled={!selectedOrgId}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  !selectedOrgId ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Go to Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
