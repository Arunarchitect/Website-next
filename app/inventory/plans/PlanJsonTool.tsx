"use client";

/* app/inventory/plans/PlanJsonTool.tsx
 *
 * Copy a plan as JSON, let an AI (or you) edit it, paste it back, validate it
 * against the CURRENT plan and inventory, then apply it through the normal
 * plan API calls (no new backend endpoint needed).
 *
 * COPY  : plan.taking, plan.toBuy and a catalogue of inventory items that are
 *         not yet in the plan, plus instructions for the AI.
 *
 * PASTE : matched by id
 *   taking  - {lineId}  existing line: qty / done may change
 *             {itemId}  not in the plan yet: added from inventory
 *             a line missing from the array is removed
 *   toBuy   - {lineId}  existing line: name / qty / unit / rate / done may change
 *             no lineId a new line to buy
 *             a line missing from the array is removed
 *   If "taking" or "toBuy" is left out completely, that list is untouched.
 */
import { useEffect, useState } from "react";
import { UNITS, fmtQty, getApiErrorMessage, unitShort, type Item, type Unit } from "../inventoryApi";
import { copyText } from "../itemJson";
import {
  addBuyLine,
  addItemsToPlan,
  deleteLine,
  field,
  getPlan,
  ghostBtn,
  primaryBtn,
  updateLine,
  type Plan,
  type PlanLine,
} from "../planApi";

/** An inventory item plus where it lives (shared with the plan page). */
export interface InventoryEntry {
  item: Item;
  project: string;
  org: string;
}

type Row = Record<string, unknown>;
type PlanPatch = Partial<Pick<PlanLine, "done" | "qty" | "est_rate" | "name" | "unit">>;

const CATALOG_CAP = 600;

// ── helpers ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** "kg", "Kilogram"-style aliases are not guessed; value or short text only. */
function normUnit(v: unknown): Unit | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const k = v.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const hit = UNITS.find(
    (u) => String(u.value).toUpperCase() === k || (u.short || "").toUpperCase() === k || (k === "NOS" && u.value === "COUNT")
  );
  return hit ? (hit.value as Unit) : null;
}

