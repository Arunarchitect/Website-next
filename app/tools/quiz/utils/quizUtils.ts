// app/tools/quiz/utils/quizUtils.ts
import { Question } from '../types/quiztypes';

export const shuffleOptions = (question: Question): string[] => {
  const allOptions = [
    question.option_1,
    question.option_2,
    question.option_3,
    question.correct_option
  ].filter(Boolean) as string[];
  
  const shuffledOptions = [...allOptions];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  return shuffledOptions;
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};