// app/issues/imageUtils.ts

// Shared image-compression helper used by every screenshot upload handler
// across the Issues feature (new issue form, edit screenshot, comment
// screenshot, edit-comment screenshot, resolution screenshot, add-screenshot).
//
// Defaults chosen for screenshots specifically: 1920px keeps UI/text detail
// readable at full-size modal view, 0.82 JPEG quality is visually
// near-lossless for screenshots while cutting typical phone-camera-sized
// files (3-5MB) down to a few hundred KB. PNGs with transparency are kept
// as PNG since JPEG has no alpha channel; everything else is re-encoded as
// JPEG since it compresses far better for photos/screenshots.

export interface CompressedImage {
  base64: string;
  format: "png" | "jpg";
}

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