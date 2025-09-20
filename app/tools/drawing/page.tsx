"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export interface ViewerFile {
  id: string;
  userId: string;
  organisationId: string;
  projectId: string;
  viewName: string;
  viewDate: string;
  file: string;
  file_url?: string;
  title: string;
  description?: string;
  tags?: string[];
  createdAt: string;
}

export default function DrawingMainPage() {
  const router = useRouter();
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<ViewerFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Handle access key submission
  const handleAccessKeySubmit = () => {
    if (accessKeyInput.trim()) {
      router.push(`/tools/drawing/${accessKeyInput}`);
    } else {
      alert("Please enter an access key");
    }
  };

  // Extract file processing logic
  const processSVGFile = (file: File) => {
    if (file.type !== "image/svg+xml") {
      alert("Please upload a valid SVG file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return alert("Invalid SVG file");

        const uploadedFile: ViewerFile = {
          id: `uploaded-${Date.now()}`,
          userId: "u1",
          organisationId: "org1",
          projectId: "p1",
          viewName: file.name.replace(/\.svg$/i, ""),
          viewDate: new Date().toISOString().slice(0, 10),
          file: URL.createObjectURL(file),
          title: file.name.replace(/\.svg$/i, ""),
          createdAt: new Date().toISOString(),
        };

        setUploadedFiles((prev) => [uploadedFile, ...prev]);
        
        // Navigate to the uploaded file view using dynamic routing
        router.push(`/tools/drawing/uploaded-${Date.now()}?file=${encodeURIComponent(URL.createObjectURL(file))}&name=${encodeURIComponent(file.name.replace(/\.svg$/i, ""))}`);
      }
    };
    reader.readAsText(file);
  };

  // Simplified handleFileUpload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSVGFile(file);
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Simplified handleDrop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      processSVGFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">Drawing Viewer</h1>
          <p className="text-gray-600 text-lg">Zoom, pan, and download your SVG drawings with ease</p>
        </div>

        {/* Cards Container */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Access Key Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center mb-5">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Access with Key</h2>
            </div>
            
            <p className="text-gray-600 mb-4">Enter your access key to view shared drawings</p>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter access key"
                value={accessKeyInput}
                onChange={(e) => setAccessKeyInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAccessKeySubmit();
                }}
              />
              
              <button 
                onClick={handleAccessKeySubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Load Drawings
              </button>
            </div>
          </div>

          {/* Upload Card */}
          <div 
            className={`bg-white rounded-xl shadow-lg p-6 border-2 border-dashed transition-colors ${
              isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center mb-5">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Upload SVG</h2>
            </div>
            
            <p className="text-gray-600 mb-4">Upload your own SVG file or drag and drop it here</p>
            
            <input
              id="file-input"
              type="file"
              accept=".svg"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            <button 
              onClick={() => document.getElementById("file-input")?.click()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center mb-3"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Select File
            </button>
            
            <p className="text-center text-gray-500 text-sm">or drag and drop your SVG file here</p>
          </div>
        </div>

        {/* Recently Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-12 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Recently Uploaded Files
            </h2>
            
            <div className="grid gap-3">
              {uploadedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    router.push(`/tools/drawing/${file.id}?file=${encodeURIComponent(file.file)}&name=${encodeURIComponent(file.title)}`);
                  }}
                >
                  <div className="flex items-center">
                    <div className="bg-blue-100 p-2 rounded-md mr-3">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700 truncate max-w-xs">{file.title}</span>
                  </div>
                  
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Zoom & Pan</h3>
            <p className="text-gray-600 text-sm">Explore your drawings with intuitive zoom and pan controls</p>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Export Options</h3>
            <p className="text-gray-600 text-sm">Download your drawings as high-quality PDF or PNG files</p>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Secure Sharing</h3>
            <p className="text-gray-600 text-sm">Share your drawings securely with access keys</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
      `}</style>
    </div>
  );
}