/** Accepts raw JSON, ```json fenced JSON, or JSON surrounded by chatter. */
function extractJson(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

const qtyText = (n: number | string, unit: string) => {
  const u = unitShort(unit);
  return `${fmtQty(n)}${u ? ` ${u}` : ""}`;
};

// ── COPY ──────────────────────────────────────────────────────────────────

const AI_INSTRUCTIONS = [
  "You are editing a checklist for a trip, move or event. 'taking' = things the person already owns (from inventory). 'toBuy' = things to buy, rent or borrow. Do what 'request' asks by editing ONLY 'taking' and 'toBuy', then reply with the full JSON object only (no commentary, no markdown fences, no extra fields).",
  "Keep 'plan' unchanged. A line that is missing from 'taking' or 'toBuy' will be DELETED, so keep every line you are not removing. If you omit 'taking' or 'toBuy' completely, that list is left untouched.",
  "TAKING: an existing line has a 'lineId'. Keep it. You may change only 'qty' and 'done' (done = packed).",
  "To add something the person ALREADY OWNS to 'taking', add {\"itemId\": <id>, \"qty\": <number>} using an itemId from 'inventory' EXACTLY. Never invent an itemId. Items already in 'taking' are not repeated in 'inventory'.",
  "TO BUY: an existing line has a 'lineId'. Keep it. You may change name, qty, unit, rate and done (done = already bought).",
  "To add a new thing to buy, add {\"name\": \"...\", \"qty\": 1, \"unit\": \"COUNT\", \"rate\": 250} with NO lineId. 'rate' is the price for ONE unit in rupees, or null if unknown.",
  "BEFORE adding anything to 'toBuy', check 'inventory' and 'taking'. If the person already owns it, add it to 'taking' with its itemId instead. Only set \"allowInInventory\": true on a new toBuy line when they really need to buy MORE of something they own.",
  "'unit' must be EXACTLY one of the values in 'allowed.units'. 'qty' is a number (decimals allowed, 0 or more). Do not change a unit to convert a quantity.",
  "No duplicates: the same name must not appear twice in 'toBuy' and the same itemId must not appear twice in 'taking'.",
  "'extraFor' on a toBuy line means it tops up the missing stock of that Taking line (its lineId). Keep these lines. If you change that Taking qty, set the toBuy qty to (taking qty - inStock), or remove the toBuy line when stock is enough.",
  "Leave 'request', 'instructions', 'allowed', 'plan', 'inventory' and 'exportedAt' unchanged or omit them.",
];

export function buildPlanJson(plan: Plan, entries: InventoryEntry[]) {
  const inPlan = new Set(plan.lines.map((l) => l.item).filter((x): x is number => x !== null));
  const catalogue = entries
    .filter((e) => !inPlan.has(e.item.id))
    .sort((a, b) => a.item.name.localeCompare(b.item.name));

  return {
    format: "plan-checklist",
    version: 1,
    request:
      "Edit ONLY 'taking' and 'toBuy'. Keep every line you are not removing. Then: <<WRITE YOUR CHANGE HERE>>",
    instructions: AI_INSTRUCTIONS,
    allowed: { units: UNITS.map((u) => ({ value: u.value, short: u.short || "nos" })) },
    plan: {
      id: plan.id,
      name: plan.name,
      kind: plan.kind,
      organisation: plan.organisation_name || null,
    },
    taking: plan.lines
      .filter((l) => l.source === "ITEM")
      .map((l) => ({
        lineId: l.id,
        itemId: l.item,
        code: l.item_code,
        name: l.name,
        qty: Number(l.qty),
        unit: l.unit,
        done: l.done,
        inStock: l.item_qty_have !== null ? Number(l.item_qty_have) : null,
      })),
    toBuy: plan.lines
      .filter((l) => l.source === "BUY")
      .map((l) => ({
        lineId: l.id,
        name: l.name,
        qty: Number(l.qty),
        unit: l.unit,
        rate: l.est_rate !== null ? Number(l.est_rate) : null,
        done: l.done,
        ...(l.for_line ? { extraFor: l.for_line } : {}),
      })),
    inventory: catalogue.slice(0, CATALOG_CAP).map(({ item: i, project, org }) => ({
      itemId: i.id,
      code: i.code,
      name: i.name,
      variant: i.variant || undefined,
      brand: i.brand || undefined,
      unit: i.unit,
      inStock: Number(i.qty_have),
      project,
      organisation: org,
    })),
    inventoryNote:
      catalogue.length > CATALOG_CAP
        ? `Only the first ${CATALOG_CAP} of ${catalogue.length} inventory items are listed (A to Z).`
        : `All ${catalogue.length} inventory items not yet in the plan are listed.`,
    exportedAt: new Date().toISOString(),
  };
}

export async function copyPlanForAi(plan: Plan, entries: InventoryEntry[]): Promise<{ ok: boolean; message: string }> {
  const payload = buildPlanJson(plan, entries);
  const ok = await copyText(JSON.stringify(payload, null, 2));
  return ok
    ? {
        ok,
        message: `Copied the plan for AI: ${payload.taking.length} taking, ${payload.toBuy.length} to buy, ${payload.inventory.length} inventory items.`,
      }
    : { ok, message: "Couldn’t copy to the clipboard." };
}

// ── VALIDATE ──────────────────────────────────────────────────────────────

export interface PlanOps {
  removeLines: PlanLine[]; // deleted explicitly
  addItems: { item: Item; qty: number; done: boolean }[];
  patches: { line: PlanLine; patch: PlanPatch }[];
  addBuys: { name: string; qty: number; unit: Unit; rate: number | null; done: boolean }[];
}

export interface PlanValidation {
  ok: boolean;
  errors: string[];
  notes: string[];
  changes: string[];
  summary?: string;
  ops?: PlanOps;
  hasChanges: boolean;
}

const KNOWN_KEYS = new Set([
  "format",
  "version",
  "request",
  "instructions",
  "allowed",
  "plan",
  "taking",
  "toBuy",
  "inventory",
  "inventoryNote",
  "exportedAt",
]);

export function validatePlanJson(
  text: string,
  plan: Plan,
  entries: InventoryEntry[],
  inventoryComplete: boolean
): PlanValidation {
  const errors: string[] = [];
  const notes: string[] = [];
  const changes: string[] = [];
  const fail = (e: string[]): PlanValidation => ({ ok: false, errors: e, notes, changes: [], hasChanges: false });

  // 1 ── parse
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch (e) {
    return fail([`Not valid JSON: ${(e as Error).message}`]);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(["Top level must be a JSON object."]);
  const obj = raw as Row;

  const extras = Object.keys(obj).filter((k) => !KNOWN_KEYS.has(k));
  if (extras.length) notes.push(`Ignored extra top-level key(s): ${extras.join(", ")}. Only "taking" and "toBuy" are used.`);

  const p = obj.plan;
  if (p && typeof p === "object" && (p as Row).id !== undefined && Number((p as Row).id) !== plan.id) {
    return fail(["This JSON was copied from a different plan. Copy this plan again and retry."]);
  }

  const hasTaking = Array.isArray(obj.taking);
  const hasBuy = Array.isArray(obj.toBuy);
  if (obj.taking !== undefined && !hasTaking) errors.push('"taking" must be an array.');
  if (obj.toBuy !== undefined && !hasBuy) errors.push('"toBuy" must be an array.');
  if (!hasTaking && !hasBuy && !errors.length) errors.push('Nothing to apply: include "taking" and/or "toBuy".');
  if (errors.length) return fail(errors);

  if (!inventoryComplete) {
    notes.push("Some inventories could not be loaded, so inventory conflicts may be missed.");
  }

  const takingLines = plan.lines.filter((l) => l.source === "ITEM");
  const buyLines = plan.lines.filter((l) => l.source === "BUY");
  const takingById = new Map(takingLines.map((l) => [l.id, l]));
  const buyById = new Map(buyLines.map((l) => [l.id, l]));
  const entryByItem = new Map(entries.map((e) => [e.item.id, e]));
  const itemInPlan = new Map<number, PlanLine>();
  takingLines.forEach((l) => l.item !== null && itemInPlan.set(l.item, l));

  // Inventory name index (exact, case-insensitive; with and without variant)
  const invIndex = new Map<string, InventoryEntry[]>();
  const indexName = (k: string, e: InventoryEntry) => invIndex.set(k, [...(invIndex.get(k) ?? []), e]);
  for (const e of entries) {
    indexName(norm(e.item.name), e);
    if (e.item.variant) indexName(norm(`${e.item.name} ${e.item.variant}`), e);
  }

  const ops: PlanOps = { removeLines: [], addItems: [], patches: [], addBuys: [] };
  const finalTakingNames = new Map<string, string>(); // norm name -> label
  const finalTaking: { line: PlanLine | null; name: string; qty: number; have: number | null }[] = [];

  // 2 ── TAKING
  const seenTaking = new Set<number>();
  const seenItems = new Set<number>();

  const readQty = (r: Row, tag: string): number | undefined | null => {
    if (r.qty === undefined) return undefined;
    const q = num(r.qty);
    if (q === null || q < 0) {
      errors.push(`${tag}: qty must be a number, 0 or more.`);
      return null;
    }
    return q;
  };
  const readDone = (r: Row, tag: string): boolean | undefined | null => {
    if (r.done === undefined) return undefined;
    if (typeof r.done !== "boolean") {
      errors.push(`${tag}: done must be true or false.`);
      return null;
    }
    return r.done;
  };

  if (hasTaking) {
    (obj.taking as unknown[]).forEach((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`taking[${i}] is not an object.`);
        return;
      }
      const r = row as Row;
      const lineId = num(r.lineId);
      const itemId = num(r.itemId);
      const nameHint = typeof r.name === "string" && r.name.trim() ? `"${r.name.trim()}"` : `taking[${i}]`;

      if (lineId !== null) {
        const line = takingById.get(lineId);
        if (!line) {
          errors.push(`${nameHint}: lineId ${lineId} is not a Taking line of this plan (it may have been removed, or it belongs to To buy).`);
          return;
        }
        if (seenTaking.has(lineId)) {
          errors.push(`${nameHint}: lineId ${lineId} appears twice in "taking".`);
          return;
        }
        seenTaking.add(lineId);
        const tag = `"${line.name}"`;
        const qty = readQty(r, tag);
        const done = readDone(r, tag);
        if (typeof r.name === "string" && r.name.trim() && r.name.trim() !== line.name) {
          notes.push(`${tag}: the name of a Taking line comes from inventory, so the new name was ignored.`);
        }
        const patch: PlanPatch = {};
        const parts: string[] = [];
        if (qty !== undefined && qty !== null && qty !== Number(line.qty)) {
          patch.qty = String(qty);
          parts.push(`quantity ${qtyText(line.qty, line.unit)} → ${qtyText(qty, line.unit)}`);
        }
        if (done !== undefined && done !== null && done !== line.done) {
          patch.done = done;
          parts.push(done ? "mark packed" : "mark not packed");
        }
        if (parts.length) {
          ops.patches.push({ line, patch });
          changes.push(`Taking · ${line.name}: ${parts.join(", ")}`);
        }
        finalTaking.push({
          line,
          name: line.name,
          qty: qty != null ? qty : Number(line.qty),
          have: line.item_qty_have !== null ? Number(line.item_qty_have) : null,
        });
        finalTakingNames.set(norm(line.name), line.name);
        return;
      }

      if (itemId !== null) {
        const tag = nameHint;
        const entry = entryByItem.get(itemId);
        if (!entry) {
          errors.push(`${tag}: itemId ${itemId} is not in any inventory you can see. Use an itemId from "inventory", or put it in "toBuy".`);
          return;
        }
        const existing = itemInPlan.get(itemId);
        if (existing) {
          errors.push(`${tag}: ${entry.item.name} (${entry.item.code}) is already in Taking. Edit that line with "lineId": ${existing.id}.`);
          return;
        }
        if (seenItems.has(itemId)) {
          errors.push(`${tag}: itemId ${itemId} (${entry.item.name}) appears twice in "taking".`);
          return;
        }
        seenItems.add(itemId);
        const qty = readQty(r, `${entry.item.name}`);
        const done = readDone(r, `${entry.item.name}`);
        const q = qty != null ? qty : 1;
        ops.addItems.push({ item: entry.item, qty: q, done: done === true });
        changes.push(`Taking · add ${entry.item.name} (${entry.item.code}) × ${qtyText(q, entry.item.unit)}`);
        finalTaking.push({ line: null, name: entry.item.name, qty: q, have: Number(entry.item.qty_have) });
        finalTakingNames.set(norm(entry.item.name), entry.item.name);
        return;
      }

      errors.push(`${nameHint}: needs "lineId" (an existing line) or "itemId" (an item from inventory). If this is not in your inventory, put it in "toBuy".`);
    });
  } else {
    takingLines.forEach((l) => {
      finalTakingNames.set(norm(l.name), l.name);
      finalTaking.push({
        line: l,
        name: l.name,
        qty: Number(l.qty),
        have: l.item_qty_have !== null ? Number(l.item_qty_have) : null,
      });
    });
  }

  const removedTaking = hasTaking ? takingLines.filter((l) => !seenTaking.has(l.id)) : [];
  const removedTakingIds = new Set(removedTaking.map((l) => l.id));
  removedTaking.forEach((l) => {
    ops.removeLines.push(l);
    changes.push(`Taking · remove ${l.name}`);
  });
  // The server deletes a shortfall line together with its Taking line.
  const cascadeIds = new Set(buyLines.filter((b) => b.for_line !== null && removedTakingIds.has(b.for_line)).map((b) => b.id));

  // 3 ── TO BUY
  const seenBuy = new Set<number>();
  const finalBuyNames = new Map<string, string>(); // norm name -> label
  const claimName = (name: string, tag: string) => {
    const k = norm(name);
    if (finalBuyNames.has(k)) errors.push(`${tag}: "${name}" appears twice in To buy.`);
    else finalBuyNames.set(k, tag);
  };

  if (hasBuy) {
    (obj.toBuy as unknown[]).forEach((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`toBuy[${i}] is not an object.`);
        return;
      }
      const r = row as Row;
      const lineId = num(r.lineId);

      // rate / unit are shared by existing and new lines
      let rate: number | null | undefined;
      if (r.rate === undefined) rate = undefined;
      else if (r.rate === null || r.rate === "") rate = null;
      else {
        const x = num(r.rate);
        rate = x !== null && x >= 0 ? x : undefined;
        if (x === null || x < 0) errors.push(`toBuy[${i}]: rate must be a number (price per unit) or null.`);
      }
      let unit: Unit | undefined;
      if (r.unit !== undefined) {
        const u = normUnit(r.unit);
        if (!u) errors.push(`toBuy[${i}]: unit "${String(r.unit)}" is not allowed. Use one of: ${UNITS.map((x) => x.value).join(", ")}.`);
        else unit = u;
      }

      if (lineId !== null) {
        const line = buyById.get(lineId);
        if (!line) {
          errors.push(`toBuy[${i}]: lineId ${lineId} is not a To buy line of this plan (it may have been removed, or it belongs to Taking).`);
          return;
        }
        if (seenBuy.has(lineId)) {
          errors.push(`"${line.name}": lineId ${lineId} appears twice in "toBuy".`);
          return;
        }
        seenBuy.add(lineId);
        if (cascadeIds.has(lineId)) {
          notes.push(`"${line.name}" tops up a Taking line that this paste removes, so it will be removed too.`);
          return;
        }
        const tag = `"${line.name}"`;
        const qty = readQty(r, tag);
        const done = readDone(r, tag);
        const patch: PlanPatch = {};
        const parts: string[] = [];
        let finalName = line.name;
        if (typeof r.name === "string") {
          if (!r.name.trim()) errors.push(`${tag}: name cannot be empty.`);
          else if (r.name.trim() !== line.name) {
            patch.name = r.name.trim();
            finalName = r.name.trim();
            parts.push(`rename to “${finalName}”`);
          }
        }
        if (qty !== undefined && qty !== null && qty !== Number(line.qty)) {
          patch.qty = String(qty);
          parts.push(`quantity ${qtyText(line.qty, line.unit)} → ${qtyText(qty, unit ?? line.unit)}`);
        }
        if (unit && unit !== line.unit) {
          patch.unit = unit;
          parts.push(`unit ${unitShort(line.unit) || "nos"} → ${unitShort(unit) || "nos"}`);
        }
        if (rate !== undefined) {
          const cur = line.est_rate === null ? null : Number(line.est_rate);
          if (rate !== cur) {
            patch.est_rate = rate === null ? null : String(rate);
            parts.push(rate === null ? "clear price" : `price ${cur === null ? "none" : cur} → ${rate}`);
          }
        }
        if (done !== undefined && done !== null && done !== line.done) {
          patch.done = done;
          parts.push(done ? "mark bought" : "mark not bought");
        }
        if (parts.length) {
          ops.patches.push({ line, patch });
          changes.push(`To buy · ${line.name}: ${parts.join(", ")}`);
        }
        claimName(finalName, tag);
        return;
      }

      // new line
      if (typeof r.name !== "string" || !r.name.trim()) {
        errors.push(`toBuy[${i}]: a new line needs a "name" (or a "lineId" to edit an existing line).`);
        return;
      }
      const name = r.name.trim();
      const tag = `“${name}”`;
      const qty = readQty(r, tag);
      const done = readDone(r, tag);
      claimName(name, tag);

      const key = norm(name);
      if (finalTakingNames.has(key)) {
        errors.push(`${tag} is already in Taking. Edit that line instead of buying it.`);
      }
      const hits = invIndex.get(key) ?? [];
      if (hits.length && r.allowInInventory !== true) {
        const h = hits[0];
        errors.push(
          `${tag} is already in your inventory as ${h.item.code} (${h.project}, have ${qtyText(h.item.qty_have, h.item.unit)}). Add it to "taking" with {"itemId": ${h.item.id}} instead, or set "allowInInventory": true if you really need to buy more of it.`
        );
      } else if (!hits.length && key.length >= 4) {
        const similar = entries
          .filter((e) => {
            const n = norm(e.item.name);
            return n.length >= 4 && (n.includes(key) || key.includes(n));
          })
          .slice(0, 3);
        if (similar.length) {
          notes.push(`${tag} looks similar to inventory item(s): ${similar.map((e) => `${e.item.name} (${e.item.code})`).join(", ")}. Check it is not something you already own.`);
        }
      }

      const u = unit ?? "COUNT";
      const q = qty != null ? qty : 1;
      ops.addBuys.push({ name, qty: q, unit: u, rate: rate ?? null, done: done === true });
      changes.push(`To buy · add ${name} × ${qtyText(q, u)}${rate != null ? ` at ₹${rate} each` : ""}${done === true ? " (already bought)" : ""}`);
    });

    buyLines.forEach((b) => {
      if (seenBuy.has(b.id) || cascadeIds.has(b.id)) return;
      ops.removeLines.push(b);
      changes.push(`To buy · remove ${b.name}`);
    });
  }

  if (errors.length) return fail(errors);

  // 4 ── soft checks: stock shortfalls that are not covered by a To buy line
  const covered = new Set<number>(
    buyLines
      .filter((b) => b.for_line !== null && !cascadeIds.has(b.id) && (!hasBuy || seenBuy.has(b.id)))
      .map((b) => b.for_line as number)
  );
  const short = finalTaking.filter((t) => t.have !== null && t.qty > t.have && !(t.line && covered.has(t.line.id)));
  short.slice(0, 4).forEach((t) =>
    notes.push(`${t.name}: taking ${fmtQty(t.qty)} but only ${fmtQty(t.have as number)} in stock. Consider buying the missing ${fmtQty(t.qty - (t.have as number))}.`)
  );
  if (short.length > 4) notes.push(`…and ${short.length - 4} more Taking item(s) above stock.`);

  const hasChanges = ops.removeLines.length + ops.addItems.length + ops.patches.length + ops.addBuys.length > 0;
  const summary = hasChanges
    ? `${ops.addItems.length} added to Taking, ${ops.addBuys.length} added to To buy, ${ops.patches.length} updated, ${ops.removeLines.length + cascadeIds.size} removed.`
    : "No changes compared with the current plan.";

  return { ok: true, errors: [], notes, changes, summary, ops, hasChanges };
}

