"use client";

import { useState } from "react";
import { Expense, CreateExpenseRequest } from "@/types/expenses";

interface Props {
  initialData?: Expense;
  projects: any[];
  onSuccess: () => void;
  onSubmit: (expenseData: CreateExpenseRequest) => Promise<void>;
  onCancel: () => void;
}


const expenseCategories = [
  { value: "travel", label: "Travel" },
  { value: "stationery", label: "Stationery" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "other", label: "Other" },
];

export default function ExpenseForm({ 
  initialData, 
  projects, 
  onSuccess, 
  onSubmit,
  onCancel 
}: Props) {
  const [formData, setFormData] = useState({
    project_id: initialData?.project?.id?.toString() || "",
    amount: initialData?.amount?.toString() || "",
    category: initialData?.category || "travel",
    date: initialData?.date || new Date().toISOString().split("T")[0],
    remarks: initialData?.remarks || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.project_id) {
      setError("Please select a project");
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const expenseData = {
        project_id: parseInt(formData.project_id),
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        remarks: formData.remarks,
      };

      await onSubmit(expenseData);
      onSuccess();
      
      // Reset form after successful submission if it's not an edit
      if (!initialData) {
        setFormData({
          project_id: "",
          amount: "",
          category: "travel",
          date: new Date().toISOString().split("T")[0],
          remarks: "",
        });
      }
    } catch (err) {
      console.error("Error submitting expense:", err);
      setError("Failed to submit expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="project_id" className="block text-sm font-medium text-gray-700">
          Project
        </label>
        <select
          id="project_id"
          value={formData.project_id}
          onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
          required
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id.toString()}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Amount (₹)
        </label>
        <input
          type="number"
          id="amount"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          step="0.01"
          min="0"
          className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
          Category
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
          required
        >
          {expenseCategories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">
          Date
        </label>
        <input
          type="date"
          id="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">
          Remarks
        </label>
        <input
          type="text"
          id="remarks"
          value={formData.remarks}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md border p-2"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : initialData ? "Update Expense" : "Add Expense"}
        </button>
      </div>
    </form>
  );
}