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

// types/expenses.ts
export interface CreateExpenseRequest {
  project_id: number;
  amount: number;
  category: string;
  date: string;
  remarks?: string;
}

export interface EditableExpense {
  id: number;
  project_id: number;
  amount: number | string;
  category: string;
  date: string;
  remarks?: string;
}

export interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
}
