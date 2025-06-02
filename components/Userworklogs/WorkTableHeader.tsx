import { format } from "date-fns";

// Option 2: Change the prop type to string if you want formatted duration
interface WorkTableHeaderProps {
  currentMonth: Date;
  daysWithWorklogsCount?: number;
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