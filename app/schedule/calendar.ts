// app/schedule/calendar.ts
// Pure working-calendar math. No React, no DOM.
// This is the lowest-level module: it defines DAY and imports nothing.

export const DAY = 86400000;

const toDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const toISO = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

export interface CalendarRange {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface HolidayDate {
  id: string;
  name: string;
  date: string;
}

export interface WorkingCalendar {
  weekly: Set<number>;     // 0 = Sun … 6 = Sat
  dates: HolidayDate[];
  ranges: CalendarRange[];
}

export const emptyCalendar = (): WorkingCalendar => ({
  weekly: new Set<number>([0, 6]),
  dates: [],
  ranges: [],
});

export interface SerializedCalendar {
  weekly: number[];
  dates: HolidayDate[];
  ranges: CalendarRange[];
}

export function serialize(c: WorkingCalendar): SerializedCalendar {
  return { weekly: [...c.weekly], dates: c.dates, ranges: c.ranges };
}

export function deserialize(s: SerializedCalendar): WorkingCalendar {
  return {
    weekly: new Set(s.weekly ?? [0, 6]),
    dates: s.dates ?? [],
    ranges: s.ranges ?? [],
  };
}

const dateKeyCache = new Map<number, string>();
function dayKey(day: number): string {
  let v = dateKeyCache.get(day);
  if (!v) {
    v = toISO(day);
    dateKeyCache.set(day, v);
  }
  return v;
}

export function isHoliday(day: number, cal: WorkingCalendar): boolean {
  const wd = new Date(day * DAY).getUTCDay();
  if (cal.weekly.has(wd)) return true;
  const iso = dayKey(day);
  if (cal.dates.some((h) => h.date === iso)) return true;
  for (const r of cal.ranges) {
    const s = toDay(r.start);
    const e = toDay(r.end);
    if (day >= s && day <= e) return true;
  }
  return false;
}

export function isWorkday(day: number, cal: WorkingCalendar): boolean {
  return !isHoliday(day, cal);
}

export function countWorkdays(
  startISO: string,
  finishISO: string,
  cal: WorkingCalendar
): number {
  const s = toDay(startISO);
  const f = toDay(finishISO);
  if (f < s) return 0;
  let n = 0;
  for (let d = s; d <= f; d++) if (isWorkday(d, cal)) n++;
  return n;
}

export function nextWorkday(startISO: string, cal: WorkingCalendar): string {
  let d = toDay(startISO);
  let guard = 0;
  while (!isWorkday(d, cal) && guard++ < 400) d++;
  return toISO(d);
}

export function addWorkdays(
  startISO: string,
  n: number,
  cal: WorkingCalendar
): string {
  if (n <= 0) return startISO;
  let d = toDay(startISO);
  while (!isWorkday(d, cal)) d++;
  let remaining = n - 1;
  while (remaining > 0) {
    d++;
    if (isWorkday(d, cal)) remaining--;
  }
  return toISO(d);
}

export function prevWorkday(startISO: string, cal: WorkingCalendar): string {
  let d = toDay(startISO);
  let guard = 0;
  while (!isWorkday(d, cal) && guard++ < 400) d--;
  return toISO(d);
}