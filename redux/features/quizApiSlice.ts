// redux/features/quizApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";
import { Exam, Category, Question, QuizParams, EvaluationRequest, EvaluationResponse } from "@/app/tools/quiz/types/quiztypes";

export const quizApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getExams: builder.query<Exam[], void>({
      query: () => "/exams/",
      providesTags: ["Exams"],
    }),

    getCategories: builder.query<Category[], void>({
      query: () => "/categories/",
      providesTags: ["Categories"],
    }),

    getExamCategories: builder.query<Category[], number>({
      query: (examId) => `/exam-categories/${examId}/`,
      providesTags: ["Categories"],
    }),

    getQuizQuestions: builder.query<Question[], QuizParams>({
      query: (params) => ({
        url: "/get-quiz/",
        method: "POST",
        body: params,
      }),
      providesTags: ["Quiz"],
    }),

    evaluateQuiz: builder.mutation<EvaluationResponse, EvaluationRequest>({
      query: (data) => ({
        url: "/evaluate/",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Quiz"],
    }),
  }),
});

export const {
  useGetExamsQuery,
  useGetCategoriesQuery,
  useLazyGetExamCategoriesQuery,
  useGetQuizQuestionsQuery,
  useLazyGetQuizQuestionsQuery,
  useEvaluateQuizMutation,
} = quizApiSlice;