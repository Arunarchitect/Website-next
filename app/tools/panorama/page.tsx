// tools/panorama/page.tsx - For manual access key input

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function PanoramaAccessKeyPage() {
  const [accessKey, setAccessKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) {
      setError('Please enter an access key');
      return;
    }
    setLoading(true);
    setError('');
    
    // Navigate to the panorama viewer with the access key
    router.push(`/tools/panorama/${accessKey}`);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '40px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>360° Panorama Viewer</h1>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Enter Access Key</h2>
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="Enter your access key"
            style={{ 
              padding: '12px 16px', 
              border: '1px solid #ccc', 
              borderRadius: '8px', 
              width: '100%', 
              fontSize: '16px',
              marginBottom: '15px'
            }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              padding: '12px 30px', 
              backgroundColor: loading ? '#ccc' : '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold',
              fontSize: '16px',
              width: '100%'
            }}
          >
            {loading ? 'Loading...' : 'View Panoramas'}
          </button>
        </form>

        {error && (
          <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>
        )}

        <div style={{ textAlign: 'left', backgroundColor: '#e8f5e8', padding: '15px', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>How to use:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
            <li>Enter the access key provided to you</li>
            <li>Click `&quot;`View Panoramas`&quot;` to see all 360° images</li>
            <li>Or share direct links: <code>/tools/panorama/your-access-key</code></li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3 style={{ color: '#1565c0', marginBottom: '15px' }}>Upload Your Own Image</h3>
        <p style={{ color: '#555', marginBottom: '15px' }}>
          Want to view your own 360° image? You can upload it directly in the viewer.
        </p>
        <button 
          onClick={() => router.push('/tools/panorama/upload')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#2196F3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 'bold' 
          }}
        >
          Go to Upload Page
        </button>
      </div>
    </div>
  );
}