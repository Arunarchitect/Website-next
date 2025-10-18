interface InstructionsProps {
  isFullscreen: boolean;
}

export default function Instructions({ isFullscreen }: InstructionsProps) {
  if (isFullscreen) return null;

  return (
    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <h3 style={{ color: '#333', marginTop: '0' }}>How to use:</h3>
      <ul style={{ color: '#666', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
        <li>Click &quot;Choose 360° Image&quot; to upload your panorama</li>
        <li>Drag to look around the panorama</li>
        <li>Use mouse wheel to zoom in/out</li>
        <li>Click fullscreen for immersive experience</li>
        <li>Supported: equirectangular 360° images</li>
      </ul>
    </div>
  );
}