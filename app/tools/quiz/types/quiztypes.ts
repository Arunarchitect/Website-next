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
  count: number;
  exam?: number;
  category?: number;
  recency_percentage?: number;
  pool_percentage?: number;
  reset_session?: boolean;
}

export interface QuestionExplanation {
  id: number;
  question: string;
  selected: string;
  correct: string;
  explanation: string;
  is_correct: boolean;
}

export interface CategoryBreakdown {
  [categoryId: string]: {
    raw_score: number;
    display_score: number;
    percentage: number;
    display_percentage: number;
    question_count: number;
    category_name: string;
  };
}

export interface ExamBreakdown {
  [examId: string]: {
    exam_id: string | number;
    exam_name: string;
    raw_score: number;
    display_score: number;
    percentage: number;
    display_percentage: number;
    question_count: number;
    category_count: number;
  };
}

export interface OverallScoreData {
  raw_score: number;
  display_score: number;
  percentage: number;
  display_percentage: number;
  total_questions: number;
  exam_count: number;
  category_count: number;
}

export interface QuizEvaluation {
  score: number;
  total: number;
  percentage: number;
  explanations: QuestionExplanation[];
  rawScore?: number;
  displayScore?: number;
  displayPercentage?: number;
  category_breakdown?: CategoryBreakdown;
  exam_breakdown?: ExamBreakdown;
  overall_score?: OverallScoreData;
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
  category_breakdown?: CategoryBreakdown;
  exam_breakdown?: ExamBreakdown;
  overall_score?: OverallScoreData;
}

export type QuizState = 'settings' | 'in-progress' | 'results';

export interface ScoreStats {
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_attempts: number;
  last_attempt?: string;
  message?: string;
  has_attempts?: boolean;
}

export interface ExamScoreBreakdown {
  exam_id?: number;
  exam_name?: string;
  average_score: number;
  attempt_count: number;
  highest_score?: number;
  lowest_score?: number;
  exam?: {
    id: number;
    name: string;
  };
}

export interface CategoryScoreBreakdown {
  category_id?: number;
  category_name?: string;
  average_score: number;
  attempt_count: number;
  highest_score?: number;
  lowest_score?: number;
  category?: {
    id: number;
    name: string;
  };
}

export interface ScoreRecord {
  id: number;
  score: number;
  date: string;
  exam?: Exam;
  category?: Category;
}

export interface QuizResponse {
  questions: Question[];
  metadata: {
    requested_count: number;
    adjusted_count: number;
    returned_count: number;
    total_available: number;
    session_size: number;
    has_auto_cleaned: boolean;
    session_reset: boolean;
  };
}

export interface ScoreHistoryResponse {
  results: ScoreRecord[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface ScoreBreakdownResponse {
  average_score: number;
  exam_breakdown: ExamScoreBreakdown[];
  category_breakdown: CategoryScoreBreakdown[];
}

// Extended quiz parameters used in the hook and components
export interface ExtendedQuizParams {
  count: number;
  exam?: number;
  category?: number;
  recency_percentage?: number;
  pool_percentage?: number;
  reset_session?: boolean;
}

// Add this interface for the metadata display
export interface QuizMetadata {
  requested_count: number;
  adjusted_count: number;
  returned_count: number;
  total_available: number;
  session_size: number;
  has_auto_cleaned: boolean;
  session_reset: boolean;
}

// NEW: User Stats Response Interface
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

// NEW: Progress Data Interface for Charts
export interface ProgressData {
  week: string;
  average_score: number;
  attempt_count: number;
  period: string;
}

// NEW: Enhanced Exam Breakdown for Frontend
export interface EnhancedExamScoreBreakdown {
  exam_id: number;
  exam_name: string;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  attempt_count: number;
}

// NEW: Enhanced Category Breakdown for Frontend
export interface EnhancedCategoryScoreBreakdown {
  category_id: number;
  category_name: string;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  attempt_count: number;
}

// NEW: Complete User Stats for Frontend Components
export interface CompleteUserStats {
  hasAttempts: boolean;
  averageScore: number;
  overallStats: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    totalAttempts: number;
    lastAttempt: string;
    recentActivity: number;
  };
  examBreakdown: EnhancedExamScoreBreakdown[];
  categoryBreakdown: EnhancedCategoryScoreBreakdown[];
  summary: {
    totalQuizzesTaken: number;
    examsAttempted: number;
    categoriesAttempted: number;
    recentActivity: number;
  };
}

export interface ScoreDetailsModalProps {
  averageScore: number;
  examBreakdown: ExamScoreBreakdown[];
  categoryBreakdown: CategoryScoreBreakdown[];
  hasAttempts: boolean;
  overallStats?: {
    average_score: number;
    highest_score: number;
    lowest_score: number;
    total_attempts: number;
    last_attempt: string;
    recent_activity: number;
  };
  scoreHistory: ScoreRecord[];
  historyLoading: boolean;
  historyError?: unknown;
  onClose: () => void;
}