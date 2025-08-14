// app/tools/quiz/types/quizTypes.ts

/**
 * Base question interface representing the structure from the API
 */
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
  // Additional fields that might be useful:
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  created_at?: string;
}

/**
 * Question with shuffled options for display purposes
 */
export interface QuizQuestion extends Question {
  shuffledOptions: string[];
  isCorrect?: boolean;  // For client-side evaluation
  selectedOption?: string; // For tracking user selection
}

/**
 * Parameters for fetching quiz questions
 */
export interface QuizParams {
  count: number;
  exam?: number;
  category?: number;
  difficulty?: 'easy' | 'medium' | 'hard'; // Optional difficulty filter
  tags?: string[]; // Optional tags filter
}

/**
 * Explanation for a single question result
 */
export interface QuestionExplanation {
  id: number;
  question: string;
  selected: string;
  correct: string;
  explanation: string;
  is_correct: boolean;
  // Additional useful fields:
  options?: string[]; // All options for reference
  questionId?: number; // Original question ID
}

/**
 * Complete quiz evaluation results
 */
export interface QuizScore {
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  percentage: number;
  netScore: number;
  explanations: QuestionExplanation[];
  // Additional metadata:
  timeTaken?: number; // In seconds
  dateCompleted?: string;
  passingScore?: boolean; // If there's a passing threshold
}

/**
 * User's answer payload for evaluation
 */
export interface QuizAnswers {
  [key: `question_${number}`]: string; // question_1: "option_a", etc.
  // Additional metadata that might be useful:
  timeSpent?: number; // Total time spent in seconds
  deviceInfo?: string; // Browser/device info
}

/**
 * Quiz timer state
 */
export interface QuizTimer {
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
}

/**
 * Quiz configuration options
 */
export interface QuizConfig {
  timePerQuestion?: number; // Default: 30 seconds
  negativeMarking?: boolean; // Default: true
  showExplanation?: boolean; // Whether to show explanations after submission
  allowSkip?: boolean; // Whether skipping questions is allowed
  shuffleQuestions?: boolean; // Whether to shuffle questions
}

/**
 * Full quiz state
 */
export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<number, string>;
  status: 'idle' | 'started' | 'submitted' | 'evaluated';
  timer: QuizTimer;
  config: QuizConfig;
}