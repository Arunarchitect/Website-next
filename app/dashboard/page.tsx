// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isSameDay, isWithinInterval } from "date-fns";
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
import { CreateExpenseRequest, EditableExpense } from "@/types/expenses";
import { Spinner } from "@/components/common";
import { useSharedCalendar } from "@/hooks/calendar/useSharedCalendar";
import { SharedCalendar } from "@/components/common/SharedCalendar";
import { Expense } from "@/redux/features/expenseApiSlice";

interface Organization {
  id: number;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

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

  // Expenses data
  const {
    data: allExpenses = [],
    refetch: refetchExpenses,
    isLoading: isExpensesLoading,
  } = useGetExpensesQuery({});

  // Your existing userExpenses filter remains the same
  const userExpenses = useMemo(() => {
    return allExpenses.filter(
      (expense: Expense) => expense.user.id === user?.id
    );
  }, [allExpenses, user?.id]);

  // In your component body, update the useSharedCalendar hook:
  const {
    currentMonth,
    monthRange,
    worklogDates,
    expenseDates,
    selectedDate,
    setSelectedDate,
    handleMonthChange,
  } = useSharedCalendar({
    worklogs: allWorklogs,
    expenses: userExpenses, // Use the filtered expenses here
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

  // Filter worklogs for current user and selected date
  const userWorklogs = useMemo(() => {
    let filtered = allWorklogs.filter(
      (worklog: Worklog) => worklog.employee === user?.id
    );

    if (selectedDate) {
      filtered = filtered.filter((worklog) => {
        try {
          const date = worklog.start_time ? parseISO(worklog.start_time) : null;
          return date && isSameDay(date, selectedDate);
        } catch {
          return false;
        }
      });
    } else {
      // Apply month filter when no specific date is selected
      filtered = filtered.filter((worklog) => {
        try {
          const date = worklog.start_time ? parseISO(worklog.start_time) : null;
          return (
            date &&
            isWithinInterval(date, {
              start: monthRange.start,
              end: monthRange.end,
            })
          );
        } catch {
          return false;
        }
      });
    }

    return filtered;
  }, [allWorklogs, user?.id, selectedDate, monthRange]);

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
        project_id: expense.project_id,
        amount: Number(expense.amount),
        category: expense.category,
        date: new Date(expense.date).toISOString().split("T")[0],
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

  const handleCreateExpense = async (expenseData: CreateExpenseRequest) => {
    try {
      const payload = {
        project_id: expenseData.project_id,
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

      {/* Shared Calendar Section */}

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
      <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Calendar</h2>
        <SharedCalendar
          currentDate={currentMonth}
          worklogDates={worklogDates}
          expenseDates={expenseDates}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onMonthChange={handleMonthChange}
        />

        {selectedDate && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              Showing data for: {format(selectedDate, "MMMM d, yyyy")}
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Clear date filter
            </button>
          </div>
        )}
      </div>

      <WorklogsTable
        worklogs={userWorklogs}
        projects={projects}
        deliverables={deliverables}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        refetch={refetchWorklogs}
        selectedDate={selectedDate}
      />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Expenses</h2>
        <ExpensesTable
          expenses={userExpenses} // Use the filtered expenses here
          projects={projects}
          onDelete={handleDeleteExpense}
          onUpdate={handleUpdateExpense}
          refetch={refetchExpenses}
          isLoading={isExpensesLoading}
          selectedDate={selectedDate}
          monthRange={selectedDate ? undefined : monthRange}
        />
      </div>

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
