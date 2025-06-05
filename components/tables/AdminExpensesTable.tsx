"use client";

import { useMemo } from "react";
import { Dispatch, SetStateAction } from 'react';
import { Expense, Project } from "@/types/expenses";
import { format, isSameDay, isWithinInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Spinner } from "@/components/common";

interface Props {
  expenses: Expense[];
  projects: Project[];
  isLoading?: boolean;
  isError?: boolean;
  selectedDate?: Date | null;
  monthRange?: { start: Date; end: Date };
  showOnlyCurrentMonth?: boolean;
  setSelectedDate: Dispatch<SetStateAction<Date | null>>; // Add this line
}

export default function AdminExpensesTable({
  expenses = [],
  isLoading = false,
  isError = false,
  selectedDate,
  monthRange,
  showOnlyCurrentMonth = false,
}: Props) {
  // Determine the actual range being used
  const displayRange = useMemo(() => {
    if (selectedDate) return null;
    if (monthRange) return monthRange;
    if (showOnlyCurrentMonth) {
      return {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      };
    }
    return null;
  }, [selectedDate, monthRange, showOnlyCurrentMonth]);

  // Filter expenses based on selected date or month range
  const filteredExpenses = useMemo(() => {
    if (isError) return [];
    if (isLoading) return [];

    let result = [...expenses];
    
    if (selectedDate) {
      result = result.filter((expense) => {
        if (!expense.date) return false;
        try {
          const expenseDate = parseISO(expense.date);
          return isSameDay(expenseDate, selectedDate);
        } catch {
          return false;
        }
      });
    } else if (displayRange) {
      result = result.filter((expense) => {
        if (!expense.date) return false;
        try {
          const expenseDate = parseISO(expense.date);
          return isWithinInterval(expenseDate, {
            start: displayRange.start,
            end: displayRange.end
          });
        } catch {
          return false;
        }
      });
    }
    
    return result;
  }, [expenses, selectedDate, displayRange, isLoading, isError]);

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <Spinner lg />
      </div>
    );
  }

  if (isError) {
    return <div className="p-8 text-red-500">Error loading expenses</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {selectedDate ? (
        <div className="mb-4 text-sm text-gray-600">
          Showing expenses for: {format(selectedDate, "MMMM d, yyyy")}
        </div>
      ) : displayRange ? (
        <div className="mb-4 text-sm text-gray-600">
          Showing expenses from {format(displayRange.start, "MMM d, yyyy")} to {format(displayRange.end, "MMM d, yyyy")}
        </div>
      ) : (
        <div className="mb-4 text-sm text-gray-600">
          Showing all expenses (no date filter applied)
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No expenses found {selectedDate ? "for this date" : displayRange ? "in this date range" : ""}
                </td>
              </tr>
            ) : (
              filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.project?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.user?.first_name} {expense.user?.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ₹{parseFloat(expense.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.category_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.date ? format(parseISO(expense.date), "dd MMM yyyy") : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.remarks || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}