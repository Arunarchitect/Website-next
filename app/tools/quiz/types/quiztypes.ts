// types/quiztypes.ts
export interface Question {
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

export interface Exam {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface QuizParams {
  count?: number;
  exam?: number;
  category?: number;
}

export interface QuestionExplanation {
  id: number;
  question: string;
  selected: string;
  correct: string;
  explanation: string;
  is_correct: boolean;
}

export interface QuizEvaluation {
  score: number;
  total: number;
  percentage: number;
  explanations: QuestionExplanation[];
  rawScore?: number;
  displayScore?: number;
  displayPercentage?: number;
}

export interface EvaluationRequest {
  answers: Record<string, string>;
  calculated_score: number;
  calculated_percentage: number;
  exam?: number | null;
  category?: number | null;
}

export interface EvaluationResponse {
  score: number;
  total: number;
  percentage: number;
  explanations: QuestionExplanation[];
}

export type QuizState = 'settings' | 'in-progress' | 'results';