// ── APPLY ─────────────────────────────────────────────────────────────────

export async function applyPlanOps(planId: number, ops: PlanOps): Promise<{ done: number; failed: string[] }> {
  let done = 0;
  const failed: string[] = [];
  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      done++;
    } catch (e) {
      failed.push(`${label}: ${getApiErrorMessage(e, "failed")}`);
    }
  };

  // 1. removals (Taking first: the server also removes their shortfall lines)
  const removals = [...ops.removeLines].sort((a, b) => (a.source === b.source ? 0 : a.source === "ITEM" ? -1 : 1));
  for (const l of removals) await run(`Remove ${l.name}`, () => deleteLine(l.id));

  // 2. items from inventory, then set their quantity / packed state
  if (ops.addItems.length) {
    let added = false;
    await run(`Add ${ops.addItems.length} item(s) to Taking`, async () => {
      await addItemsToPlan(planId, ops.addItems.map((a) => a.item.id));
      added = true;
    });
    if (added) {
      try {
        const fresh = await getPlan(planId);
        for (const a of ops.addItems) {
          const line = fresh.lines.find((l) => l.source === "ITEM" && l.item === a.item.id);
          if (!line) continue;
          const patch: PlanPatch = {};
          if (a.qty !== Number(line.qty)) patch.qty = String(a.qty);
          if (a.done) patch.done = true;
          if (Object.keys(patch).length) await run(`Set ${a.item.name}`, () => updateLine(line.id, patch));
        }
      } catch (e) {
        failed.push(`Couldn’t set quantities of the new items: ${getApiErrorMessage(e, "failed")}`);
      }
    }
  }

  // 3. edits to existing lines
  for (const { line, patch } of ops.patches) await run(`Update ${line.name}`, () => updateLine(line.id, patch));

  // 4. new lines to buy
  for (const b of ops.addBuys) {
    await run(`Add ${b.name}`, async () => {
      const line = await addBuyLine(planId, { name: b.name, qty: b.qty, unit: b.unit, est_rate: b.rate });
      if (b.done) await updateLine(line.id, { done: true });
    });
  }

  return { done, failed };
}

