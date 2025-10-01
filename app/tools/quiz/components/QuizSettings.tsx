import { useState } from "react";
import { Exam, Category } from "../types/quiztypes";
import QuestionUploader from "./QuestionUploader";
import { useDownloadQuestionsTemplateMutation, useUploadQuestionsCSVMutation } from "@/redux/features/quizApiSlice";

interface QuizSettingsProps {
  exams: Exam[];
  categories: Category[];
  onStartQuiz: (params: { 
    count: number; 
    exam?: number; 
    category?: number;
    recency_percentage?: number;
    pool_percentage?: number;
    reset_session?: boolean;
  }) => void;
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
  handleExamChange,
}: QuizSettingsProps) {
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [recencyPercentage, setRecencyPercentage] = useState(50);
  const [poolPercentage, setPoolPercentage] = useState(20);
  const [resetSession, setResetSession] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [downloadTemplate] = useDownloadQuestionsTemplateMutation();
  const [uploadCSV] = useUploadQuestionsCSVMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartQuiz({
      count: questionCount,
      exam: selectedExam || undefined,
      category: selectedCategory || undefined,
      recency_percentage: recencyPercentage,
      pool_percentage: poolPercentage,
      reset_session: resetSession,
    });
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate().unwrap();
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'questions_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleUpload = async (formData: FormData) => {
    try {
      const response = await uploadCSV(formData).unwrap();
      return response;
    } catch (error) {
      throw error;
    }
  };

  if (showUploader) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <QuestionUploader 
          onBack={() => setShowUploader(false)}
          onDownloadTemplate={handleDownloadTemplate}
          onUpload={handleUpload}
        />
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 dark:text-white">Quiz Settings</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Select Exam (Optional)</label>
          <select
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
              <option key={exam.id} value={exam.id} className="dark:bg-gray-700">
                {exam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Select Category (Optional)</label>
          <select
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedExam || isLoading || isCategoriesLoading}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="dark:bg-gray-700">
                {category.name}
              </option>
            ))}
          </select>
          {isCategoriesLoading && selectedExam && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading categories...</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Number of Questions</label>
          <input
            type="number"
            min="1"
            max="50"
            value={questionCount}
            onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
          />
        </div>

        {/* Recency Percentage Slider */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Recency Percentage: {recencyPercentage}%
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              (Higher percentage favors newer questions)
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={recencyPercentage}
            onChange={(e) => setRecencyPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Older Questions</span>
            <span>Newer Questions</span>
          </div>
        </div>

        {/* Pool Percentage Slider */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Question Pool Size: {poolPercentage}%
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              (Percentage of total questions to select from)
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={poolPercentage}
            onChange={(e) => setPoolPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Smaller Pool</span>
            <span>Larger Pool</span>
          </div>
        </div>

        {/* Reset Session Toggle */}
        <div className="mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="resetSession"
              checked={resetSession}
              onChange={(e) => setResetSession(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
              disabled={isLoading}
            />
            <label 
              htmlFor="resetSession" 
              className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Reset Question Session
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                (Unckeck if  you dont want questions in the previous quiz session)
              </span>
            </label>
          </div>
        </div>

        {/* Info Section */}
        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1 text-sm">
            About These Settings:
          </h3>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li>• <strong>Recency Percentage</strong>: Controls how much newer questions are favored (0-100%)</li>
            <li>• <strong>Question Pool</strong>: Percentage of total questions to select from (1-100%)</li>
            <li>• <strong>Reset Session</strong>: When enabled, starts with fresh questions each time</li>
            <li>• Higher values = more variety but potentially less focused practice</li>
          </ul>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded hover:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-200"
          >
            {isLoading ? 'Loading...' : 'Start Quiz'}
          </button>

          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="w-full bg-green-600 dark:bg-green-700 text-white py-2 px-4 rounded hover:bg-green-700 dark:hover:bg-green-800 transition-colors duration-200"
          >
            Upload Questions via CSV
          </button>
        </div>
      </form>
    </div>
  );
}