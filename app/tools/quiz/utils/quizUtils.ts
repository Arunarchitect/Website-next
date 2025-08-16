// app/tools/quiz/utils/quizUtils.ts
import { 
  Question, 
  QuestionExplanation, 
  QuizEvaluation 
} from '../types/quiztypes';

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const calculateScore = (
  answers: Record<string, string>,
  questions: Question[]
): QuizEvaluation => {
  let correct = 0;
  const explanations: QuestionExplanation[] = [];

  for (const question of questions) {
    const answerKey = `question_${question.id}`;
    const isCorrect = answers[answerKey] === question.correct_option;
    if (isCorrect) correct++;

    explanations.push({
      id: question.id,
      question: question.question_text,
      selected: answers[answerKey] || 'Not answered',
      correct: question.correct_option,
      explanation: question.explanation || '',
      is_correct: isCorrect
    });
  }

  const percentage = (correct / questions.length) * 100;
  return {
    score: correct,
    total: questions.length,
    percentage: parseFloat(percentage.toFixed(2)),
    explanations,
    rawScore: correct,
    displayScore: correct,
    displayPercentage: parseFloat(percentage.toFixed(2))
  };
};