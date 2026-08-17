import { ProcessData } from "@/app/process/lib/process-utils";

const API_BASE = `${process.env.NEXT_PUBLIC_HOST}/api/workflow`;

export type CloudDocSummary = {
  id: number;
  person_name: string;
  title: string;
  is_master: boolean;
  updated_at: string;
};

export type CloudDocDetail = CloudDocSummary & {
  data: ProcessData;
  // Every document now belongs to a group, so this is always a string.
  group_masterword: string;
};

export type GroupBootstrap = {
  documents: CloudDocSummary[];
  master: CloudDocDetail | null;
};

// Optional now — the group page should use fetchGroupBootstrap instead.
// Keep only if you still need a global/admin list of all documents.
export async function fetchCloudDocList(): Promise<CloudDocSummary[]> {
  const res = await fetch(`${API_BASE}/process-docs/`);
  if (!res.ok) throw new Error("Failed to fetch document list.");
  return res.json();
}

export async function fetchCloudDoc(id: number): Promise<CloudDocDetail> {
  const res = await fetch(`${API_BASE}/process-docs/${id}/`);
  if (!res.ok) throw new Error("Failed to fetch document.");
  return res.json();
}

/** Documents belonging to one named group — for the Load menu on /process/<masterword>. */
export async function fetchGroupDocList(masterword: string): Promise<CloudDocSummary[]> {
  const res = await fetch(`${API_BASE}/process-docs/group/${encodeURIComponent(masterword)}/`);
  if (!res.ok) throw new Error("Failed to fetch group's document list.");
  return res.json();
}

/** The master document within one named group — what /process/<masterword> loads on mount. */
export async function fetchGroupMasterDoc(masterword: string): Promise<CloudDocDetail | null> {
  const res = await fetch(`${API_BASE}/process-docs/group/${encodeURIComponent(masterword)}/master/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch group's master document.");
  return res.json();
}

/**
 * Single round-trip for group pages.
 * Returns both the group's document list and its current master (if any).
 */
export async function fetchGroupBootstrap(masterword: string): Promise<GroupBootstrap> {
  const res = await fetch(`${API_BASE}/process-docs/group/${encodeURIComponent(masterword)}/bootstrap/`);
  if (!res.ok) throw new Error("Failed to fetch group data.");
  return res.json();
}

export async function saveCloudDoc(params: {
  passphrase: string;
  person_name?: string;
  title?: string;
  is_master?: boolean;
  master_key?: string;
  // Now required because every document belongs to a group.
  masterword: string;
  data: ProcessData;
}): Promise<CloudDocDetail> {
  const res = await fetch(`${API_BASE}/process-docs/save/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save document.");
  }
  return res.json();
}

export async function changeCloudPassphrase(
  oldPassphrase: string,
  newPassphrase: string
): Promise<CloudDocDetail> {
  const res = await fetch(`${API_BASE}/process-docs/change-passphrase/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_passphrase: oldPassphrase, new_passphrase: newPassphrase }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to change passphrase.");
  }
  return res.json();
}