// redux/features/quizApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";
import {
  Exam,
  Category,
  Question,
  QuizParams,
  EvaluationRequest,
  EvaluationResponse,
  ScoreStats,
  ExamScoreBreakdown,
  CategoryScoreBreakdown,
  QuizResponse,
  QuizMetadata,
} from "@/app/tools/quiz/types/quiztypes";

export interface UserStatsResponse {
  has_attempts: boolean;
  average_score: number;
  overall_stats: {
    average_score: number;
    highest_score: number;
    lowest_score: number;
    total_attempts: number;
    last_attempt: string;
    recent_activity: number;
  };
  exam_breakdown: Array<{
    exam_id: number;
    exam_name: string;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    attempt_count: number;
  }>;
  category_breakdown: Array<{
    category_id: number;
    category_name: string;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    attempt_count: number;
  }>;
  summary: {
    total_quizzes_taken: number;
    exams_attempted: number;
    categories_attempted: number;
    recent_activity: number;
  };
}

export interface ProgressData {
  week: string;
  average_score: number;
  attempt_count: number;
  period: string;
}

// Unfinished quiz stored on the server
export interface AttemptPayload {
  question_ids: number[];
  answers: Record<string, string>;
  metadata: QuizMetadata | null;
  exam: number | null;
  category: number | null;
  total_seconds: number | null;
  remaining_seconds: number | null;
  paused: boolean;
}

export interface AttemptResponse {
  attempt: null | {
    questions: Question[];
    answers: Record<string, string>;
    metadata: QuizMetadata | null;
    exam: number | null;
    category: number | null;
    total_seconds: number | null;
    remaining_seconds: number | null;
    paused: boolean;
    updated_at: string;
  };
}

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

    getQuizQuestions: builder.query<QuizResponse, QuizParams>({
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
      invalidatesTags: ["Quiz", "Scores"],
    }),

    // ---- unfinished quiz (cross-device resume) ----
    getAttempt: builder.query<AttemptResponse, void>({
      query: () => "/attempt/",
      keepUnusedDataFor: 0,
    }),

    saveAttempt: builder.mutation<{ updated_at: string }, AttemptPayload>({
      query: (body) => ({
        url: "/attempt/",
        method: "PUT",
        body,
      }),
    }),

    deleteAttempt: builder.mutation<void, void>({
      query: () => ({
        url: "/attempt/",
        method: "DELETE",
      }),
    }),

    downloadQuestionsTemplate: builder.mutation<Blob, void>({
      query: () => ({
        url: "/download-template/",
        responseHandler: (response) => response.blob(),
        cache: "no-cache",
      }),
    }),

    uploadQuestionsCSV: builder.mutation<{
      created: number,
      errors: string[]
    }, FormData>({
      query: (formData) => ({
        url: "/upload-csv/",
        method: "POST",
        body: formData,
        headers: {},
      }),
      invalidatesTags: ["Quiz", "Exams", "Categories"],
    }),

    getScoreStats: builder.query<ScoreStats, void>({
      query: () => "/scores/stats/",
      providesTags: ["Scores"],
    }),

    getScoresByExam: builder.query<ExamScoreBreakdown[], void>({
      query: () => "/scores/by_exam/",
      providesTags: ["Scores"],
    }),

    getScoresByCategory: builder.query<CategoryScoreBreakdown[], void>({
      query: () => "/scores/by_category/",
      providesTags: ["Scores"],
    }),

    getUserStats: builder.query<UserStatsResponse, void>({
      query: () => "/scores/user_stats/",
      providesTags: ["Scores"],
    }),

    getProgressOverTime: builder.query<ProgressData[], void>({
      query: () => "/scores/progress_over_time/",
      providesTags: ["Scores"],
    }),

    getFilteredScores: builder.query<{
      results: Array<{
        id: number;
        score: number;
        date: string;
        exam?: Exam;
        category?: Category;
      }>;
      count: number;
    }, {
      exam?: number;
      category?: number;
      limit?: number;
      offset?: number;
    }>({
      query: (params) => ({
        url: "/scores/",
        params: {
          exam: params.exam,
          category: params.category,
          limit: params.limit,
          offset: params.offset
        }
      }),
      providesTags: ["Scores"],
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
  useLazyGetAttemptQuery,
  useSaveAttemptMutation,
  useDeleteAttemptMutation,
  useDownloadQuestionsTemplateMutation,
  useUploadQuestionsCSVMutation,
  useGetScoreStatsQuery,
  useGetScoresByExamQuery,
  useGetScoresByCategoryQuery,
  useGetUserStatsQuery,
  useGetProgressOverTimeQuery,
  useLazyGetFilteredScoresQuery,
} = quizApiSlice;