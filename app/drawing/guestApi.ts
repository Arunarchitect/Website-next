// app/drawing/guestApi.ts
import axios from 'axios';
import { DrawingDocumentResolved } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://127.0.0.1:8000';
const API_URL = `${API_BASE_URL}/api`;

// Deliberately not apiClient — no Authorization header, no 401 refresh logic.
// Guest endpoints are unauthenticated by design; a stale token here is just noise.
const guestClient = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
});

export type GuestAccessResult =
  | { type: 'project'; code: string }
  | { type: 'deliverable'; code: string }
  | { type: 'drawing'; code: string };

/**
 * Tries the code against each guest scope in turn. Project/deliverable
 * keys and single-drawing codes live in different tables with no shared
 * format, so the only reliable way to resolve one is to ask each endpoint
 * and see which one recognizes it.
 */
export const resolveGuestAccessCode = async (code: string): Promise<GuestAccessResult> => {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Enter an access code.');

  try {
    // We only care that the request succeeds, not the actual docs
    await getProjectGuestDocuments(trimmed);
    return { type: 'project', code: trimmed };
  } catch {
    // Project check failed, continue to next
  }

  try {
    // We only care that the request succeeds, not the actual docs
    await getDeliverableGuestDocuments(trimmed);
    return { type: 'deliverable', code: trimmed };
  } catch {
    // Deliverable check failed, continue to next
  }

  try {
    await getGuestDrawing(trimmed);
    return { type: 'drawing', code: trimmed };
  } catch {
    // Drawing check failed, all attempts exhausted
  }

  throw new Error('That code doesn\'t match any shared drawings. Double-check the link and try again.');
};

export const getProjectGuestDocuments = (accessCode: string) =>
  guestClient.get<DrawingDocumentResolved[]>(`/drawings/public/project/${accessCode}/`).then(r => r.data);

export const getDeliverableGuestDocuments = (accessCode: string) =>
  guestClient.get<DrawingDocumentResolved[]>(`/drawings/public/deliverable/${accessCode}/`).then(r => r.data);

export const getGuestDrawing = (code: string) =>
  guestClient.get<DrawingDocumentResolved>(`/drawings/public/drawing/${code}/`).then(r => r.data);

// Guests never go through the authenticated /download/ action (it checks
// canAccessDocument against a real UserContext). Just open the file URL.
export const guestDownload = (doc: DrawingDocumentResolved) => {
  const url = doc.file_url.startsWith('http') ? doc.file_url : `${API_BASE_URL}${doc.file_url}`;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};