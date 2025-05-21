import { format } from "date-fns";

interface WorkTableHeaderProps {
  currentMonth: Date;
  daysWithWorklogsCount?: number;
  totalHours: number; // This line is the key change
}

export function WorkTableHeader({
  currentMonth,
  daysWithWorklogsCount = 0
}: WorkTableHeaderProps) {
  const safeCount = Number.isNaN(daysWithWorklogsCount) ? 0 : daysWithWorklogsCount;
  
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">
        {format(currentMonth, "MMMM yyyy")}
      </h2>
      <p className="text-sm text-gray-600">
        {safeCount} day(s) with worklogs
      </p>
    </div>
  );
}