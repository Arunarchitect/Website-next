"use client";

import { durationDays } from "./scheduling";
import type { Row } from "./scheduling";
import type { Task } from "./data";

/**
 * Export the schedule as an .ods spreadsheet (OpenDocument Spreadsheet).
 * Dependency-free: builds the ZIP package (stored entries + CRC32) by hand.
 *
 * Column order matches the PDF report first:
 *   WBS · Task · Start · Finish · Days · % · Status · Critical
 * then the secondary columns on the right:
 *   Actual start · Actual finish · Baseline start · Baseline finish
 *   · Level · Group · Milestone
 *
 * Dates are normalised to ISO (YYYY-MM-DD) before writing — task dates may
 * be stored either as ISO strings or as day-serial numbers (toDay/DAY).
 */

const DAY_MS = 86400000;

/** Accepts an ISO string or a day-serial number; returns ISO or null. */
function toISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const n = typeof v === "number" ? v : Number(v);
  // Day serials are ~45–50k for 2020s dates; reject anything implausible.
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    return new Date(n * DAY_MS).toISOString().slice(0, 10);
  }
  return null;
}

// ── minimal ZIP writer (store method, no compression) ─────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(u8: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time =
    ((d.getHours() & 31) << 11) |
    ((d.getMinutes() & 63) << 5) |
    ((d.getSeconds() >> 1) & 31);
  const date =
    (((d.getFullYear() - 1980) & 127) << 9) |
    (((d.getMonth() + 1) & 15) << 5) |
    (d.getDate() & 31);
  return { time, date };
}

/**
 * TS 5.7+ made Uint8Array generic over its backing buffer, and BlobPart
 * only accepts ArrayBufferView<ArrayBuffer> — not the wider ArrayBufferLike
 * (which includes SharedArrayBuffer). Every Uint8Array we build here is
 * backed by a plain ArrayBuffer, so this helper pins the type. It also
 * copies into a fresh ArrayBuffer via .slice(), which keeps the value safe
 * even if a caller ever passes a view into a larger shared buffer.
 */
const asBlobPart = (u8: Uint8Array): BlobPart =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const te = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const f of files) {
    const nameBytes = te.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 filename
    local.setUint16(8, 0, true); // store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);

    parts.push(new Uint8Array(local.buffer), nameBytes, f.data);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + size;
  }

  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);

  return new Blob(
    [
      ...parts.map(asBlobPart),
      ...central.map(asBlobPart),
      asBlobPart(new Uint8Array(eocd.buffer)),
    ],
    { type: "application/vnd.oasis.opendocument.spreadsheet" }
  );
}

// ── ODS cell / document builders ──────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const sCell = (v: string) =>
  `<table:table-cell office:value-type="string"><text:p>${esc(v)}</text:p></table:table-cell>`;
const nCell = (v: number) =>
  `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`;
const bCell = (v: boolean) =>
  `<table:table-cell office:value-type="boolean" office:boolean-value="${v}"><text:p>${v ? "TRUE" : "FALSE"}</text:p></table:table-cell>`;
const dCell = (iso: string) =>
  `<table:table-cell office:value-type="date" office:date-value="${iso}"><text:p>${iso}</text:p></table:table-cell>`;
/** Writes a date cell if the value converts to ISO, otherwise an empty cell. */
const dateCell = (v: unknown) => {
  const iso = toISO(v);
  return iso ? dCell(iso) : `<table:table-cell/>`;
};
const emptyCell = `<table:table-cell/>`;

const ODS_NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  "office:version=1.2",
].join(" ")
  .replace('office:version=1.2', 'office:version="1.2"');

function statusOf(task: Task, criticalIds: Set<string>): string {
  if (criticalIds.has(task.id)) return "Critical";
  if (task.completion >= 100 || task.actualFinish) return "Complete";
  if (task.completion > 0 || task.actualStart) return "In progress";
  return "Not started";
}

