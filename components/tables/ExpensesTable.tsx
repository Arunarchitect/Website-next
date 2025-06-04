// components/tables/ExpensesTable.tsx
"use client";

import { useState, useMemo } from "react";
import { Expense, EditableExpense } from "@/types/expenses";
import { format } from "date-fns";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/common";

interface Props {
  expenses: Expense[];
  projects: any[];
  onDelete: (id: number) => void;
  onUpdate: (expense: EditableExpense) => Promise<void>;
  refetch: () => void;
  isLoading?: boolean;
}

export default function ExpensesTable({
  expenses,
  projects,
  onDelete,
  onUpdate,
  refetch,
  isLoading = false,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableExpense, setEditableExpense] = useState<EditableExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

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

      // Create the update payload
      const updatePayload: EditableExpense = {
        ...editableExpense,
        amount: editableExpense.amount, // Keep as string if your API expects string
        // Or convert to number if needed:
        // amount: Number(editableExpense.amount),
      };

      await onUpdate(updatePayload);
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
    <div className="mt-8">
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
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
            {expenses.map((expense) => (
              <tr key={expense.id}>
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
                      <option value="other">Other</option>
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