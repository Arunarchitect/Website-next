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

interface ApiError {
  data?: {
    error?: string;
    detail?: string;
    message?: string;
  };
  status?: number;
  originalStatus?: number;
}

export interface RestoreSnapshot {
  questions: Question[];
  answers: Record<string, string>;
  metadata: QuizMetadata | null;
  exam: number | null;
  category: number | null;
}

// All option texts of a question, in display order
const getOptions = (q: Question): string[] =>
  [q.option_1, q.option_2, q.option_3].filter(
    (o): o is string => typeof o === "string" && o.trim() !== ""
  );

export const useQuiz = () => {
  const { data: exams = [] } = useGetExamsQuery();
  const [getExamCategories, { isLoading: isCategoriesLoading }] = useLazyGetExamCategoriesQuery();
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
  // exam/category actually used for the running quiz
  const [quizExam, setQuizExam] = useState<number | null>(null);
  const [quizCategory, setQuizCategory] = useState<number | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchAllCategories = async () => {
      try {
        if (exams.length > 0) {
          const categoriesData = await getExamCategories(exams[0].id).unwrap();
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

  // Returns the number of questions loaded (0 on failure)
  const fetchQuestions = async (params: ExtendedQuizParams): Promise<number> => {
    try {
      setError(null);
      setCurrentExam(params.exam || null);
      setCurrentCategory(params.category || null);
      setQuizExam(params.exam || null);
      setQuizCategory(params.category || null);

      if (params.exam && allCategories.length === 0) {
        try {
          const categoriesData = await getExamCategories(params.exam).unwrap();
          setAllCategories(categoriesData);
        } catch (err) {
          console.error("Error fetching categories for exam:", err);
        }
      }

      const apiParams = {
        count: params.count,
        exam: params.exam,
        category: params.category,
        questions_per_set: params.count,
        set_number: params.set_number || 1,
      };

      const response: QuizResponse = await getQuestions(apiParams).unwrap();
      const list = response.questions || [];

      setQuestions(list);
      setMetadata(response.metadata);
      setAnswers({});
      setResults(null);
      setQuizState("in-progress");
      return list.length;
    } catch (err: unknown) {
      console.error("Full error object:", err);
      const apiError = err as ApiError;

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
      return 0;
    }
  };

  // Put a previously saved quiz back on screen
  const restoreQuiz = (s: RestoreSnapshot) => {
    setError(null);
    setQuestions(s.questions);
    setAnswers(s.answers);
    setMetadata(s.metadata);
    setQuizExam(s.exam);
    setQuizCategory(s.category);
    setCurrentExam(s.exam);
    setCurrentCategory(s.category);
    setResults(null);
    setQuizState("in-progress");
  };

  const getCategoryNameById = (categoryId: number): string => {
    const category = allCategories.find((cat: Category) => cat.id === categoryId);
    if (category) return category.name;

    const categoryMap: Record<number, string> = {
      59: "Building Services and Structural Systems",
      86: "Urban Planning and Design",
    };
    return categoryMap[categoryId] || `Category ${categoryId}`;
  };

  const submitAnswers = async () => {
    try {
      if (questions.length === 0) return;

      let rawScore = 0;
      const explanations: QuestionExplanation[] = [];

      const categoryScores: Record<
        string,
        { category_name: string; correct: number; total: number; rawScore: number; display_score: number }
      > = {};

      const completeAnswers: Record<string, string> = {};

      questions.forEach((question) => {
        const answerKey = `question_${question.id}`;
        const selectedOption = answers[answerKey] || "";
        completeAnswers[answerKey] = selectedOption;

        const isCorrect = selectedOption === question.correct_option;

        let questionScore = 0;
        if (isCorrect) {
          questionScore = 1;
        } else if (selectedOption && selectedOption !== "") {
          questionScore = -0.33;
        }

        rawScore += questionScore;

        const categoryId = question.category;
        if (categoryId) {
          const categoryName = getCategoryNameById(categoryId);
          const categoryKey = categoryId.toString();

          if (!categoryScores[categoryKey]) {
            categoryScores[categoryKey] = {
              category_name: categoryName,
              correct: 0,
              total: 0,
              rawScore: 0,
              display_score: 0,
            };
          }

          categoryScores[categoryKey].total += 1;
          categoryScores[categoryKey].rawScore += questionScore;
          categoryScores[categoryKey].display_score = categoryScores[categoryKey].rawScore;
          if (isCorrect) categoryScores[categoryKey].correct += 1;
        }

        explanations.push({
          id: question.id,
          question: question.question_text,
          selected: selectedOption || "Not answered",
          correct: question.correct_option,
          explanation: question.explanation || "",
          is_correct: isCorrect,
          options: getOptions(question),
        });
      });

      const percentage = (rawScore / questions.length) * 100;
      const displayScore = Math.max(0, rawScore);
      const displayPercentage = Math.max(0, percentage);

      const categoryBreakdown: Record<
        string,
        {
          raw_score: number;
          display_score: number;
          percentage: number;
          display_percentage: number;
          question_count: number;
          category_name: string;
        }
      > = {};

      Object.entries(categoryScores).forEach(([categoryId, scores]) => {
        const actualPercentage = (scores.rawScore / scores.total) * 100;
        categoryBreakdown[categoryId] = {
          raw_score: scores.rawScore,
          display_score: scores.rawScore,
          percentage: actualPercentage,
          display_percentage: Math.max(0, actualPercentage),
          question_count: scores.total,
          category_name: scores.category_name,
        };
      });

      const response = await evaluateQuiz({
        answers: completeAnswers,
        calculated_score: rawScore,
        calculated_percentage: percentage,
        exam: quizExam,
        category: quizCategory,
      }).unwrap();

      setResults({
        ...response,
        rawScore: parseFloat(rawScore.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        displayScore,
        displayPercentage,
        explanations,
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

  // Click the selected option again to deselect
  const handleAnswerSelect = (questionId: number, option: string) => {
    setAnswers((prev) => {
      const answerKey = `question_${questionId}`;
      if (prev[answerKey] === option) {
        return { ...prev, [answerKey]: "" };
      }
      return { ...prev, [answerKey]: option };
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
    restoreQuiz,
    submitAnswers,
    handleAnswerSelect,
    resetQuiz,
    currentExam,
    currentCategory,
    quizExam,
    quizCategory,
    handleExamChange,
    metadata,
    setQuizError,
  };
};