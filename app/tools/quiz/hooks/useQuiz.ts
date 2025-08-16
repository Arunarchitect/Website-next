// hooks/useQuiz.ts
import { useState } from "react";
import {
  useLazyGetQuizQuestionsQuery,
  useEvaluateQuizMutation,
  useGetExamsQuery,
  useLazyGetExamCategoriesQuery,
} from "@/redux/features/quizApiSlice";
import { Question, QuizParams, QuestionExplanation, QuizEvaluation, QuizState } from "../types/quiztypes";

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

  const fetchQuestions = async (params: QuizParams) => {
    try {
      setError(null);
      setCurrentExam(params.exam || null);
      setCurrentCategory(params.category || null);
      
      const response = await getQuestions(params).unwrap();
      setQuestions(response);
      setAnswers({});
      setResults(null);
      setQuizState("in-progress");
    } catch (err) {
      setError("Failed to fetch questions. Please try again.");
      console.error("Error fetching questions:", err);
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

      const response = await evaluateQuiz({
        answers,
        calculated_score: rawScore,
        calculated_percentage: percentage,
        exam: currentExam,
        category: currentCategory,
      }).unwrap();

      setResults({
        ...response,
        rawScore: parseFloat(rawScore.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        displayScore,
        displayPercentage,
        explanations,
      });
      setQuizState("results");
    } catch (err) {
      setError("Failed to evaluate answers. Please try again.");
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
    setQuizState("settings");
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
  };
};