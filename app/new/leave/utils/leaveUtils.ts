// app/new/leave/utils/leaveUtils.ts

import { LeaveRequest } from "../api/leaveApi";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LEAVE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending:       { bg: "#FAEEDA", text: "#633806", dot: "#F59E0B" },  // Orange dot
  approved:      { bg: "#EAF3DE", text: "#27500A", dot: "#22C55E" },  // Green dot
  auto_approved: { bg: "#EAF3DE", text: "#27500A", dot: "#22C55E" },  // Green dot
  rejected:      { bg: "#FCEBEB", text: "#791F1F", dot: "#EF4444" },  // Red dot
  cancelled:     { bg: "#F1EFE8", text: "#444441", dot: "#888780" },  // Grey dot
};

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateDisplay(s: string): string {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function getUserDisplayName(user: { full_name?: string; email?: string } | undefined): string {
  if (!user) return "Unknown User";
  if (user.full_name && user.full_name.trim()) return user.full_name;
  if (user.email) return user.email.split('@')[0];
  return "Unknown User";
}

export function getInitials(name: string, email: string): string {
  const displayName = name || email || "U";
  if (!displayName) return "U";
  const parts = displayName.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getAvatarBg(name: string, email: string): string {
  const displayName = name || email || "User";
  const colors = ["#E8D5FF", "#D5E8FF", "#D5FFE8", "#FFE8D5", "#FFD5E8", "#E8FFD5"];
  let h = 0;
  for (let i = 0; i < displayName.length; i++) {
    h = (h * 31 + displayName.charCodeAt(i)) % colors.length;
  }
  return colors[h];
}

export function getAvatarFg(name: string, email: string): string {
  const displayName = name || email || "User";
  const colors = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DB2777", "#65A30D"];
  let h = 0;
  for (let i = 0; i < displayName.length; i++) {
    h = (h * 31 + displayName.charCodeAt(i)) % colors.length;
  }
  return colors[h];
}

export function buildLeaveMap(leaves: LeaveRequest[]) {
  const leaveMap = new Map<string, { leaves: LeaveRequest[]; colors: string[] }>();
  
  console.log('=== BUILD LEAVE MAP DEBUG ===');
  console.log('Total leaves to process:', leaves.length);
  
  leaves.forEach((lr) => {
    console.log(`Processing leave ${lr.id}:`, {
      user: lr.user?.full_name || lr.user?.email,
      status: lr.status,
      start_date: lr.start_date,
      end_date: lr.end_date,
      has_day_breakdown: !!lr.day_breakdown,
      day_breakdown_length: lr.day_breakdown?.length || 0
    });
    
    if (lr.status === "cancelled") {
      console.log(`  → Skipping cancelled leave ${lr.id}`);
      return;
    }
    
    // Use day_breakdown if available, otherwise generate from date range
    let breakdown = lr.day_breakdown;
    if (!breakdown || breakdown.length === 0) {
      console.log(`  → No day_breakdown for leave ${lr.id}, generating from date range`);
      // Generate breakdown from date range
      const start = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      breakdown = [];
      const current = new Date(start);
      while (current <= end) {
        breakdown.push({
          date: toYMD(current),
          type: "leave",
          holiday_name: null
        });
        current.setDate(current.getDate() + 1);
      }
      console.log(`  → Generated ${breakdown.length} days:`, breakdown.map(d => d.date));
    }
    
    breakdown.forEach((d) => {
      if (d.type === "leave") {
        const existing = leaveMap.get(d.date);
        const statusColor = LEAVE_COLORS[lr.status]?.dot || "#888780";
        
        if (existing) {
          existing.leaves.push(lr);
          if (!existing.colors.includes(statusColor)) {
            existing.colors.push(statusColor);
          }
        } else {
          leaveMap.set(d.date, {
            leaves: [lr],
            colors: [statusColor],
          });
        }
        console.log(`  → Added to map for date ${d.date}, color: ${statusColor}`);
      }
    });
  });
  
  console.log('Final leaveMap entries:', Array.from(leaveMap.entries()).map(([date, data]) => ({
    date,
    leaveCount: data.leaves.length,
    colors: data.colors
  })));
  
  return leaveMap;
}