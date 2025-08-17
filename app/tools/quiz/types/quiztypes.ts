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

// Add these to your existing types in quiztypes.ts

export interface ScoreStats {
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_attempts: number;
  last_attempt?: string;
}

export interface ExamScoreBreakdown {
  exam_id: number;
  exam_name: string;
  average_score: number;
  attempt_count: number;
  highest_score: number;
  lowest_score: number;
}

export interface CategoryScoreBreakdown {
  category_id: number;
  category_name: string;
  average_score: number;
  attempt_count: number;
  highest_score: number;
  lowest_score: number;
}

export interface ScoreRecord {
  id: number;
  score: number;
  date: string;
  exam?: Exam;
  category?: Category;
}