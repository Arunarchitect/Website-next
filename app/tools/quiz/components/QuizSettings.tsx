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
    set_number?: number;
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
  const [questionCountInput, setQuestionCountInput] = useState("10"); // Add this state for question count input
  const [setNumber, setSetNumber] = useState(1);
  const [setNumberInput, setSetNumberInput] = useState("1");
  const [showUploader, setShowUploader] = useState(false);
  const [downloadTemplate] = useDownloadQuestionsTemplateMutation();
  const [uploadCSV] = useUploadQuestionsCSVMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartQuiz({
      count: questionCount,
      exam: selectedExam || undefined,
      category: selectedCategory || undefined,
      set_number: setNumber,
    });
  };

  const handleQuestionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuestionCountInput(value); // Always update the input value
    
    // Only update the numeric value if it's a valid number within range
    if (value === "") {
      return;
    }
    
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(1, Math.min(50, numValue));
      setQuestionCount(clampedValue);
    }
  };

  const handleQuestionCountBlur = () => {
    // When input loses focus, validate and set default if empty or invalid
    if (questionCountInput === "" || Number(questionCountInput) < 1) {
      setQuestionCountInput("10");
      setQuestionCount(10);
    } else {
      // Ensure the value is within bounds
      const numValue = Math.max(1, Math.min(50, Number(questionCountInput)));
      setQuestionCountInput(numValue.toString());
      setQuestionCount(numValue);
    }
  };

  const handleSetNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSetNumberInput(value);
    
    if (value === "" || value === "-") {
      return;
    }
    
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      setSetNumber(numValue);
    }
  };

  const handleSetNumberBlur = () => {
    if (setNumberInput === "" || setNumberInput === "-") {
      setSetNumberInput("1");
      setSetNumber(1);
    }
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

        {/* Updated Question Count Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Number of Questions</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={questionCountInput}
            onChange={handleQuestionCountChange}
            onBlur={handleQuestionCountBlur}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
            placeholder="Enter number of questions"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum: 1, Maximum: 50. This also determines questions per set.
          </p>
        </div>

        {/* Set Number Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">Set Number</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="-?[0-9]*"
            value={setNumberInput}
            onChange={handleSetNumberChange}
            onBlur={handleSetNumberBlur}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
            placeholder="Enter set number"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Set 1 = first set, Set -1 = last set, Set -2 = second last, etc.
          </p>
        </div>

        {/* Info Section */}
        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1 text-sm">
            About Set-Based Quiz:
          </h3>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Questions are organized into sets based on your count</li>
            <li>• Each set contains your specified number of questions</li>
            <li>• You can navigate between sets using different set numbers</li>
            <li>• Set 1 = first set, Set -1 = last set, Set -2 = second last, etc.</li>
            <li>• When both exam and category are &quot;All&quot;, questions are distributed evenly across categories</li>
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