// redux/features/quizApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";

interface Question {
  id: number;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  correct_option: string;
  explanation?: string;
  exam?: number;
  category?: number;
}

interface QuizParams {
  count?: number;
  exam?: number;
  category?: number;
}

interface EvaluationResponse {
  score: number;
  total: number;
  percentage: number;
  explanations: Array<{
    id: number;
    question: string;
    selected: string;
    correct: string;
    explanation: string;
    is_correct: boolean;
  }>;
}

export const quizApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getQuizQuestions: builder.query<Question[], QuizParams>({
      query: (params) => ({
        url: "/get-quiz/",
        method: "POST",
        body: params,
      }),
      providesTags: ["Quiz"],
    }),
    
    evaluateQuiz: builder.mutation<EvaluationResponse, Record<string, string>>({
      query: (answers) => ({
        url: "/evaluate/",
        method: "POST",
        body: answers,
      }),
      invalidatesTags: ["Quiz"],
    }),
  }),
});

export const {
  useGetQuizQuestionsQuery,
  useLazyGetQuizQuestionsQuery,
  useEvaluateQuizMutation,
} = quizApiSlice;