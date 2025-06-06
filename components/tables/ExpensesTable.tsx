// components/tables/ExpensesTable.tsx
"use client";

import { useState, useMemo } from "react";
import { Expense, EditableExpense, Project } from "@/types/expenses";
import { format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/common";

interface Props {
  expenses: Expense[];
  projects: Project[];
  onDelete: (id: number) => void;
  onUpdate: (expense: EditableExpense) => Promise<void>;
  refetch: () => void;
  isLoading?: boolean;
  selectedDate?: Date | null;
  monthRange?: { start: Date; end: Date };
}

export default function ExpensesTable({
  expenses,
  projects,
  onDelete,
  onUpdate,
  refetch,
  isLoading = false,
  selectedDate,
  monthRange,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableExpense, setEditableExpense] = useState<EditableExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter expenses based on selected date or month range
  const filteredExpenses = useMemo(() => {
    if (selectedDate) {
      return expenses.filter((expense) => {
        try {
          const expenseDate = expense.date ? parseISO(expense.date) : null;
          return expenseDate && isSameDay(expenseDate, selectedDate);
        } catch {
          return false;
        }
      });
    } else if (monthRange) {
      return expenses.filter((expense) => {
        try {
          const expenseDate = expense.date ? parseISO(expense.date) : null;
          return expenseDate && isWithinInterval(expenseDate, { 
            start: monthRange.start, 
            end: monthRange.end 
          });
        } catch {
          return false;
        }
      });
    }
    return expenses;
  }, [expenses, selectedDate, monthRange]);

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditableExpense({
      id: expense.id,
      project_id: expense.project.id,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      remarks: expense.remarks || "",
    });
  };

  const handleFieldChange = <K extends keyof EditableExpense>(
    field: K,
    value: EditableExpense[K]
  ) => {
    if (!editableExpense) return;
    setEditableExpense({
      ...editableExpense,
      [field]: value,
    });
  };

  const saveEditing = async () => {
    if (!editableExpense || !editingId) return;
    setError(null);

    try {
      if (!editableExpense.project_id) {
        throw new Error("Project is required");
      }

      if (!editableExpense.amount || Number(editableExpense.amount) <= 0) {
        throw new Error("Please enter a valid amount");
      }

      await onUpdate(editableExpense);
      setEditingId(null);
      setEditableExpense(null);
      refetch();
    } catch (err) {
      console.error("Failed to update expense:", err);
      setError(err instanceof Error ? err.message : "Failed to update expense");
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditableExpense(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded">{error}</div>
      )}

      {selectedDate ? (
        <div className="mb-4 text-sm text-gray-600">
          Showing expenses for: {format(selectedDate, "MMMM d, yyyy")}
        </div>
      ) : monthRange && (
        <div className="mb-4 text-sm text-gray-600">
          Showing expenses from {format(monthRange.start, "MMM d")} to {format(monthRange.end, "MMM d, yyyy")}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table headers and rows remain the same as before */}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Remarks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id}>
                {/* Table cells remain the same as before */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === expense.id ? (
                    <select
                      value={editableExpense?.project_id || ""}
                      onChange={(e) =>
                        handleFieldChange("project_id", Number(e.target.value))
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                    >
                      <option value="">Select project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    expense.project?.name || "N/A"
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === expense.id ? (
                    <input
                      type="number"
                      value={editableExpense?.amount || ""}
                      onChange={(e) =>
                        handleFieldChange("amount", e.target.value)
                      }
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
                    />
                  ) : (
                    `₹${parseFloat(expense.amount).toFixed(2)}`
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === expense.id ? (
                    <select
                      value={editableExpense?.category || "travel"}
                      onChange={(e) =>
                        handleFieldChange("category", e.target.value)
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                    >
                      <option value="travel">Travel</option>
                      <option value="stationery">Stationery</option>
                      <option value="food">Food</option>
                      <option value="accommodation">Accommodation</option>
                      <option value="others">Others</option>
                    </select>
                  ) : (
                    expense.category_name
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === expense.id ? (
                    <input
                      type="date"
                      value={
                        editableExpense?.date
                          ? new Date(editableExpense.date)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        handleFieldChange("date", e.target.value)
                      }
                      className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
                    />
                  ) : (
                    format(new Date(expense.date), "dd MMM yyyy")
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === expense.id ? (
                    <input
                      type="text"
                      value={editableExpense?.remarks || ""}
                      onChange={(e) =>
                        handleFieldChange("remarks", e.target.value)
                      }
                      className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
                    />
                  ) : (
                    expense.remarks || "-"
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {editingId === expense.id ? (
                    <>
                      <button
                        onClick={saveEditing}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => onDelete(expense.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}