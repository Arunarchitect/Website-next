'use client'
import { useState } from 'react';

interface UploadResult {
  created?: number;
  errors?: string[];
}

interface QuestionUploaderProps {
  onBack: () => void;
  onDownloadTemplate: () => void;
  onUpload: (formData: FormData) => Promise<UploadResult>;
}

export default function QuestionUploader({ 
  onBack, 
  onDownloadTemplate, 
  onUpload 
}: QuestionUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await onUpload(formData);
      setResult(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please check your file format.';
      setResult({
        errors: [errorMessage]
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
      >
        ← Back to quiz settings
      </button>

      <h3 className="text-lg font-semibold mb-4">Upload Questions</h3>
      
      <div className="mb-4">
        <button
          onClick={onDownloadTemplate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
        >
          Download Template CSV
        </button>
        <p className="text-sm text-gray-600">
          Download the template, fill it with your questions, and upload it here.
        </p>
      </div>
      
      <div className="mb-4">
        <label className="block mb-2 font-medium">Select CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full p-2 border rounded"
          disabled={isUploading}
        />
      </div>
      
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
      >
        {isUploading ? 'Uploading...' : 'Upload Questions'}
      </button>
      
      {result && (
        <div className="mt-4 p-3 rounded bg-gray-100">
          {result.created !== undefined && (
            <p className="text-green-600">
              Successfully created {result.created} questions
            </p>
          )}
          {result.errors?.map((error, i) => (
            <p key={i} className="text-red-600">
              Error: {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}