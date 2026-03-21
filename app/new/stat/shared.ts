// ─── Shared helpers & CSS ─────────────────────────────────────────────────────

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function fmt(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[parseInt(m) - 1]?.slice(0, 3) ?? ""} ${y}`;
}

/** The date-filter state that LeftPanel owns and passes to RightPanel */
export type DateFilter = {
  rangeStart:    string;      // "YYYY-MM-DD" or ""
  rangeEnd:      string;
  selectedDates: Set<string>; // individual day picks
  selectedMonth: number | null;
  selectedYear:  number | null;
};

/** Apply the shared date filter to any array with a `date` field */
export function applyDateFilter<T extends { date: string }>(
  list: T[],
  f: DateFilter,
): T[] {
  const { rangeStart, rangeEnd, selectedDates, selectedMonth, selectedYear } = f;

  if (rangeStart || rangeEnd) {
    const lo = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeStart : rangeEnd) : rangeStart;
    const hi = rangeStart && rangeEnd ? (rangeStart < rangeEnd ? rangeEnd : rangeStart) : rangeEnd;
    return list.filter(r => (!lo || r.date >= lo) && (!hi || r.date <= hi));
  }

  if (selectedDates.size > 0) return list.filter(r => selectedDates.has(r.date));

  let out = list;
  if (selectedYear  !== null) out = out.filter(r => new Date(r.date).getFullYear() === selectedYear);
  if (selectedMonth !== null) out = out.filter(r => new Date(r.date).getMonth()    === selectedMonth);
  return out;
}

// ─── Global CSS ───────────────────────────────────────────────────────────────

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .oa-wrap {
    --oa-text:         #0f172a;
    --oa-muted:        #64748b;
    --oa-faint:        #94a3b8;
    --oa-surface:      #ffffff;
    --oa-surface2:     #f8fafc;
    --oa-surface3:     #f1f5f9;
    --oa-border:       #e2e8f0;
    --oa-hover:        #f8fafc;
    --oa-accent:       #4f46e5;
    --oa-accent-soft:  #6366f1;
    --oa-accent-bg:    rgba(79,70,229,0.06);
    --oa-accent-border:rgba(79,70,229,0.22);
    --oa-green:        #059669;
    --oa-green-bg:     rgba(5,150,105,0.07);
    --oa-green-border: rgba(5,150,105,0.2);
    --oa-red:          #dc2626;
    --oa-red-bg:       rgba(220,38,38,0.06);
    --oa-red-border:   rgba(220,38,38,0.2);
    --oa-amber:        #d97706;
    --oa-amber-bg:     rgba(217,119,6,0.07);
    --oa-amber-border: rgba(217,119,6,0.2);
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    .oa-wrap {
      --oa-text:         #f1f5f9;
      --oa-muted:        #94a3b8;
      --oa-faint:        #64748b;
      --oa-surface:      rgba(255,255,255,0.04);
      --oa-surface2:     rgba(255,255,255,0.06);
      --oa-surface3:     rgba(255,255,255,0.09);
      --oa-border:       rgba(255,255,255,0.1);
      --oa-hover:        rgba(255,255,255,0.05);
      --oa-accent:       #818cf8;
      --oa-accent-soft:  #a5b4fc;
      --oa-accent-bg:    rgba(129,140,248,0.12);
      --oa-accent-border:rgba(129,140,248,0.3);
      --oa-green:        #34d399;
      --oa-green-bg:     rgba(52,211,153,0.1);
      --oa-green-border: rgba(52,211,153,0.25);
      --oa-red:          #f87171;
      --oa-red-bg:       rgba(248,113,113,0.1);
      --oa-red-border:   rgba(248,113,113,0.25);
      --oa-amber:        #fbbf24;
      --oa-amber-bg:     rgba(251,191,36,0.1);
      --oa-amber-border: rgba(251,191,36,0.25);
    }
  }

  .oa-wrap * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Layout */
  .oa-root {
    display: grid;
    grid-template-columns: 310px 1fr;
    gap: 24px;
    align-items: start;
    padding: 36px 32px 60px;
    min-height: 100vh;
    background: var(--oa-surface2);
  }
  @media (max-width: 900px) {
    .oa-root { grid-template-columns: 1fr; padding: 20px 16px 48px; }
  }

  /* Panel */
  .oa-panel {
    background: var(--oa-surface);
    border: 1px solid var(--oa-border);
    border-radius: 18px;
    padding: 22px 20px;
  }
  .oa-panel-flush { padding: 0; overflow: hidden; }

  /* Typography */
  .oa-display { font-family: 'DM Serif Display', Georgia, serif; }
  .oa-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--oa-faint);
    margin-bottom: 8px; display: block;
  }
  .oa-section-title {
    font-size: 13px; font-weight: 600;
    color: var(--oa-text); letter-spacing: -0.01em;
  }

  /* Divider */
  .oa-divider { height: 1px; background: var(--oa-border); margin: 18px 0; }

  /* Nav button */
  .oa-nav-btn {
    background: var(--oa-surface2); border: 1px solid var(--oa-border);
    color: var(--oa-text); width: 30px; height: 30px; border-radius: 8px;
    cursor: pointer; font-size: 15px; display: flex; align-items: center;
    justify-content: center; transition: all 0.15s; flex-shrink: 0;
  }
  .oa-nav-btn:hover { background: var(--oa-surface3); }

  /* Pill buttons */
  .oa-pill {
    background: var(--oa-surface2); border: 1px solid var(--oa-border);
    color: var(--oa-muted); font-size: 11px; padding: 5px 0;
    border-radius: 8px; cursor: pointer; transition: all 0.15s; width: 100%;
    font-family: inherit;
  }
  .oa-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-pill.on {
    background: var(--oa-accent-bg); border-color: var(--oa-accent-border);
    color: var(--oa-accent); font-weight: 600;
  }
  .oa-year-pill {
    background: var(--oa-surface2); border: 1px solid var(--oa-border);
    color: var(--oa-muted); font-size: 11px; padding: 5px 12px;
    border-radius: 8px; cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .oa-year-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-year-pill.on {
    background: var(--oa-accent-bg); border-color: var(--oa-accent-border);
    color: var(--oa-accent); font-weight: 600;
  }

  /* Calendar day */
  .oa-cal-day {
    background: transparent; border: 1px solid transparent;
    color: var(--oa-text); font-size: 11px; padding: 6px 0; border-radius: 7px;
    cursor: pointer; text-align: center; transition: all 0.12s; width: 100%;
    opacity: 0.75; font-family: inherit;
  }
  .oa-cal-day:hover { background: var(--oa-surface3); opacity: 1; }
  .oa-cal-day.on {
    background: var(--oa-accent) !important; border-color: var(--oa-accent) !important;
    color: #fff !important; opacity: 1; font-weight: 600;
  }
  .oa-cal-day.in-range {
    background: var(--oa-accent-bg) !important;
    border-color: var(--oa-accent-border) !important; opacity: 1;
  }
  .oa-cal-day.range-start, .oa-cal-day.range-end {
    background: var(--oa-accent) !important; border-color: var(--oa-accent) !important;
    color: #fff !important; opacity: 1; font-weight: 600;
  }

  /* Date input */
  .oa-date-input {
    width: 100%; background: var(--oa-surface2); border: 1px solid var(--oa-border);
    border-radius: 8px; padding: 8px 10px; color: var(--oa-text); font-size: 12px;
    outline: none; transition: border-color 0.2s; cursor: pointer; font-family: inherit;
  }
  .oa-date-input:focus, .oa-date-input:hover { border-color: var(--oa-accent-border); }
  .oa-date-input::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }

  /* Dropdown */
  .oa-dd-trigger {
    width: 100%; display: flex; align-items: center; gap: 8px;
    background: var(--oa-surface2); border: 1px solid var(--oa-border);
    border-radius: 10px; padding: 9px 13px; color: var(--oa-text);
    font-size: 13px; cursor: pointer; transition: border-color 0.2s;
    text-align: left; font-family: inherit;
  }
  .oa-dd-trigger:hover, .oa-dd-trigger.open { border-color: var(--oa-accent-border); }
  .oa-dd-trigger.selected { border-color: var(--oa-accent-border); background: var(--oa-accent-bg); }
  .oa-dd-menu {
    position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 60;
    background: var(--oa-surface); border: 1px solid var(--oa-border);
    border-radius: 10px; overflow: hidden; box-shadow: 0 14px 36px rgba(0,0,0,0.13);
  }
  .oa-dd-input {
    width: 100%; background: transparent; border: none; outline: none;
    color: var(--oa-text); font-size: 13px; font-family: inherit;
  }
  .oa-dd-item {
    width: 100%; display: flex; align-items: center; gap: 8px;
    background: transparent; border: none; color: var(--oa-text);
    font-size: 13px; padding: 10px 13px; cursor: pointer; text-align: left;
    transition: background 0.1s; font-family: inherit;
  }
  .oa-dd-item:hover { background: var(--oa-hover); }
  .oa-dd-item.active { background: var(--oa-accent-bg); color: var(--oa-accent); }
  .oa-dd-clear {
    width: 100%; padding: 9px 13px; font-size: 13px; cursor: pointer;
    color: var(--oa-red); background: transparent; border: none; text-align: left;
    border-bottom: 1px solid var(--oa-border); font-family: inherit;
  }
  .oa-dd-clear:hover { background: var(--oa-red-bg); }

  /* Buttons */
  .oa-btn-primary {
    background: var(--oa-accent); border: none; color: #fff;
    font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 10px;
    cursor: pointer; transition: opacity 0.2s; white-space: nowrap; font-family: inherit;
  }
  .oa-btn-primary:hover { opacity: 0.88; }
  .oa-btn-ghost {
    background: transparent; border: 1px solid var(--oa-border); color: var(--oa-muted);
    font-size: 13px; padding: 10px 15px; border-radius: 10px; cursor: pointer;
    transition: all 0.15s; white-space: nowrap; font-family: inherit;
  }
  .oa-btn-ghost:hover { border-color: var(--oa-accent-border); color: var(--oa-text); }

  /* Filter tag */
  .oa-filter-tag {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border);
    color: var(--oa-accent); font-size: 11px; font-weight: 500;
    border-radius: 20px; padding: 3px 8px 3px 10px; white-space: nowrap;
  }
  .oa-filter-tag button {
    background: none; border: none; color: var(--oa-accent); cursor: pointer;
    font-size: 12px; padding: 0; line-height: 1; opacity: 0.65;
  }
  .oa-filter-tag button:hover { opacity: 1; }

  /* Month grid */
  .oa-month-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 16px;
  }

  /* Tables */
  .oa-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .oa-table th {
    text-align: left; font-size: 10px; font-weight: 700; color: var(--oa-faint);
    letter-spacing: 0.08em; text-transform: uppercase; padding: 0 10px 10px;
    border-bottom: 1px solid var(--oa-border); white-space: nowrap;
  }
  .oa-table td {
    padding: 9px 10px; border-bottom: 1px solid var(--oa-border);
    color: var(--oa-text); vertical-align: middle;
  }
  .oa-table tr:last-child td { border-bottom: none; }
  .oa-table tr:hover td { background: var(--oa-hover); }
  .oa-table-wrap { overflow-x: auto; overflow-y: auto; max-height: 360px; }

  /* Category badge */
  .oa-cat-badge {
    display: inline-flex; align-items: center; gap: 4px;
    border-radius: 20px; padding: 2px 9px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap;
  }

  /* Avatar */
  .oa-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border);
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700; color: var(--oa-accent); flex-shrink: 0;
  }

  /* Sort button */
  .oa-sort-btn {
    background: var(--oa-surface2); border: 1px solid var(--oa-border);
    border-radius: 7px; color: var(--oa-muted); font-size: 11px; padding: 4px 9px;
    cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 3px;
    font-family: inherit;
  }
  .oa-sort-btn:hover { border-color: var(--oa-accent-border); color: var(--oa-text); }
  .oa-sort-btn.active {
    background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent);
  }

  /* Stat card */
  .oa-stat-card {
    border-radius: 14px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .oa-stat-green { background: var(--oa-green-bg); border: 1px solid var(--oa-green-border); }
  .oa-stat-red   { background: var(--oa-red-bg);   border: 1px solid var(--oa-red-border);   }
  .oa-stat-blue  { background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border); }
  .oa-stat-amber { background: var(--oa-amber-bg);  border: 1px solid var(--oa-amber-border);  }

  /* Section headings */
  .oa-section-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--oa-border); gap: 8px; flex-wrap: wrap;
  }

  /* Load-entries collapsed bar */
  .oa-load-bar {
    display: flex; align-items: center; gap: 14px; padding: 14px 18px;
    border: 1px dashed var(--oa-border); border-radius: 12px; cursor: pointer;
    background: var(--oa-surface2); transition: all 0.18s;
    font-family: inherit; width: 100%;
  }
  .oa-load-bar:hover { border-color: var(--oa-accent-border); background: var(--oa-accent-bg); }

  /* Reimbursed badge */
  .oa-badge-yes { color: var(--oa-green); background: var(--oa-green-bg); border: 1px solid var(--oa-green-border); border-radius: 20px; padding: 2px 8px; font-size: 10px; font-weight: 700; }
  .oa-badge-no  { color: var(--oa-amber); background: var(--oa-amber-bg); border: 1px solid var(--oa-amber-border); border-radius: 20px; padding: 2px 8px; font-size: 10px; font-weight: 700; }

  /* Org badge */
  .oa-org-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border);
    border-radius: 20px; padding: 4px 12px 4px 5px; margin-bottom: 10px;
  }
  .oa-org-logo {
    width: 24px; height: 24px; border-radius: 50%; background: var(--oa-accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .oa-org-name { font-size: 12px; font-weight: 700; color: var(--oa-accent); letter-spacing: 0.01em; }

  /* Proj dot */
  .oa-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    margin-right: 5px; flex-shrink: 0; vertical-align: middle;
  }

  /* Empty state */
  .oa-empty {
    padding: 40px 24px; text-align: center;
    background: var(--oa-surface2); border-radius: 12px; border: 1px solid var(--oa-border);
  }

  /* Pagination */
  .oa-pagination {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; border-top: 1px solid var(--oa-border);
  }
`;
