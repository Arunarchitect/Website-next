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
  // null when the doc isn't in a named group (i.e. it's on the default page)
  group_masterword: string | null;
};

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

export async function fetchMasterDoc(): Promise<CloudDocDetail | null> {
  const res = await fetch(`${API_BASE}/process-docs/master/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch master document.");
  return res.json();
}

/** Documents belonging to one named group — for a Load menu on /process/<masterword>. */
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

export async function saveCloudDoc(params: {
  passphrase: string;
  person_name?: string;
  title?: string;
  is_master?: boolean;
  master_key?: string;
  // Join/stay in this named group. Omit to leave the doc's current group
  // (or lack of one) unchanged.
  masterword?: string;
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