// app/issues/issueCardHelpers.ts
"use client";

import React, { useRef, useState } from "react";
import { compressImage } from "./imageUtils";
import { Issue, IssueClassification, IssuePriority, IssueStatus } from "./issueTypes";

export type NonBimIssue = Extract<Issue, { domain: 'other' | 'design' }>;

export type IssuePatch = Omit<Partial<Issue>, 'viewpoint'> & {
  domain?: 'bim' | 'other';
  viewpoint?: {
    camera_position: { x: number; y: number; z: number };
    camera_direction: { x: number; y: number; z: number };
    camera_up_vector: { x: number; y: number; z: number };
    field_of_view: number;
    clipping_planes: unknown[];
    snapshot_data: string;
    snapshot_format: "png" | "jpg";
  };
  newAttachmentData?: string;
  newAttachmentFormat?: "png" | "jpg";
  linkedDocumentIds?: number[];
  classification?: IssueClassification;
  allowedRoles?: string[];
  sharedWith?: number[];
};

export interface CurrentUser {
  id?: number | null;
  email: string;
  fullName: string;
  username: string;
  displayName: string;
}

export const STATUS_OPTIONS: IssueStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
export const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];

export const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 0 };
export const DEFAULT_CAMERA_DIRECTION = { x: 0, y: 0, z: -1 };
export const DEFAULT_CAMERA_UP_VECTOR = { x: 0, y: 1, z: 0 };
export const DEFAULT_FIELD_OF_VIEW = 60;

export const getImageSource = (imageData: string | undefined): string => {
  if (!imageData) {
    return '/images/test.jpg';
  }

  if (imageData.startsWith('data:image')) {
    return imageData;
  }

  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }

  if (imageData.startsWith('/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    return `${baseUrl}${imageData}`;
  }

  if (imageData.includes('issue_snapshots/') || imageData.includes('media/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    const path = imageData.startsWith('/') ? imageData : `/${imageData}`;
    return `${baseUrl}${path}`;
  }

  if (imageData.length > 100) {
    try {
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(imageData.substring(0, 100));
      if (isBase64) {
        const isPng = imageData.startsWith('iVBORw0KGgo');
        const format = isPng ? 'png' : 'jpeg';
        return `data:image/${format};base64,${imageData}`;
      }
    } catch (e) {
      console.warn('Failed to process image data:', e);
    }
  }

  return '/images/test.jpg';
};

export const getDrawingIcon = (fileType: string): string => {
  switch (fileType) {
    case 'pdf': return 'ti-file-pdf';
    case 'image': return 'ti-photo';
    case 'dxf': return 'ti-file-code';
    case 'ifc': return 'ti-building';
    default: return 'ti-file';
  }
};

// ---------------------------------------------------------------------------
// linkifyText — turns bare URLs inside plain text (issue descriptions,
// comments) into clickable <a> tags, and preserves line breaks. Written
// with React.createElement (not JSX) so this file can stay a plain .ts
// module rather than needing a .tsx rename.
//
// - Matches http(s):// and www. URLs.
// - Strips trailing sentence punctuation (e.g. "check this out: https://x.com."
//   won't swallow the period into the link).
// - www.example.com links get an https:// prefix added to the href only —
//   the visible text still reads exactly as typed.
// ---------------------------------------------------------------------------

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}>"']+$/;

function linkifyLine(line: string, lineKey: string): React.ReactNode {
  if (!line) return line;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_PATTERN);
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    const rawUrl = match[0];
    const start = match.index;

    const trailingMatch = rawUrl.match(TRAILING_PUNCT);
    const trailing = trailingMatch ? trailingMatch[0] : '';
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

    if (!url) continue;

    if (start > lastIndex) {
      nodes.push(line.slice(lastIndex, start));
    }

    const href = url.startsWith('http') ? url : `https://${url}`;

    nodes.push(
      React.createElement(
        'a',
        {
          key: `${lineKey}-link-${key++}`,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'issue-inline-link',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        url
      )
    );

    if (trailing) nodes.push(trailing);

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

export function linkifyText(text: string | undefined | null): React.ReactNode {
  if (!text) return text;

  const lines = text.split('\n');
  return lines.map((line, i) =>
    React.createElement(
      React.Fragment,
      { key: `line-${i}` },
      i > 0 ? React.createElement('br') : null,
      linkifyLine(line, `line-${i}`)
    )
  );
}

export type ScreenshotFormat = "png" | "jpg";

export interface UseScreenshotUploadResult {
  screenshot: string | null;
  format: ScreenshotFormat;
  preview: string | null;
  processing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  setScreenshot: (v: string | null) => void;
  setPreview: (v: string | null) => void;
  reset: () => void;
}

/**
 * Shared logic behind every "pick an image, compress it, hold it as base64
 * pending a save" flow in IssueCard (main screenshot, resolution screenshot,
 * extra screenshot, comment screenshot, edit-comment screenshot).
 *
 * withPreview mirrors the original components exactly: the main edit-mode
 * screenshot never built a separate data-URL preview string (it derived
 * `displayScreenshot` inline instead), while the other four always did.
 */
export function useScreenshotUpload(
  onError: (msg: string) => void,
  withPreview: boolean = false
): UseScreenshotUploadResult {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [format, setFormat] = useState<ScreenshotFormat>("png");
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError('Image size must be less than 5MB');
      return;
    }

    setProcessing(true);
    try {
      const { base64, format: fmt } = await compressImage(file);
      setScreenshot(base64);
      setFormat(fmt);
      if (withPreview) {
        setPreview(`data:image/${fmt};base64,${base64}`);
      }
    } catch {
      onError('Failed to process image file');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setScreenshot(null);
    setPreview(null);
  };

  return {
    screenshot,
    format,
    preview,
    processing,
    fileInputRef,
    handleFileUpload,
    setScreenshot,
    setPreview,
    reset,
  };
}