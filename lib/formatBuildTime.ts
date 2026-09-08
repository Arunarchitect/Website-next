// lib/formatBuildTime.ts
export function formatBuildTime(iso: string | null, timeZone = 'Asia/Kolkata'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.toLocaleString('en-GB', { day: 'numeric', timeZone });
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone });
  const year = d.toLocaleString('en-GB', { year: '2-digit', timeZone });
  const hour = d.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone });
  return `${day}${month}${year}|${hour}:00hr`;
}