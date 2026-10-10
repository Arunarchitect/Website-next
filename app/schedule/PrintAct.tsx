"use client";

import { useEffect, useMemo, useState } from "react";
import type { jsPDF } from "jspdf";
import {
  durationDays,
  flatten,
  isoWeek,
  rollup,
  toDay,
  todayISO,
} from "./scheduling";
import type { Row } from "./scheduling";
import type { Sequence, Task } from "./data";

type Orientation = "landscape" | "portrait";
type RowStatus = "critical" | "done" | "running" | "";
type Paper = "A4" | "A3" | "A2" | "A1" | "A0";
type RGB = [number, number, number];

const DAY_MS = 86400000;
const M = 10; // page margin, mm
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const PAPERS: Record<Paper, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
  A1: { w: 594, h: 841 },
  A0: { w: 841, h: 1189 },
};
const PAPER_LIST: Paper[] = ["A4", "A3", "A2", "A1", "A0"];

// Colours. Red is reserved for the critical path only.
const RED: RGB = [220, 38, 38];
const RED_DARK: RGB = [153, 27, 27];
const TODAY: RGB = [124, 58, 237]; // purple
const LINK: RGB = [100, 116, 139]; // slate
const INK: RGB = [17, 24, 39];
const NAVY: RGB = [30, 41, 59];
const MUTED: RGB = [71, 85, 105];

/* ---------------- helpers ---------------- */

