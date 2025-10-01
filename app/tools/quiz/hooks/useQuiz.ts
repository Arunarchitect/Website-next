// hooks/useQuiz.ts
import { useState } from "react";
import {
  useLazyGetQuizQuestionsQuery,
  useEvaluateQuizMutation,
  useGetExamsQuery,
  useLazyGetExamCategoriesQuery,
} from "@/redux/features/quizApiSlice";
import { 
  Question, 
  QuestionExplanation, 
  QuizEvaluation, 
  QuizState,
  ExtendedQuizParams,
  QuizMetadata,
  QuizResponse
} from "../types/quiztypes";

// Define proper error types
interface ApiError {
  data?: {
    error?: string;
    detail?: string;
    message?: string;
  };
  status?: number;
  originalStatus?: number;
}

export const useQuiz = () => {
  const { data: exams = [] } = useGetExamsQuery();
  const [getExamCategories, { data: categories = [], isLoading: isCategoriesLoading }] = useLazyGetExamCategoriesQuery();

  const [getQuestions, { isLoading: isQuestionsLoading }] = useLazyGetQuizQuestionsQuery();
  const [evaluateQuiz, { isLoading: isEvaluationLoading }] = useEvaluateQuizMutation();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentExam, setCurrentExam] = useState<number | null>(null);
  const [currentCategory, setCurrentCategory] = useState<number | null>(null);
  const [quizState, setQuizState] = useState<QuizState>("settings");
  const [metadata, setMetadata] = useState<QuizMetadata | null>(null);
  // Add state to track the actual exam/category used for the current quiz
  const [quizExam, setQuizExam] = useState<number | null>(null);
  const [quizCategory, setQuizCategory] = useState<number | null>(null);

  const handleExamChange = async (examId: number | null) => {
    setCurrentExam(examId);
    setCurrentCategory(null);
    
    if (examId) {
      try {
        await getExamCategories(examId).unwrap();
      } catch (err) {
        setError("Failed to fetch categories for this exam");
        console.error("Error fetching exam categories:", err);
      }
    }
  };

  const fetchQuestions = async (params: ExtendedQuizParams) => {
    try {
      setError(null);
      setCurrentExam(params.exam || null);
      setCurrentCategory(params.category || null);
      
      // Store the actual exam and category used for this quiz
      setQuizExam(params.exam || null);
      setQuizCategory(params.category || null);
      
      // Prepare the API call parameters with defaults
      const apiParams = {
        count: params.count,
        exam: params.exam,
        category: params.category,
        recency_percentage: params.recency_percentage || 50,
        pool_percentage: params.pool_percentage || 20,
        reset_session: params.reset_session !== undefined ? params.reset_session : true,
      };

      console.log("Fetching questions with params:", apiParams);

      // The API returns a QuizResponse object with questions and metadata
      const response: QuizResponse = await getQuestions(apiParams).unwrap();
      
      console.log("API Response:", response);
      console.log("Questions received:", response.questions);
      console.log("Metadata received:", response.metadata);
      
      // Set questions and metadata from the response object
      setQuestions(response.questions || []);
      setMetadata(response.metadata);
      setAnswers({});
      setResults(null);
      setQuizState("in-progress");
    } catch (err: unknown) {
      // Enhanced error handling with better debugging
      console.error("Full error object:", err);
      
      const apiError = err as ApiError;
      
      // Log detailed error information for debugging
      console.log("Error details:", {
        data: apiError.data,
        status: apiError.status,
        originalStatus: apiError.originalStatus
      });
      
      if (apiError.data?.error) {
        setError(`API Error: ${apiError.data.error}`);
      } else if (apiError.data?.detail) {
        setError(`API Error: ${apiError.data.detail}`);
      } else if (apiError.data?.message) {
        setError(`API Error: ${apiError.data.message}`);
      } else if (apiError.status === 400) {
        setError("Invalid request parameters. Please check your settings.");
      } else if (apiError.status === 401) {
        setError("Authentication required. Please log in again.");
      } else if (apiError.status === 403) {
        setError("You don't have permission to access these questions.");
      } else if (apiError.status === 404) {
        setError("No questions found with the selected criteria.");
      } else if (apiError.status === 500) {
        setError("Server error. Please try again later.");
      } else if (apiError.originalStatus === 0) {
        setError("Network error. Please check your connection.");
      } else {
        setError("Failed to fetch questions. Please try again.");
      }
    }
  };

  const submitAnswers = async () => {
    try {
      if (questions.length === 0) return;

      let rawScore = 0;
      const explanations: QuestionExplanation[] = [];

      questions.forEach((question) => {
        const answerKey = `question_${question.id}`;
        const selectedOption = answers[answerKey];
        const isCorrect = selectedOption === question.correct_option;

        if (isCorrect) {
          rawScore += 1;
        } else if (selectedOption) {
          rawScore -= 0.33;
        }

        explanations.push({
          id: question.id,
          question: question.question_text,
          selected: selectedOption || "Not answered",
          correct: question.correct_option,
          explanation: question.explanation || "",
          is_correct: isCorrect,
        });
      });

      const percentage = (rawScore / questions.length) * 100;
      const displayScore = Math.max(0, rawScore);
      const displayPercentage = Math.max(0, percentage);

      // Use the stored quizExam and quizCategory that were used to fetch the questions
      console.log("=== DEBUG: Submitting quiz data ===");
      console.log("quizExam:", quizExam);
      console.log("quizCategory:", quizCategory);
      console.log("rawScore:", rawScore);
      console.log("percentage:", percentage);
      console.log("questions length:", questions.length);
      console.log("answers:", answers);
      console.log("=== END DEBUG ===");

      const response = await evaluateQuiz({
        answers,
        calculated_score: rawScore,
        calculated_percentage: percentage,
        exam: quizExam, // Use the stored quiz exam
        category: quizCategory, // Use the stored quiz category
      }).unwrap();

      console.log("=== DEBUG: Evaluation response ===");
      console.log("Response:", response);
      console.log("=== END DEBUG ===");

      setResults({
        ...response,
        rawScore: parseFloat(rawScore.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        displayScore,
        displayPercentage,
        explanations,
      });
      setQuizState("results");
    } catch (err: unknown) {
      // Proper error handling without 'any'
      const apiError = err as ApiError;
      
      console.log("=== DEBUG: Evaluation error ===");
      console.log("Error:", err);
      console.log("Error data:", apiError.data);
      console.log("Error status:", apiError.status);
      console.log("=== END DEBUG ===");
      
      if (apiError.data?.error) {
        setError(apiError.data.error);
      } else {
        setError("Failed to evaluate answers. Please try again.");
      }
      console.error("Error evaluating quiz:", err);
    }
  };

  const handleAnswerSelect = (questionId: number, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [`question_${questionId}`]: option,
    }));
  };

  const resetQuiz = () => {
    setQuestions([]);
    setAnswers({});
    setResults(null);
    setError(null);
    setCurrentExam(null);
    setCurrentCategory(null);
    setQuizExam(null);
    setQuizCategory(null);
    setQuizState("settings");
    setMetadata(null);
  };

  // Optional: Function to manually set error (useful for testing)
  const setQuizError = (errorMessage: string | null) => {
    setError(errorMessage);
  };

  return {
    exams,
    categories,
    questions,
    answers,
    results,
    error,
    quizState,
    isQuestionsLoading,
    isEvaluationLoading,
    isCategoriesLoading,
    fetchQuestions,
    submitAnswers,
    handleAnswerSelect,
    resetQuiz,
    currentExam,
    currentCategory,
    handleExamChange,
    setCurrentCategory,
    metadata,
    setQuizError, // Expose error setter if needed
  };
};