function buildContentXml(
  rows: Row[],
  criticalIds: Set<string>,
  name: string
): string {
  // 1) PDF-style columns first …
  const header = [
    "WBS", "Task", "Start", "Finish", "Days", "%", "Status", "Critical",
    // 2) … secondary data pushed to the right
    "Actual start", "Actual finish", "Baseline start", "Baseline finish",
    "Level", "Group", "Milestone",
  ].map(sCell).join("");

  const body = rows
    .map(({ task, wbs, depth, hasChildren }) => {
      const cells = [
        sCell(wbs),
        sCell(task.name),
        dateCell(task.scheduleStart),
        dateCell(task.scheduleFinish),
        nCell(durationDays(task)),
        nCell(task.completion),
        sCell(statusOf(task, criticalIds)),
        bCell(criticalIds.has(task.id)),
        task.actualStart ? dateCell(task.actualStart) : emptyCell,
        task.actualFinish ? dateCell(task.actualFinish) : emptyCell,
        task.baselineStart ? dateCell(task.baselineStart) : emptyCell,
        task.baselineFinish ? dateCell(task.baselineFinish) : emptyCell,
        nCell(depth),
        bCell(hasChildren),
        bCell(!!task.isMilestone),
      ];
      return `<table:table-row>${cells.join("")}</table:table-row>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${ODS_NS}>
 <office:automatic-styles>
  <style:style style:name="ceHeader" style:family="table-cell">
   <style:text-properties fo:font-weight="bold"/>
  </style:style>
 </office:automatic-styles>
 <office:body>
  <office:spreadsheet>
   <table:table table:name="${esc(name)}">
    <table:table-row table:style-name="ceHeader">${header}</table:table-row>
    ${body}
   </table:table>
  </office:spreadsheet>
 </office:body>
</office:document-content>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${ODS_NS}>
 <office:styles>
  <style:default-style style:family="table-cell">
   <style:text-properties style:font-name="Calibri" fo:font-size="10pt"/>
  </style:default-style>
 </office:styles>
</office:document-styles>`;

const META_XML = (title: string) => `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${ODS_NS}>
 <office:meta>
  <meta:generator>Schedule export</meta:generator>
  <dc:title>${esc(title)}</dc:title>
 </office:meta>
</office:document-meta>`;

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
 <manifest:file-entry manifest:full-path="mimetype" manifest:media-type="text/plain"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

// ── component ─────────────────────────────────────────────────────────────

export default function ScheduleExportODS({
  rows,
  criticalIds,
  name = "schedule",
}: {
  rows: Row[];
  criticalIds: Set<string>;
  name?: string;
}) {
  const handleExport = () => {
    const te = new TextEncoder();
    const sheet = (name || "Schedule").slice(0, 31);
    const blob = buildZip([
      // mimetype MUST be first and uncompressed
      { name: "mimetype", data: te.encode("application/vnd.oasis.opendocument.spreadsheet") },
      { name: "content.xml", data: te.encode(buildContentXml(rows, criticalIds, sheet)) },
      { name: "styles.xml", data: te.encode(STYLES_XML) },
      { name: "meta.xml", data: te.encode(META_XML(sheet)) },
      { name: "META-INF/manifest.xml", data: te.encode(MANIFEST_XML) },
    ]);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.replace(/[^\w\- ]+/g, "_").trim() || "schedule"}.ods`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
      title="Download as OpenDocument spreadsheet (.ods) — opens in LibreOffice, Excel, Google Sheets"
      data-print-hide
    >
      <svg
        className="h-4 w-4 text-gray-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5.6a1.5 1.5 0 0 1 1.06.44l3.4 3.4a1.5 1.5 0 0 1 .44 1.06v9.1a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-13Zm1.5-.5v13h9V6.6L11 3H5.5ZM7 9h6v1.2H7V9Zm0 3h6v1.2H7V12Zm0-6h3v1.2H7V6Z" />
      </svg>
      ODS
    </button>
  );
}