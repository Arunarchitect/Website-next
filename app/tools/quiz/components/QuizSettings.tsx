// components/QuizSettings.tsx
import { useState } from "react";
import { Exam, Category } from "../types/quiztypes";

interface QuizSettingsProps {
  exams: Exam[];
  categories: Category[];
  onStartQuiz: (params: { count: number; exam?: number; category?: number }) => void;
  isLoading: boolean;
  isCategoriesLoading?: boolean;
  currentExam?: number | null;
  currentCategory?: number | null;
  handleExamChange: (examId: number | null) => void;
}

export default function QuizSettings({
  exams,
  categories,
  onStartQuiz,
  isLoading,
  isCategoriesLoading,
  currentExam,
  currentCategory,
  handleExamChange,
}: QuizSettingsProps) {
  const [selectedExam, setSelectedExam] = useState<number | null>(currentExam || null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(currentCategory || null);
  const [questionCount, setQuestionCount] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartQuiz({
      count: questionCount,
      exam: selectedExam || undefined,
      category: selectedCategory || undefined,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Quiz Settings</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Exam (Optional)</label>
          <select
            className="w-full p-2 border rounded"
            value={selectedExam || ''}
            onChange={(e) => {
              const examId = e.target.value ? Number(e.target.value) : null;
              setSelectedExam(examId);
              setSelectedCategory(null);
              handleExamChange(examId);
            }}
            disabled={isLoading}
          >
            <option value="">All Exams</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Category (Optional)</label>
          <select
            className="w-full p-2 border rounded"
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedExam || isLoading || isCategoriesLoading}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {isCategoriesLoading && selectedExam && (
            <p className="text-xs text-gray-500 mt-1">Loading categories...</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Number of Questions</label>
          <input
            type="number"
            min="1"
            max="50"
            value={questionCount}
            onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Loading...' : 'Start Quiz'}
        </button>
      </form>
    </div>
  );
}