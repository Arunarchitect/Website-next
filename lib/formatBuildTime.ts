export function formatBuildTime(iso: string | null, timeZone = 'Asia/Kolkata'): string {
  if (!iso) return '—';
  
  const d = new Date(iso);
  
  // Round to nearest minute
  if (d.getSeconds() >= 30) {
    d.setMinutes(d.getMinutes() + 1);
  }
  d.setSeconds(0);
  d.setMilliseconds(0);
  
  const day = d.toLocaleString('en-GB', { day: 'numeric', timeZone });
  const month = d.toLocaleString('en-GB', { month: 'short', timeZone });
  const year = d.toLocaleString('en-GB', { year: '2-digit', timeZone });
  const hour = d.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone });
  const minute = d.toLocaleString('en-GB', { minute: '2-digit', timeZone });
  
  return `${day}${month}${year}|${hour}:${minute}hr`;
}