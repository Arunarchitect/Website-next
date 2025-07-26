// quizApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";

interface Question {
  id: number;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  correct_option: string;
  explanation?: string;
}

export const quizApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Only endpoint - get quiz questions
    getQuizQuestions: builder.query<Question[], void>({
      query: () => "/get-quiz/",
      // Optional: Add tags if you want to invalidate cache later
      providesTags: [{ type: "Quiz", id: "LIST" }],
    }),
    
    // No other endpoints needed since submission/scoring is frontend-only
  }),
});

// Export the auto-generated hook
export const { useGetQuizQuestionsQuery } = quizApiSlice;