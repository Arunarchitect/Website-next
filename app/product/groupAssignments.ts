import type { Assignment } from "./productApi";

export type AssignmentGroup = {
  key: string;
  rep: Assignment; // representative row used for display
  ids: number[]; // every assignment id in the group
  quantity: number;
};

const norm = (s?: string | null) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Two assignments collapse into one row only if every one of these matches. */
export function groupKey(a: Assignment): string {
  return JSON.stringify([
    a.space,
    a.product,
    a.variant ?? null,
    a.proposed_by_user ?? `role:${a.proposed_by}`,
    norm(a.proposer_note),
    a.client_confirmed,
    a.architect_confirmed,
    a.declined,
    a.declined_by ?? null,
    norm(a.declined_note),
  ]);
}

export function groupAssignments(list: Assignment[]): AssignmentGroup[] {
  const map = new Map<string, AssignmentGroup>();
  for (const a of list) {
    const k = groupKey(a);
    const g = map.get(k);
    if (g) {
      g.ids.push(a.id);
      g.quantity += 1;
    } else {
      map.set(k, { key: k, rep: a, ids: [a.id], quantity: 1 });
    }
  }
  return Array.from(map.values());
}