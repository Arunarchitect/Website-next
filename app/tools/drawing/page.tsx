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

  // Handle access key submission
  const handleAccessKeySubmit = () => {
    if (accessKeyInput.trim()) {
      router.push(`/tools/drawing/${accessKeyInput}`);
    } else {
      alert("Please enter an access key");
    }
  };

  // Handle file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
        
        // Navigate to the uploaded file view
        router.push(`/tools/drawing/uploaded-${Date.now()}?file=${encodeURIComponent(URL.createObjectURL(file))}&name=${encodeURIComponent(file.name.replace(/\.svg$/i, ""))}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>SVG Viewer with Zoom, Pan & Download</h2>

      {/* Access Key Input */}
      <div style={{ marginBottom: 20 }}>
        <h3>Access Drawings with Key</h3>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <input
            type="text"
            placeholder="Enter access key"
            value={accessKeyInput}
            onChange={(e) => setAccessKeyInput(e.target.value)}
            style={{ padding: "8px", width: "200px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAccessKeySubmit();
            }}
          />
          <button onClick={handleAccessKeySubmit}>
            Load Drawings
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ marginBottom: 20 }}>
        <h3>Upload SVG File</h3>
        <input
          id="file-input"
          type="file"
          accept=".svg"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button 
          onClick={() => document.getElementById("file-input")?.click()}
          style={{ padding: "10px 20px" }}
        >
          Upload SVG
        </button>
      </div>

      {/* Recently Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>Recently Uploaded Files</h3>
          {uploadedFiles.map((file) => (
            <div key={file.id} style={{ margin: "5px 0" }}>
              <button
                onClick={() => {
                  router.push(`/tools/drawing/${file.id}?file=${encodeURIComponent(file.file)}&name=${encodeURIComponent(file.title)}`);
                }}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#0070f3", 
                  textDecoration: "underline",
                  cursor: "pointer"
                }}
              >
                {file.title}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}