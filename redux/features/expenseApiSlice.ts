// expenseApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
}

export interface Expense {
  id: number;
  user: User;
  project: Project;
  amount: string;
  category: string;
  category_name: string;
  date: string;
  remarks: string;
  created_at: string;
}

interface CreateExpenseRequest {
  project: number;
  amount: number;
  category: string;
  date: string;
  remarks?: string;
}

interface UpdateExpenseRequest extends Partial<CreateExpenseRequest> {
  id: number;
}

export const expenseApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createExpense: builder.mutation<Expense, CreateExpenseRequest>({
      query: (body) => ({
        url: "/expenses/",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Expense"],
    }),

    getExpenses: builder.query<Expense[], { start_date?: string; end_date?: string }>({
      query: (params) => ({
        url: "/expenses/",
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Expense" as const, id })),
              { type: "Expense", id: "LIST" },
            ]
          : [{ type: "Expense", id: "LIST" }],
    }),

    getExpenseById: builder.query<Expense, number>({
      query: (id) => `/expenses/${id}/`,
      providesTags: (result, error, id) => [{ type: "Expense", id }],
    }),

    updateExpense: builder.mutation<Expense, UpdateExpenseRequest>({
      query: ({ id, ...body }) => ({
        url: `/expenses/${id}/`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Expense", id }],
    }),

    deleteExpense: builder.mutation<void, number>({
      query: (id) => ({
        url: `/expenses/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Expense", id }],
    }),

    getExpenseSummary: builder.query<
      {
        total_expenses: number;
        expense_count: number;
        user_breakdown: any[];
        category_breakdown: any[];
      },
      { start_date?: string; end_date?: string }
    >({
      query: (params) => ({
        url: "/expenses/summary/",
        params,
      }),
    }),
  }),
});

export const {
  useCreateExpenseMutation,
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseSummaryQuery,
} = expenseApiSlice;