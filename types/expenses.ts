// types/expenses.ts
export interface Expense {
  id: number;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  project: {
    id: number;
    name: string;
    location: string;
    client_name: string;
    current_stage: string;
  };
  amount: string;
  category: string;
  category_name: string;
  date: string;
  remarks: string;
  created_at: string;
}

export interface CreateExpenseRequest {
  project_id: number;
  amount: number;
  category: string;
  date: string;
  remarks: string;
}

// Add a new type for editable expense
export interface EditableExpense {
  id: number;
  project_id: number;  // Changed from project to project_id
  amount: number | string;
  category: string;
  date: string;
  remarks?: string;
}