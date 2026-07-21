// app/issues/imageUtils.ts

import type * as React from "react";

export interface CompressedImage {
  base64: string;
  format: "png" | "jpg";
}

// Frontend-enforced upload cap, shared by every upload site (file picker,
// drag-and-drop, clipboard paste) across the Issues feature so the limit
// can't drift between call sites.
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_IMAGE_SIZE_LABEL = "2MB";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

// Shown near upload controls so people understand *why* a phone photo
// might get rejected, and what to do instead.
export const SCREENSHOT_SIZE_TIP =
  "Tip: a cropped screenshot is usually far smaller than a photo and uploads faster — try Win+Shift+S (Windows) or Cmd+Shift+4 (Mac), then paste it in directly with Ctrl/Cmd+V.";

export function compressImage(
  file: File,
  maxDimension = 1920,
  quality = 0.82
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = (ev) => {
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === "image/png";
        const mime = isPng ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, isPng ? undefined : quality);

        resolve({
          base64: dataUrl.split(",")[1],
          format: isPng ? "png" : "jpg",
        });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export interface ProcessImageOptions {
  onError: (msg: string) => void;
}

/**
 * Single validation + compression entry point used by every upload site
 * (file picker, drag-and-drop, clipboard paste). Keeping it here means the
 * size cap, accepted types, and error copy can never drift between call
 * sites the way the old per-component `file.size > 5 * 1024 * 1024` checks
 * did.
 */
export async function processImageFile(
  file: File,
  { onError }: ProcessImageOptions
): Promise<CompressedImage | null> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    onError('Only PNG and JPEG images are supported.');
    return null;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    onError(`Image is too large (max ${MAX_IMAGE_SIZE_LABEL}). ${SCREENSHOT_SIZE_TIP}`);
    return null;
  }
  try {
    return await compressImage(file);
  } catch {
    onError('Failed to process image file.');
    return null;
  }
}

export function extractImageFromClipboard(
  e: React.ClipboardEvent | ClipboardEvent
): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

export function extractImageFromDrop(e: React.DragEvent): File | null {
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return null;
  for (let i = 0; i < files.length; i++) {
    if (files[i].type.startsWith('image/')) return files[i];
  }
  return null;
}