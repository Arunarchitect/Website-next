import { ChangeEvent } from 'react';

interface UploadSectionProps {
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploadedImage: string | null;
  error: string;
}

export default function UploadSection({ onFileUpload, uploadedImage, error }: UploadSectionProps) {
  return (
    <div style={{ 
      backgroundColor: '#f8f9fa', 
      padding: '30px', 
      borderRadius: '12px', 
      marginBottom: '20px',
      textAlign: 'center',
      border: '2px dashed #dee2e6'
    }}>
      <h3 style={{ color: '#495057', marginBottom: '15px' }}>Upload Your 360° Image</h3>
      <p style={{ color: '#6c757d', marginBottom: '20px' }}>
        Supported formats: JPEG equirectangular images
      </p>
      
      <input 
        type="file" 
        accept="image/*" 
        id="upload" 
        onChange={onFileUpload} 
        style={{ display: 'none' }} 
      />
      <label 
        htmlFor="upload" 
        style={{ 
          padding: '15px 40px', 
          backgroundColor: '#28a745', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontWeight: 'bold',
          fontSize: '16px',
          display: 'inline-block'
        }}
      >
        Choose 360° Image
      </label>
      
      {uploadedImage && (
        <p style={{ color: '#28a745', marginTop: '15px', fontWeight: 'bold' }}>
          ✓ Image loaded successfully!
        </p>
      )}
      
      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '15px', 
          borderRadius: '8px', 
          marginTop: '15px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}