// Built-in PDF fonts are Latin only: map/strip anything else.
const clean = (s: string) =>
  (s ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

const fitText = (doc: jsPDF, s: string, maxW: number) => {
  if (maxW <= 0) return "";
  if (doc.getTextWidth(s) <= maxW) return s;
  let t = s;
  while (t.length > 1 && doc.getTextWidth(t + "...") > maxW) t = t.slice(0, -1);
  return t + "...";
};

const fillC = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const drawC = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const textC = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

/* table status (completed > in progress > critical) */
function tableStatus(task: Task, crit: Set<string>): RowStatus {
  if (task.completion >= 100 || task.actualFinish) return "done";
  if (task.completion > 0 || task.actualStart) return "running";
  if (crit.has(task.id)) return "critical";
  return "";
}

/* chart status (completed > critical > in progress) so critical stays red */
function chartStatus(task: Task, crit: Set<string>): RowStatus {
  if (task.completion >= 100 || task.actualFinish) return "done";
  if (crit.has(task.id)) return "critical";
  if (task.completion > 0 || task.actualStart) return "running";
  return "";
}

const BAR: Record<RowStatus, { base: RGB; prog: RGB; text: RGB }> = {
  critical: { base: [252, 165, 165], prog: RED, text: RED_DARK },
  running: { base: [191, 219, 254], prog: [37, 99, 235], text: [30, 58, 138] },
  done: { base: [187, 247, 208], prog: [22, 163, 74], text: [20, 83, 45] },
  "": { base: [226, 232, 240], prog: [148, 163, 184], text: INK },
};

const TBL: Record<Exclude<RowStatus, "">, { fill: RGB; text: RGB }> = {
  critical: { fill: [254, 226, 226], text: RED_DARK },
  running: { fill: [219, 234, 254], text: [30, 64, 175] },
  done: { fill: [220, 252, 231], text: [22, 101, 52] },
};

interface Ctx {
  pw: number;
  ph: number;
  title: string;
  subtitle: string;
  meta: string;
  criticalIds: Set<string>;
  floats?: Map<string, number>;
  sequences: Sequence[];
  showLinks: boolean;
}

/* ---------------- table ---------------- */

function drawTable(doc: jsPDF, rows: Row[], c: Ctx) {
  const FONT = 7.5; // pt, same on every paper size
  const ROW = 4.8;
  const HDR = 5.5;
  const GAP = 6;
  const usableW = c.pw - 2 * M;
  // As many A4-width panels side by side as the sheet allows.
  const cols = Math.max(1, Math.floor((usableW + GAP) / (180 + GAP)));
  const panelW = (usableW - GAP * (cols - 1)) / cols;
  const frac = [0.09, 0.41, 0.135, 0.135, 0.07, 0.07, 0.09];
  const xs: number[] = [];
  let acc = 0;
  for (const f of frac) {
    xs.push(acc * panelW);
    acc += f;
  }
  const ws = frac.map((f) => f * panelW);

  const pageHeader = (first: boolean) => {
    doc.setFont("helvetica", "bold");
    textC(doc, INK);
    if (first) {
      doc.setFontSize(15);
      doc.text(clean(c.title), M, M + 5);
      let y = M + 5;
      if (c.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        textC(doc, [68, 68, 68]);
        y += 5;
        doc.text(clean(c.subtitle), M, y);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      textC(doc, [85, 85, 85]);
      y += 4.5;
      doc.text(clean(c.meta), M, y);
      return y + 3;
    }
    doc.setFontSize(9);
    doc.text(clean(c.title) + " (cont.)", M, M + 3.5);
    return M + 7;
  };

  let idx = 0;
  let page = 0;
  while (idx < rows.length) {
    if (page > 0) doc.addPage();
    const y0 = pageHeader(page === 0);
    const rowsPer = Math.max(1, Math.floor((c.ph - M - y0 - HDR) / ROW));
    for (let p = 0; p < cols && idx < rows.length; p++) {
      const px = M + p * (panelW + GAP);

      fillC(doc, [243, 244, 246]);
      drawC(doc, [156, 163, 175]);
      doc.setLineWidth(0.15);
      doc.rect(px, y0, panelW, HDR, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONT);
      textC(doc, [75, 85, 99]);
      const heads = ["#", "TASK", "START", "FINISH", "DAYS", "FLOAT", "%"];
      heads.forEach((h, i) => {
        const right = i >= 4;
        doc.text(
          h,
          right ? px + xs[i] + ws[i] - 1.2 : px + xs[i] + 1.2,
          y0 + HDR / 2,
          { baseline: "middle", align: right ? "right" : "left" }
        );
      });

      for (let k = 0; k < rowsPer && idx < rows.length; k++, idx++) {
        const { task, wbs, depth, hasChildren } = rows[idx];
        const y = y0 + HDR + k * ROW;
        const st = tableStatus(task, c.criticalIds);
        const style = st ? TBL[st] : null;
        fillC(
          doc,
          style ? style.fill : hasChildren ? [249, 250, 251] : [255, 255, 255]
        );
        drawC(doc, [209, 213, 219]);
        doc.setLineWidth(0.1);
        doc.rect(px, y, panelW, ROW, "FD");
        textC(doc, style ? style.text : INK);
        doc.setFont("helvetica", hasChildren ? "bold" : "normal");
        doc.setFontSize(FONT);
        const ym = y + ROW / 2;
        doc.text(fitText(doc, clean(wbs), ws[0] - 2), px + xs[0] + 1.2, ym, {
          baseline: "middle",
        });
        const indent = depth * 2;
        doc.text(
          fitText(doc, clean(task.name), ws[1] - 2.4 - indent),
          px + xs[1] + 1.2 + indent,
          ym,
          { baseline: "middle" }
        );
        doc.text(task.scheduleStart, px + xs[2] + 1.2, ym, { baseline: "middle" });
        doc.text(task.scheduleFinish, px + xs[3] + 1.2, ym, { baseline: "middle" });
        const fl = c.floats?.get(task.id);
        const cells = [
          String(durationDays(task)),
          hasChildren || fl === undefined ? "-" : String(fl),
          String(task.completion),
        ];
        cells.forEach((t, i) => {
          const col = i + 4;
          doc.text(t, px + xs[col] + ws[col] - 1.2, ym, {
            baseline: "middle",
            align: "right",
          });
        });
      }
    }
    page++;
  }
}

/* ---------------- gantt ---------------- */

const MIN_ROW = 4;
const MAX_ROW = 7;
const DATE_PAD = 14; // mm kept free at each end of the timeline for dates

function pickRows(rows: Row[], avail: number) {
  const cap = Math.floor(avail / MIN_ROW);
  if (rows.length <= cap) return { shown: rows, level: -1 };
  const maxD = rows.reduce((m, r) => Math.max(m, r.depth), 0);
  for (let d = maxD - 1; d >= 0; d--) {
    const cand = rows.filter((r) => r.depth <= d);
    if (cand.length <= cap) return { shown: cand, level: d };
  }
  return { shown: rows, level: -1 }; // last resort: paginate
}

function drawGantt(doc: jsPDF, rows: Row[], c: Ctx, needNewPage: boolean) {
  if (!rows.length) return;
  const usableW = c.pw - 2 * M;
  const chartTop = M + 11;
  const HEAD = 11;
  const LEGEND = 9;
  const avail = c.ph - M - LEGEND - chartTop - HEAD;

  const { shown, level } = pickRows(rows, avail);
  const summarized = level >= 0;

  // hidden leaf tasks -> drawn as thin strips inside their group row
  const shownIds = new Set(shown.map((r) => r.task.id));
  const tiny = new Map<string, Task[]>();
  if (summarized) {
    let owner: string | null = null;
    for (const r of rows) {
      if (shownIds.has(r.task.id)) {
        owner = r.task.id;
        continue;
      }
      if (!r.hasChildren && owner) {
        if (!tiny.has(owner)) tiny.set(owner, []);
        tiny.get(owner)!.push(r.task);
      }
    }
  }

  const perPage = Math.max(1, Math.floor(avail / MIN_ROW));
  const pages = Math.ceil(shown.length / perPage);
  const rowH = Math.min(MAX_ROW, avail / Math.min(shown.length, perPage));
  const fontPt = Math.min(11, Math.max(4.5, rowH * 2.835 * 0.44));
  const dateFont = Math.max(4, fontPt * 0.8);

  // time scale over ALL selected rows, with room at both ends for dates
  let minDay = Infinity;
  let maxDay = -Infinity;
  for (const r of rows) {
    minDay = Math.min(minDay, toDay(r.task.scheduleStart));
    maxDay = Math.max(maxDay, toDay(r.task.scheduleFinish));
  }
  const totalDays = Math.max(1, maxDay - minDay + 1);
  const plotL = M + DATE_PAD;
  const plotW = usableW - 2 * DATE_PAD;
  const ppd = plotW / totalDays; // mm per day
  const X = (day: number) => plotL + (day - minDay) * ppd;
  const frameL = M;
  const frameR = M + usableW;

  const todayDay = toDay(todayISO());
  const todayIn = todayDay >= minDay && todayDay <= maxDay;

  const multiYear =
    new Date(minDay * DAY_MS).getUTCFullYear() !==
    new Date(maxDay * DAY_MS).getUTCFullYear();
  const fmtD = (iso: string) => {
    const d = new Date(toDay(iso) * DAY_MS);
    const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    return multiYear ? `${base} ${String(d.getUTCFullYear()).slice(2)}` : base;
  };

  // lag text per task (incoming links with a lag)
  const lagOf = new Map<string, string>();
  {
    const tmp = new Map<string, number[]>();
    for (const sq of c.sequences) {
      if (!sq.lagDays) continue;
      if (!tmp.has(sq.relatedTask)) tmp.set(sq.relatedTask, []);
      tmp.get(sq.relatedTask)!.push(sq.lagDays);
    }
    for (const [id, arr] of tmp) {
      const vals = [...new Set(arr)].map((v) => (v > 0 ? "+" : "") + v);
      lagOf.set(id, `lag ${vals.join("/")}d`);
    }
  }

  const months: { label: string; x: number; w: number }[] = [];
  {
    let d = minDay;
    while (d <= maxDay) {
      const dt = new Date(d * DAY_MS);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const mEnd = Math.round(Date.UTC(y, m + 1, 0) / DAY_MS);
      const segEnd = Math.min(maxDay, mEnd);
      const w = (segEnd - d + 1) * ppd;
      const long = dt.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
      const short = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      months.push({ label: w >= 18 ? long : w >= 8 ? short : "", x: X(d), w });
      d = segEnd + 1;
    }
  }
  const showDays = ppd >= 3.4;
  const ticks: { label: string; x: number; w: number }[] = [];
  if (showDays) {
    for (let d = minDay; d <= maxDay; d++) {
      ticks.push({ label: String(new Date(d * DAY_MS).getUTCDate()), x: X(d), w: ppd });
    }
  } else if (ppd * 7 >= 9) {
    let d = minDay;
    while (d <= maxDay) {
      const dow = new Date(d * DAY_MS).getUTCDay();
      const wk = d - ((dow + 6) % 7);
      const s = Math.max(minDay, wk);
      const e = Math.min(maxDay, wk + 6);
      ticks.push({
        label: `W${isoWeek(new Date(wk * DAY_MS))}`,
        x: X(s),
        w: (e - s + 1) * ppd,
      });
      d = e + 1;
    }
  }

  for (let pg = 0; pg < pages; pg++) {
    if (pg > 0 || needNewPage) doc.addPage();
    const chunk = shown.slice(pg * perPage, (pg + 1) * perPage);
    const top = chartTop + HEAD;
    const bodyH = chunk.length * rowH;
    const bottom = top + bodyH;

    // page title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    textC(doc, INK);
    doc.text(clean(c.title) + " - Gantt chart", M, M + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    textC(doc, [85, 85, 85]);
    doc.text(
      `${clean(c.meta.split(" | ").slice(0, 2).join(" | "))}${pages > 1 ? `  |  page ${pg + 1}/${pages}` : ""}`,
      c.pw - M,
      M + 5,
      { align: "right" }
    );

    // header: dark month band + light day/week band
    const bandH = HEAD / 2;
    fillC(doc, NAVY);
    doc.rect(M, chartTop, usableW, bandH, "F");
    fillC(doc, [241, 245, 249]);
    doc.rect(M, chartTop + bandH, usableW, bandH, "F");

    // row stripes (full width), then weekend shading
    for (let i = 0; i < chunk.length; i++) {
      if (i % 2 === 1) {
        fillC(doc, [248, 250, 252]);
        doc.rect(M, top + i * rowH, usableW, rowH, "F");
      }
    }
    if (ppd >= 0.8) {
      fillC(doc, [238, 242, 246]);
      for (let d = minDay; d <= maxDay; d++) {
        const g = new Date(d * DAY_MS).getUTCDay();
        if (g === 0 || g === 6) doc.rect(X(d), top, ppd, bodyH, "F");
      }
    }
    drawC(doc, [226, 232, 240]);
    doc.setLineWidth(0.06);
    for (let i = 0; i < chunk.length; i++) {
      const y = top + (i + 1) * rowH;
      doc.line(M, y, M + usableW, y);
    }

    // day / week grid
    drawC(doc, [226, 232, 240]);
    doc.setLineWidth(0.04);
    for (const t of ticks) doc.line(t.x, chartTop + bandH, t.x, bottom);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    textC(doc, MUTED);
    for (const t of ticks) {
      doc.text(t.label, t.x + t.w / 2, chartTop + bandH * 1.5, {
        align: "center",
        baseline: "middle",
      });
    }
    // month lines + labels
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    for (const m of months) {
      drawC(doc, [148, 163, 184]);
      doc.setLineWidth(0.12);
      doc.line(m.x, chartTop, m.x, bottom);
      if (m.label) {
        textC(doc, [255, 255, 255]);
        doc.text(m.label, m.x + 1, chartTop + bandH / 2, { baseline: "middle" });
      }
    }

    const rowIndex = new Map<string, number>();
    chunk.forEach((r, i) => rowIndex.set(r.task.id, i));
    const rowTask = new Map(chunk.map((r) => [r.task.id, r.task]));

    // bars + on-bar labels
    chunk.forEach(({ task, depth, hasChildren, wbs }, i) => {
      const y = top + i * rowH;
      const ym = y + rowH / 2;
      const status = chartStatus(task, c.criticalIds);
      const isCrit = !hasChildren && status === "critical";
      const s = toDay(task.scheduleStart);
      const f = toDay(task.scheduleFinish);
      const bx = X(s);
      const bw = Math.max(0.6, (f - s + 1) * ppd);
      const isMs = !!task.isMilestone && !hasChildren;
      const kids = hasChildren ? tiny.get(task.id) : undefined;

      // ---- bar geometry + drawing ----
      let by = y + rowH * 0.15;
      let bh = rowH * 0.7;
      let textY = by + bh * 0.42; // inside-label centre line

      if (hasChildren) {
        by = kids ? y + rowH * 0.06 : y + rowH * 0.15;
        bh = rowH * 0.5;
        textY = by + bh / 2;
        fillC(doc, NAVY);
        doc.rect(bx, by, bw, bh, "F");
        if (!kids) {
          const tw = Math.min(rowH * 0.3, bw / 2);
          const th = rowH * 0.22;
          doc.triangle(bx, by + bh, bx + tw, by + bh, bx, by + bh + th, "F");
          doc.triangle(bx + bw, by + bh, bx + bw - tw, by + bh, bx + bw, by + bh + th, "F");
        } else {
          const sy = y + rowH * 0.64;
          const sh = rowH * 0.3;
          for (const k of kids) {
            const ks = toDay(k.scheduleStart);
            const kf = toDay(k.scheduleFinish);
            const st = chartStatus(k, c.criticalIds);
            fillC(doc, BAR[st].prog);
            doc.rect(X(ks), sy, Math.max(0.4, (kf - ks + 1) * ppd), sh, "F");
          }
        }
      } else if (isMs) {
        const cxm = bx + bw / 2;
        const h = rowH * 0.36;
        fillC(doc, [245, 158, 11]);
        doc.triangle(cxm, ym - h, cxm + h, ym, cxm, ym + h, "F");
        doc.triangle(cxm, ym - h, cxm - h, ym, cxm, ym + h, "F");
      } else {
        const r = Math.min(0.4, bh / 3);
        fillC(doc, BAR[status].base);
        doc.roundedRect(bx, by, bw, bh, r, r, "F");
        if (task.completion > 0) {
          // progress = strip along the bottom, so text above stays readable
          const stripH = bh * 0.28;
          fillC(doc, BAR[status].prog);
          doc.rect(
            bx,
            by + bh - stripH,
            (bw * Math.min(100, task.completion)) / 100,
            stripH,
            "F"
          );
        }
        drawC(doc, BAR[status].prog);
        doc.setLineWidth(0.12);
        doc.roundedRect(bx, by, bw, bh, r, r, "S");
      }

      // ---- text pieces ----
      const parts: string[] = [`${wbs} ${task.name}`];
      if (!isMs) parts.push(`${durationDays(task)}d`);
      const lag = lagOf.get(task.id);
      if (lag) parts.push(lag);
      const label = clean(parts.join("  \u00B7  "));

      doc.setFont("helvetica", hasChildren ? "bold" : "normal");
      doc.setFontSize(fontPt);
      const labW = doc.getTextWidth(label);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(dateFont);
      const sTxt = fmtD(task.scheduleStart);
      const eTxt = fmtD(task.scheduleFinish);
      const sW = isMs ? 0 : doc.getTextWidth(sTxt);
      const eW = doc.getTextWidth(eTxt);
      const G = 0.9;

      // dates: start on the left, end on the right (a milestone shows one date)
      textC(doc, MUTED);
      if (!isMs) doc.text(sTxt, bx - G, ym, { align: "right", baseline: "middle" });
      doc.text(isMs ? sTxt : eTxt, bx + bw + G, ym, { baseline: "middle" });

      // name + duration (+ lag): inside the bar if it fits, else beside the dates
      doc.setFont("helvetica", hasChildren ? "bold" : "normal");
      doc.setFontSize(fontPt);
      if (!isMs && labW <= bw - 1.6) {
        textC(doc, hasChildren ? [255, 255, 255] : BAR[status].text);
        doc.text(label, bx + 0.8, textY, { baseline: "middle" });
      } else {
        const rightX = bx + bw + G + (isMs ? doc.getTextWidth("") : 0);
        // reserve the date that sits right of the bar
        doc.setFont("helvetica", "normal");
        doc.setFontSize(dateFont);
        const eWidth = isMs ? doc.getTextWidth(sTxt) : eW;
        doc.setFont("helvetica", hasChildren ? "bold" : "normal");
        doc.setFontSize(fontPt);
        const rightStart = rightX + eWidth + G * 1.6;
        const rightRoom = frameR - 0.8 - rightStart;
        const leftEnd = bx - G - (isMs ? 0 : sW) - G * 1.6;
        const leftRoom = leftEnd - (frameL + 0.8);

        textC(doc, hasChildren ? NAVY : isCrit ? RED_DARK : INK);
        if (labW <= rightRoom) {
          doc.text(label, rightStart, ym, { baseline: "middle" });
        } else if (labW <= leftRoom) {
          doc.text(label, leftEnd, ym, { align: "right", baseline: "middle" });
        } else if (rightRoom >= leftRoom && rightRoom > 8) {
          doc.text(fitText(doc, label, rightRoom), rightStart, ym, {
            baseline: "middle",
          });
        } else if (leftRoom > 8) {
          doc.text(fitText(doc, label, leftRoom), leftEnd, ym, {
            align: "right",
            baseline: "middle",
          });
        }
      }
      void depth;
    });

    // dependency arrows (only between rows drawn on this page)
    if (c.showLinks && c.sequences.length) {
      const stub = Math.min(1.6, Math.max(0.6, rowH * 0.3));
      const ah = Math.min(1.4, Math.max(0.7, rowH * 0.28));
      const gap = 0.25;

      const draw = (critical: boolean) => {
        for (const sq of c.sequences) {
          const pi = rowIndex.get(sq.relatingTask);
          const qi = rowIndex.get(sq.relatedTask);
          if (pi === undefined || qi === undefined) continue;
          const isCrit =
            c.criticalIds.has(sq.relatingTask) && c.criticalIds.has(sq.relatedTask);
          if (isCrit !== critical) continue;
          const p = rowTask.get(sq.relatingTask)!;
          const q = rowTask.get(sq.relatedTask)!;
          const pL = X(toDay(p.scheduleStart));
          const pR = X(toDay(p.scheduleFinish) + 1);
          const qL = X(toDay(q.scheduleStart));
          const qR = X(toDay(q.scheduleFinish) + 1);
          const y1 = top + pi * rowH + rowH / 2;
          const y2 = top + qi * rowH + rowH / 2;
          const pStart = sq.sequenceType === "START_START" || sq.sequenceType === "START_FINISH";
          const qStart = sq.sequenceType === "START_START" || sq.sequenceType === "FINISH_START";
          const x1 = pStart ? pL - gap : pR + gap;
          const x2 = qStart ? qL - gap : qR + gap;

          let pts: [number, number][];
          let pointRight = qStart;
          if (qStart) {
            if (pStart) {
              const xl = Math.min(x1, x2) - stub;
              pts = [[x1, y1], [xl, y1], [xl, y2], [x2, y2]];
            } else if (x2 >= x1 + 0.5) {
              const mx = x1 + (x2 - x1) / 2;
              pts = [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
            } else {
              const laneY = top + qi * rowH;
              pts = [
                [x1, y1], [x1 + stub, y1], [x1 + stub, laneY],
                [x2 - stub, laneY], [x2 - stub, y2], [x2, y2],
              ];
            }
          } else {
            const xr = Math.max(x1, x2) + stub;
            pts = [[x1, y1], [xr, y1], [xr, y2], [x2, y2]];
            pointRight = false;
          }

          drawC(doc, critical ? RED : LINK);
          fillC(doc, critical ? RED : LINK);
          doc.setLineWidth(critical ? 0.32 : 0.14);
          for (let k = 0; k < pts.length - 1; k++) {
            doc.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
          }
          const [ex, ey] = pts[pts.length - 1];
          const dir = pointRight ? 1 : -1;
          doc.triangle(ex - dir * ah, ey - ah * 0.55, ex - dir * ah, ey + ah * 0.55, ex, ey, "F");
        }
      };
      draw(false);
      draw(true); // critical links on top
    }

    // frame
    drawC(doc, [148, 163, 184]);
    doc.setLineWidth(0.2);
    doc.rect(M, chartTop, usableW, HEAD + bodyH, "S");

    // today: purple dashed line + tag
    if (todayIn) {
      const tx = X(todayDay) + ppd / 2;
      drawC(doc, TODAY);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1.2, 0.8], 0);
      doc.line(tx, top, tx, bottom);
      doc.setLineDashPattern([], 0);
      fillC(doc, TODAY);
      doc.roundedRect(tx - 4, bottom + 0.4, 8, 3, 0.6, 0.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      textC(doc, [255, 255, 255]);
      doc.text("TODAY", tx, bottom + 1.9, { align: "center", baseline: "middle" });
    }

    // legend
    const ly = c.ph - M - 2.5;
    let lx = M;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const items: [string, RGB][] = [
      ["Critical path", RED],
      ["In progress", BAR.running.prog],
      ["Complete", BAR.done.prog],
      ["Not started", BAR[""].prog],
      ["Group", NAVY],
      ["Milestone", [245, 158, 11]],
      ["Today", TODAY],
    ];
    for (const [t, col] of items) {
      fillC(doc, col);
      doc.rect(lx, ly - 1.4, 3.2, 2.8, "F");
      textC(doc, [51, 51, 51]);
      doc.text(t, lx + 4.5, ly, { baseline: "middle" });
      lx += 4.5 + doc.getTextWidth(t) + 5;
    }
    if (c.showLinks) {
      drawC(doc, LINK);
      fillC(doc, LINK);
      doc.setLineWidth(0.2);
      doc.line(lx, ly, lx + 5, ly);
      doc.triangle(lx + 5, ly, lx + 3.8, ly - 0.7, lx + 3.8, ly + 0.7, "F");
      textC(doc, [51, 51, 51]);
      doc.text("Dependency", lx + 6.5, ly, { baseline: "middle" });
      lx += 6.5 + doc.getTextWidth("Dependency") + 5;
    }
    textC(doc, [107, 114, 128]);
    doc.text("Bar text: name \u00B7 days \u00B7 lag.  Bottom strip = progress.", lx, ly, {
      baseline: "middle",
    });
    if (summarized) {
      doc.text(
        `Too many tasks for one sheet: showing levels 1-${level + 1}; detail tasks drawn as thin strips in their group.`,
        c.pw - M,
        ly,
        { align: "right", baseline: "middle" }
      );
    }
  }
}

/* ---------------- component ---------------- */

export function PrintAct({
  tasks,
  criticalIds,
  title,
  projectName,
  floats,
  sequences,
}: {
  tasks: Task[];
  /** Kept for compatibility; the picker uses the full tree instead. */
  rows?: Row[];
  criticalIds: Set<string>;
  title: string;
  projectName?: string;
  floats?: Map<string, number>;
  sequences?: Sequence[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickCollapsed, setPickCollapsed] = useState<Set<string>>(new Set());
  const [includeTable, setIncludeTable] = useState(true);
  const [includeGantt, setIncludeGantt] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const [orient, setOrient] = useState<Orientation>("landscape");
  const [paper, setPaper] = useState<Paper>("A4");
  const [busy, setBusy] = useState(false);

  const allRows = useMemo(
    () => flatten(rollup(tasks), new Set<string>()),
    [tasks]
  );

  const subtreeIds = (index: number): string[] => {
    const base = allRows[index];
    const out = [base.task.id];
    for (let j = index + 1; j < allRows.length; j++) {
      if (allRows[j].depth <= base.depth) break;
      out.push(allRows[j].task.id);
    }
    return out;
  };

  const pickerRows = useMemo(() => {
    const out: { row: Row; index: number }[] = [];
    let skipBelow: number | null = null;
    allRows.forEach((row, index) => {
      if (skipBelow !== null) {
        if (row.depth > skipBelow) return;
        skipBelow = null;
      }
      out.push({ row, index });
      if (row.hasChildren && pickCollapsed.has(row.task.id)) {
        skipBelow = row.depth;
      }
    });
    return out;
  }, [allRows, pickCollapsed]);

  const sorted = useMemo(
    () => allRows.filter((r) => selected.has(r.task.id)),
    [allRows, selected]
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(allRows.map((r) => r.task.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allRows]);

  const openPicker = () => {
    setSelected(new Set(allRows.map((r) => r.task.id)));
    setPickerOpen(true);
  };
  const selectAll = () => setSelected(new Set(allRows.map((r) => r.task.id)));
  const selectNone = () => setSelected(new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleGroup = (index: number) => {
    const ids = subtreeIds(index);
    setSelected((prev) => {
      const n = new Set(prev);
      const allOn = ids.every((id) => prev.has(id));
      for (const id of ids) {
        if (allOn) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  };

  const togglePickCollapse = (id: string) =>
    setPickCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const canPrint =
    selected.size > 0 && (includeTable || includeGantt) && !busy;

  const download = async () => {
    if (!canPrint) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const P = PAPERS[paper];
      const doc = new jsPDF({
        orientation: orient,
        unit: "mm",
        format: [P.w, P.h],
      });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      const reportTitle = projectName || title;
      let crit = 0,
        done = 0,
        running = 0;
      for (const r of sorted) {
        const s = tableStatus(r.task, criticalIds);
        if (s === "critical") crit++;
        else if (s === "done") done++;
        else if (s === "running") running++;
      }
      const activities = sorted.filter((r) => !r.hasChildren).length;
      const meta = [
        `Printed ${new Date().toLocaleDateString()}`,
        `${paper} ${orient}`,
        `${sorted.length} rows (${activities} activities)`,
        `${crit} critical`,
        `${running} in progress`,
        `${done} complete`,
        ...(sorted.length < allRows.length ? ["partial selection"] : []),
      ].join(" | ");

      const ctx: Ctx = {
        pw,
        ph,
        title: reportTitle,
        subtitle: projectName && title !== projectName ? title : "",
        meta,
        criticalIds,
        floats,
        sequences: sequences ?? [],
        showLinks,
      };

      if (includeTable) drawTable(doc, sorted, ctx);
      if (includeGantt) drawGantt(doc, sorted, ctx, includeTable);

      const safe = clean(reportTitle).replace(/[^\w\-]+/g, "_").slice(0, 60);
      doc.save(`${safe || "schedule"}_${paper}_${orient}.pdf`);
      setPickerOpen(false);
    } catch (e) {
      console.error(e);
      window.alert("Couldn't create the PDF. Check the console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={openPicker}
        className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        title="Download PDF (choose activities, paper size)"
        data-print-hide
      >
        <svg
          className="h-4 w-4 text-gray-600"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M6 2.5A1.5 1.5 0 0 0 4.5 4v3.05A2.5 2.5 0 0 0 3 9.5v3A1.5 1.5 0 0 0 4.5 14H5v2.5A1.5 1.5 0 0 0 6.5 18h7a1.5 1.5 0 0 0 1.5-1.5V14h.5a1.5 1.5 0 0 0 1.5-1.5v-3a2.5 2.5 0 0 0-1.5-2.45V4A1.5 1.5 0 0 0 14 2.5H6Zm.5 1.5h7v3h-7V4Zm0 11.5v-4h7v4h-7Z" />
        </svg>
        Print / PDF
      </button>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onClick={() => setPickerOpen(false)}
          data-print-hide
        >
          <div
            className="flex max-h-[92vh] w-full max-w-md flex-col rounded-lg bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              Download PDF
            </h3>
            <p className="mb-2 text-xs text-gray-500">
              Tick what goes into the PDF. A group tick selects everything under
              it.
            </p>

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={selectAll}
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                Select all
              </button>
              <button
                onClick={selectNone}
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                Unselect all
              </button>
              <span className="ml-auto text-xs tabular-nums text-gray-500">
                {selected.size} of {allRows.length} selected
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded border">
              {pickerRows.map(({ row, index }) => {
                const { task, depth, hasChildren, wbs } = row;
                let checked = selected.has(task.id);
                let partial = false;
                if (hasChildren) {
                  const ids = subtreeIds(index);
                  const on = ids.filter((id) => selected.has(id)).length;
                  checked = on === ids.length;
                  partial = on > 0 && on < ids.length;
                }
                const isCollapsed = pickCollapsed.has(task.id);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-1.5 border-b px-2 py-1 text-xs last:border-b-0 hover:bg-gray-50"
                    style={{ paddingLeft: 8 + depth * 14 }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => togglePickCollapse(task.id)}
                        className="w-3 shrink-0 text-gray-500"
                        title={isCollapsed ? "Expand" : "Collapse"}
                      >
                        {isCollapsed ? "▶" : "▼"}
                      </button>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        ref={(el) => {
                          if (el) el.indeterminate = partial;
                        }}
                        onChange={() =>
                          hasChildren ? toggleGroup(index) : toggleOne(task.id)
                        }
                      />
                      <span className="shrink-0 font-mono text-[10px] text-gray-400">
                        {wbs}
                      </span>
                      <span
                        className={`truncate ${hasChildren ? "font-semibold" : ""}`}
                        title={task.name}
                      >
                        {task.name}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>

            <p className="mb-1 mt-3 text-xs font-medium text-gray-700">
              Include in PDF
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeTable}
                  onChange={(e) => setIncludeTable(e.target.checked)}
                />
                Task table
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeGantt}
                  onChange={(e) => setIncludeGantt(e.target.checked)}
                />
                Gantt chart
              </label>
              <label
                className={`flex cursor-pointer items-center gap-1.5 ${
                  includeGantt ? "" : "opacity-40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={showLinks}
                  disabled={!includeGantt}
                  onChange={(e) => setShowLinks(e.target.checked)}
                />
                Dependency arrows
              </label>
            </div>
            {!includeTable && !includeGantt && (
              <p className="mt-1 text-[11px] text-red-600">
                Tick at least one: table or Gantt.
              </p>
            )}

            <p className="mb-1 mt-3 text-xs font-medium text-gray-700">
              Paper size
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {PAPER_LIST.map((p) => (
                <button
                  key={p}
                  onClick={() => setPaper(p)}
                  className={`rounded border px-2 py-1.5 text-xs font-medium ${
                    paper === p
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={`${PAPERS[p].w} × ${PAPERS[p].h} mm`}
                >
                  {p}
                </button>
              ))}
            </div>

            <p className="mb-1 mt-3 text-xs font-medium text-gray-700">
              Orientation
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["portrait", "landscape"] as Orientation[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrient(o)}
                  className={`rounded border px-3 py-1.5 text-xs font-medium capitalize ${
                    orient === o
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={download}
                disabled={!canPrint}
                className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Creating PDF…" : `Download ${paper} ${orient} PDF`}
              </button>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded border px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}