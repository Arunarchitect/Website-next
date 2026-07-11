// app/drawing/components/PdfThumbnail.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface PdfThumbnailProps {
  fileUrl: string;
}

export default function PdfThumbnail({ fileUrl }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);

        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 400;
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error('Error rendering PDF thumbnail:', err);
        if (!cancelled) setStatus('error');
      }
    }

    renderThumbnail();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (status === 'error') {
    return (
      <div className="pdf-thumbnail-fallback">
        <i className="ti ti-file-pdf" />
      </div>
    );
  }

  return (
    <div className="pdf-thumbnail-wrapper">
      {status === 'loading' && (
        <div className="pdf-thumbnail-loading">
          <i className="ti ti-loader" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="pdf-thumbnail-canvas"
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}