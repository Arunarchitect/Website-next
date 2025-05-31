import { format, isSameMonth, isBefore, isToday, isWeekend } from "date-fns";

interface AttendanceSummaryProps {
  currentMonth: Date;
  daysWithWorklogsCount: number;
  calendarDays: Date[];
  totalHours?: number; // Now properly typed as number
}

export const AttendanceSummary = ({
  currentMonth,
  daysWithWorklogsCount,
  calendarDays,
  totalHours = 0 // Default to 0
}: AttendanceSummaryProps) => {
  const today = new Date();

  const workingDaysInMonth = calendarDays.filter(day => 
    isSameMonth(day, currentMonth) &&
    (isBefore(day, today) || isToday(day)) &&
    !isWeekend(day)
  );

  const leaveDays = Math.max(0, workingDaysInMonth.length - daysWithWorklogsCount);

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-700">Monthly Attendance</h3>
          <p className="text-sm text-gray-600">
            {format(currentMonth, "MMMM yyyy")}
          </p>
        </div>
        <div className="flex space-x-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{daysWithWorklogsCount}</p>
            <p className="text-sm text-gray-600">Days Worked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{leaveDays}</p>
            <p className="text-sm text-gray-600">Leave Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">
              {totalHours.toFixed(1)} {/* Format the number here */}
            </p>
            <p className="text-sm text-gray-600">Total Hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};