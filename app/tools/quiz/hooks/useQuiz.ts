import { useState, useMemo, useCallback } from "react";
import { shuffleOptions } from "../utils/quizUtils";
import { QuizQuestion, QuizScore, QuizParams } from "../types/quiztypes";

export const useQuiz = (questions: QuizQuestion[]) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<QuizScore | null>(null);
  const [quizParams, setQuizParams] = useState<QuizParams>({
    count: 7,
    exam: undefined,
    category: undefined
  });

  const shuffledQuestions = useMemo(() => {
    return questions.map((q) => ({
      ...q,
      shuffledOptions: shuffleOptions(q)
    }));
  }, [questions]);

  const handleAnswerChange = (qid: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const handleParamChange = (key: keyof QuizParams, value: number | undefined) => {
    setQuizParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetQuiz = () => {
    setAnswers({});
    setScore(null);
  };

  return {
    answers,
    score,
    quizParams,
    shuffledQuestions,
    setScore,
    setQuizParams,
    handleAnswerChange,
    handleParamChange,
    resetQuiz
  };
};