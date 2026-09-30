// app/issues/imageUtils.ts

import type * as React from "react";

export interface CompressedImage {
  base64: string;
  format: "png" | "jpg";
}

// Target size: anything above this triggers the "resize?" prompt.
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_IMAGE_SIZE_LABEL = "2MB";

// Absolute ceiling for keeping an image un-resized. Above this, resizing is
// the only way to upload.
export const MAX_ORIGINAL_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_ORIGINAL_IMAGE_SIZE_LABEL = "5MB";

// Friction for the "keep original" path: the confirm button stays disabled
// for this long (and until the checkbox is ticked).
export const KEEP_ORIGINAL_DELAY_SECONDS = 4;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

export const SCREENSHOT_SIZE_TIP =
  "Tip: a cropped screenshot is usually far smaller than a photo and uploads faster — try Win+Shift+S (Windows) or Cmd+Shift+4 (Mac), then paste it in directly with Ctrl/Cmd+V.";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Approximate decoded byte size of a base64 string. */
const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4);

const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function loadImage(
  file: File
): Promise<{ img: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function renderToBase64(
  img: HTMLImageElement,
  maxDimension: number,
  mime: "image/png" | "image/jpeg",
  quality?: number
): string {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // JPEG has no alpha channel; without this, transparent PNG areas turn black.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL(mime, quality).split(",")[1];
}

// ---------------------------------------------------------------------------
// Standard compression (files already within the limit)
// ---------------------------------------------------------------------------

export async function compressImage(
  file: File,
  maxDimension = 1920,
  quality = 0.82
): Promise<CompressedImage> {
  const { img, release } = await loadImage(file);
  try {
    const isPng = file.type === "image/png";
    const base64 = renderToBase64(
      img,
      maxDimension,
      isPng ? "image/png" : "image/jpeg",
      isPng ? undefined : quality
    );
    return { base64, format: isPng ? "png" : "jpg" };
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Aggressive resize (user agreed to lose some clarity)
// ---------------------------------------------------------------------------

/**
 * Shrinks an image until it is under `targetBytes`. Tries to keep dimensions
 * first and lower quality; then steps the dimensions down. PNGs are tried as
 * PNG once, then converted to JPEG.
 */
async function shrinkToLimit(
  file: File,
  targetBytes: number
): Promise<CompressedImage> {
  const { img, release } = await loadImage(file);
  try {
    if (file.type === "image/png") {
      const png = renderToBase64(img, 1920, "image/png");
      if (base64Bytes(png) <= targetBytes) return { base64: png, format: "png" };
    }

    const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
    for (let dim = 1920; dim >= 640; dim = Math.round(dim * 0.8)) {
      for (const q of qualities) {
        const jpg = renderToBase64(img, dim, "image/jpeg", q);
        if (base64Bytes(jpg) <= targetBytes) return { base64: jpg, format: "jpg" };
      }
    }
    throw new Error("Could not shrink image enough");
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Keep original (no resizing, no re-encoding)
// ---------------------------------------------------------------------------

function readOriginal(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      resolve({
        base64: dataUrl.split(",")[1],
        format: file.type === "image/png" ? "png" : "jpg",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// "Image is too large" dialog (built with plain DOM so it works from any
// upload site without mounting a component; inline styles because issues.css
// is scoped under .issues-page and this lives on document.body)
// ---------------------------------------------------------------------------

type LargeImageDecision = "resize" | "original" | "cancel";

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: Partial<CSSStyleDeclaration>,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, css);
  if (text !== undefined) node.textContent = text;
  return node;
}

function dialogButton(
  label: string,
  variant: "primary" | "secondary" | "danger",
  onClick: () => void
): HTMLButtonElement {
  const palette = {
    primary: { background: "#2C5F8A", color: "#fff", border: "1px solid #2C5F8A" },
    secondary: { background: "#fff", color: "#1E1E1A", border: "1px solid #DFDACB" },
    danger: { background: "#fff", color: "#B3261E", border: "1px solid #B3261E" },
  }[variant];

  const b = h(
    "button",
    {
      ...palette,
      padding: "9px 16px",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "inherit",
    },
    label
  );
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function askLargeImageDecision(file: File): Promise<LargeImageDecision> {
  return new Promise((resolve) => {
    const canKeepOriginal = file.size <= MAX_ORIGINAL_IMAGE_SIZE_BYTES;
    let timer: number | undefined;

    const overlay = h("div", {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.5)",
      zIndex: "3000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });
    const card = h("div", {
      background: "#fff",
      borderRadius: "8px",
      padding: "22px",
      maxWidth: "440px",
      width: "100%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      color: "#1E1E1A",
      maxHeight: "90vh",
      overflowY: "auto",
    });
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    overlay.appendChild(card);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("cancel");
    };
    function close(decision: LargeImageDecision) {
      window.clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(decision);
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close("cancel");
    });

    const title = (t: string) =>
      h("h3", { margin: "0 0 10px", fontSize: "17px", fontWeight: "700" }, t);
    const para = (t: string, extra: Partial<CSSStyleDeclaration> = {}) =>
      h("p", { margin: "0 0 10px", fontSize: "14px", lineHeight: "1.5", ...extra }, t);

    // ---- Step 1: offer to resize -------------------------------------
    const renderResizeStep = () => {
      window.clearInterval(timer);
      card.replaceChildren();

      card.append(
        title("This image is too large"),
        para(
          `"${file.name}" is ${formatMB(file.size)}. Images are limited to ${MAX_IMAGE_SIZE_LABEL}.`
        ),
        para(
          "Shall I resize it to under 2MB for you? It will lose some sharpness and fine detail, but stays fine for most issue screenshots.",
          { color: "#4a4842" }
        )
      );

      const row = h("div", {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        margin: "14px 0 12px",
      });
      const primary = dialogButton("Resize & upload", "primary", () => close("resize"));
      const cancel = dialogButton("Cancel", "secondary", () => close("cancel"));
      row.append(primary, cancel);
      card.appendChild(row);

      if (canKeepOriginal) {
        const link = h(
          "button",
          {
            background: "none",
            border: "none",
            padding: "0",
            fontSize: "12px",
            color: "#6E6B62",
            textDecoration: "underline",
            cursor: "pointer",
            fontFamily: "inherit",
          },
          "Keep original quality instead…"
        );
        link.type = "button";
        link.addEventListener("click", renderKeepOriginalStep);
        card.appendChild(link);
      } else {
        card.appendChild(
          para(
            `Files over ${MAX_ORIGINAL_IMAGE_SIZE_LABEL} can't be uploaded at original size, so resizing is required.`,
            { fontSize: "12px", color: "#6E6B62", margin: "0" }
          )
        );
      }

      card.appendChild(
        para(SCREENSHOT_SIZE_TIP, {
          fontSize: "12px",
          color: "#6E6B62",
          margin: "12px 0 0",
          paddingTop: "10px",
          borderTop: "1px solid #DFDACB",
        })
      );

      primary.focus();
    };

    // ---- Step 2: discouraged path -------------------------------------
    const renderKeepOriginalStep = () => {
      card.replaceChildren();

      card.append(
        title("Upload the large original?"),
        para(
          `Large images slow down this issue for everyone, use shared storage, and load slowly on site or mobile connections. Only do this when fine detail truly matters (for example, small text on a drawing). The maximum is ${MAX_ORIGINAL_IMAGE_SIZE_LABEL}.`,
          { color: "#4a4842" }
        )
      );

      let acknowledged = false;
      let remaining = KEEP_ORIGINAL_DELAY_SECONDS;

      const checkLabel = h("label", {
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
        fontSize: "13px",
        margin: "14px 0",
        cursor: "pointer",
      });
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.style.marginTop = "3px";
      checkLabel.append(
        checkbox,
        h("span", {}, "I understand, and I still want to upload the original.")
      );
      card.appendChild(checkLabel);

      const row = h("div", { display: "flex", gap: "8px", flexWrap: "wrap" });
      const back = dialogButton("Go back & resize", "primary", renderResizeStep);
      const confirm = dialogButton("", "danger", () => close("original"));
      row.append(back, confirm);
      card.appendChild(row);

      const sync = () => {
        const ready = acknowledged && remaining <= 0;
        confirm.disabled = !ready;
        confirm.style.opacity = ready ? "1" : "0.45";
        confirm.style.cursor = ready ? "pointer" : "not-allowed";
        confirm.textContent =
          remaining > 0 ? `Upload original (${remaining}s)` : "Upload original";
      };
      checkbox.addEventListener("change", () => {
        acknowledged = checkbox.checked;
        sync();
      });
      timer = window.setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        sync();
        if (remaining === 0) window.clearInterval(timer);
      }, 1000);
      sync();

      back.focus();
    };

    document.body.appendChild(overlay);
    renderResizeStep();
  });
}

// ---------------------------------------------------------------------------
// Single entry point used by every upload site
// ---------------------------------------------------------------------------

export interface ProcessImageOptions {
  onError: (msg: string) => void;
}

/**
 * Validation + compression entry point used by every upload site (file
 * picker, drag-and-drop, clipboard paste).
 *
 * - <= 2MB: compressed silently.
 * - > 2MB: user is asked whether to resize. Declining is possible only up to
 *   5MB, behind an extra confirmation. Cancelling returns null without an
 *   error message.
 */
export async function processImageFile(
  file: File,
  { onError }: ProcessImageOptions
): Promise<CompressedImage | null> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    onError("Only PNG and JPEG images are supported.");
    return null;
  }

  try {
    if (file.size <= MAX_IMAGE_SIZE_BYTES) {
      const compressed = await compressImage(file);
      // Rare: re-encoding a PNG can grow it past the limit.
      if (base64Bytes(compressed.base64) > MAX_IMAGE_SIZE_BYTES) {
        return await shrinkToLimit(file, MAX_IMAGE_SIZE_BYTES);
      }
      return compressed;
    }

    const decision = await askLargeImageDecision(file);
    if (decision === "cancel") return null;
    if (decision === "original") return await readOriginal(file);
    return await shrinkToLimit(file, MAX_IMAGE_SIZE_BYTES);
  } catch {
    onError(
      "Failed to process image file. Try a smaller image or a cropped screenshot."
    );
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
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

export function extractImageFromDrop(e: React.DragEvent): File | null {
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return null;
  for (let i = 0; i < files.length; i++) {
    if (files[i].type.startsWith("image/")) return files[i];
  }
  return null;
}