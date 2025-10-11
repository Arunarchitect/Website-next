// hooks/useQuiz.ts
import { useState, useEffect } from "react";
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
  QuizResponse,
  Category,
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
  const [
    getExamCategories,
    { isLoading: isCategoriesLoading },
  ] = useLazyGetExamCategoriesQuery();

  const [getQuestions, { isLoading: isQuestionsLoading }] =
    useLazyGetQuizQuestionsQuery();
  const [evaluateQuiz, { isLoading: isEvaluationLoading }] =
    useEvaluateQuizMutation();

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
  // Store all categories for lookup
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  // Fetch all categories when component mounts
  useEffect(() => {
    const fetchAllCategories = async () => {
      try {
        if (exams.length > 0) {
          const firstExamId = exams[0].id;
          const categoriesData = await getExamCategories(firstExamId).unwrap();
          setAllCategories(categoriesData);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };

    fetchAllCategories();
  }, [exams, getExamCategories]);

  const handleExamChange = async (examId: number | null) => {
    setCurrentExam(examId);
    setCurrentCategory(null);

    if (examId) {
      try {
        const categoriesData = await getExamCategories(examId).unwrap();
        setAllCategories(categoriesData);
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

      // If we have a specific category selected, make sure we have its categories loaded
      if (params.exam && allCategories.length === 0) {
        try {
          const categoriesData = await getExamCategories(params.exam).unwrap();
          setAllCategories(categoriesData);
        } catch (err) {
          console.error("Error fetching categories for exam:", err);
        }
      }

      // Prepare the API call parameters - simplified to only use count
      const apiParams = {
        count: params.count,
        exam: params.exam,
        category: params.category,
        questions_per_set: params.count, // Copy count to questions_per_set
        set_number: params.set_number || 1, // This should now work
      };

      console.log("Fetching questions with params:", apiParams);

      // The API returns a QuizResponse object with questions and metadata
      const response: QuizResponse = await getQuestions(apiParams).unwrap();

      console.log("API Response:", response);
      console.log("Questions received:", response.questions);
      console.log("Available categories:", allCategories);

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
        originalStatus: apiError.originalStatus,
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

  // Helper function to get category name by ID with fallback mapping
  const getCategoryNameById = (categoryId: number): string => {
    console.log("Looking up category ID:", categoryId);
    console.log("Available categories for lookup:", allCategories);
    
    // First try to find in loaded categories
    const category = allCategories.find((cat: Category) => cat.id === categoryId);
    if (category) {
      console.log("Found category name:", category.name);
      return category.name;
    }
    
    // Fallback to hardcoded mapping based on common categories
    const categoryMap: Record<number, string> = {
      59: "Building Services and Structural Systems",
      86: "Urban Planning and Design",
      // Add more mappings as needed based on your database
    };
    
    const categoryName = categoryMap[categoryId] || `Category ${categoryId}`;
    console.log("Using fallback category name:", categoryName);
    return categoryName;
  };

  const submitAnswers = async () => {
    try {
      if (questions.length === 0) return;

      let rawScore = 0;
      const explanations: QuestionExplanation[] = [];
      
      // Track scores by category
      const categoryScores: Record<string, { 
        category_name: string; 
        correct: number; 
        total: number; 
        rawScore: number;
        display_score: number;
      }> = {};

      // Create a complete answers object that includes ALL questions
      const completeAnswers: Record<string, string> = {};

      console.log("=== DEBUG: Processing questions ===");
      console.log("Questions to process:", questions);
      console.log("Available categories:", allCategories);

      questions.forEach((question) => {
        const answerKey = `question_${question.id}`;
        const selectedOption = answers[answerKey] || ""; // Use empty string for unanswered
        completeAnswers[answerKey] = selectedOption;

        const isCorrect = selectedOption === question.correct_option;

        // Calculate points for this question
        let questionScore = 0;
        if (isCorrect) {
          questionScore = 1;
        } else if (selectedOption && selectedOption !== "") { // Only penalize if an option was actually selected
          questionScore = -0.33;
        }
        // Empty string (unanswered) gets 0 points

        rawScore += questionScore;

        // Track category scores with proper calculation
        // Use the category ID from the question and get the name from available categories
        const categoryId = question.category;
        if (categoryId) {
          const categoryName = getCategoryNameById(categoryId);
          const categoryKey = categoryId.toString();
          
          console.log(`Processing question ${question.id} with category ${categoryId}: ${categoryName}`);
          
          if (!categoryScores[categoryKey]) {
            categoryScores[categoryKey] = { 
              category_name: categoryName,
              correct: 0, 
              total: 0, 
              rawScore: 0,
              display_score: 0
            };
          }
          
          categoryScores[categoryKey].total += 1;
          categoryScores[categoryKey].rawScore += questionScore;
          categoryScores[categoryKey].display_score = categoryScores[categoryKey].rawScore;
          if (isCorrect) {
            categoryScores[categoryKey].correct += 1;
          }
        } else {
          console.log(`Question ${question.id} has no category ID`);
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

      // Create proper category breakdown with negative scores
      const categoryBreakdown: Record<string, {
        raw_score: number;
        display_score: number;
        percentage: number;
        display_percentage: number;
        question_count: number;
        category_name: string;
      }> = {};

      Object.entries(categoryScores).forEach(([categoryId, scores]) => {
        const actualPercentage = (scores.rawScore / scores.total) * 100;
        categoryBreakdown[categoryId] = {
          raw_score: scores.rawScore, // Actual score (can be negative)
          display_score: scores.rawScore, // Same as raw_score for now
          percentage: actualPercentage, // This can be negative!
          display_percentage: Math.max(0, actualPercentage), // Clamped for display
          question_count: scores.total,
          category_name: scores.category_name, // Use the actual category name
        };
      });

      console.log("=== DEBUG: Final Category Breakdown ===");
      console.log("Category scores:", categoryBreakdown);

      const response = await evaluateQuiz({
        answers: completeAnswers,
        calculated_score: rawScore,
        calculated_percentage: percentage,
        exam: quizExam,
        category: quizCategory,
      }).unwrap();

      console.log("=== DEBUG: Evaluation response ===");
      console.log("Response:", response);

      // Handle both old and new response formats
      setResults({
        ...response,
        rawScore: parseFloat(rawScore.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        displayScore,
        displayPercentage,
        explanations,
        // Use our calculated breakdown that includes negative scores
        category_breakdown: categoryBreakdown,
        exam_breakdown: response.exam_breakdown,
        overall_score: response.overall_score,
      });

      setQuizState("results");
    } catch (err: unknown) {
      const apiError = err as ApiError;
      console.error("Error evaluating quiz:", err);

      if (apiError.data?.error) {
        setError(apiError.data.error);
      } else {
        setError("Failed to evaluate answers. Please try again.");
      }
    }
  };

  // FIXED: Added deselection functionality
  const handleAnswerSelect = (questionId: number, option: string) => {
    setAnswers((prev) => {
      const answerKey = `question_${questionId}`;
      const currentAnswer = prev[answerKey];
      
      // Toggle selection - if same option clicked, set to empty string to deselect
      if (currentAnswer === option) {
        return {
          ...prev,
          [answerKey]: "" // Use empty string for deselected/unanswered
        };
      } else {
        // Select new option
        return {
          ...prev,
          [answerKey]: option
        };
      }
    });
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
    categories: allCategories,
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