// ── DIALOG ────────────────────────────────────────────────────────────────

export default function PlanJsonTool({
  plan,
  entries,
  inventoryReady,
  inventoryComplete,
  onChanged,
  onNotice,
  onClose,
}: {
  plan: Plan;
  entries: InventoryEntry[];
  inventoryReady: boolean;
  inventoryComplete: boolean;
  onChanged: () => Promise<unknown>;
  onNotice: (msg: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PlanValidation | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const validate = () => {
    setFailures([]);
    setResult(validatePlanJson(text, plan, entries, inventoryComplete));
  };

  async function apply() {
    if (!result?.ok || !result.ops || !result.hasChanges) return;
    setBusy(true);
    const r = await applyPlanOps(plan.id, result.ops);
    try {
      await onChanged();
    } catch {
      /* the page shows its own error if the refresh fails */
    }
    setBusy(false);
    if (r.failed.length === 0) {
      onNotice(`Applied ${r.done} change${r.done === 1 ? "" : "s"} to the plan.`);
      onClose();
    } else {
      setFailures(r.failed);
      setResult(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-label="Paste plan JSON"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Paste plan JSON</h2>
          <button onClick={onClose} disabled={busy} className="text-slate-500 hover:text-slate-800" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm text-slate-700">
          <p className="text-xs text-slate-500">
            Use <strong>Copy for AI</strong> on the plan, ask the AI for your changes, then paste its reply here. Items are matched by{" "}
            <code>lineId</code> / <code>itemId</code>. Lines left out of <code>taking</code> or <code>toBuy</code> are removed. Nothing is
            saved until you press Apply.
          </p>

          {!inventoryReady && (
            <p role="status" className="flex items-center gap-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              Still loading your inventory. Validate unlocks when it is ready.
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setFailures([]);
            }}
            rows={12}
            spellCheck={false}
            placeholder='{ "taking": [ … ], "toBuy": [ … ] }'
            className={`${field} w-full font-mono text-xs`}
          />

          {failures.length > 0 && (
            <div role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <div className="mb-1 font-semibold">Some changes could not be saved. The rest were applied; the plan has been refreshed.</div>
              <ul className="list-inside list-disc">
                {failures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {result && result.notes.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="mb-1 font-semibold">Notes</div>
              <ul className="list-inside list-disc">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {result && !result.ok && (
            <div className="max-h-48 overflow-y-auto rounded border border-rose-200 bg-rose-50 px-3 py-2">
              <div className="mb-1 text-xs font-semibold text-rose-800">
                {result.errors.length} problem{result.errors.length === 1 ? "" : "s"} found. Nothing was changed:
              </div>
              <ul className="list-inside list-disc text-xs text-rose-800">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result?.ok && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <div className="font-semibold">✓ Valid. {result.summary}</div>
              {result.changes.length > 0 && (
                <ul className="mt-1 max-h-48 list-inside list-disc overflow-y-auto">
                  {result.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={validate} disabled={!text.trim() || !inventoryReady || busy} className={`${ghostBtn} disabled:opacity-50`}>
            Validate
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!result?.ok || !result.hasChanges || busy}
            className={primaryBtn}
            title={result?.ok ? (result.hasChanges ? "Apply to this plan" : "Nothing to apply") : "Validate first"}
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}