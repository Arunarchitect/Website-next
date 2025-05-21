import { format, isSameMonth, isBefore, isToday } from "date-fns";

interface AttendanceSummaryProps {
  currentMonth: Date;
  daysWithWorklogsCount: number;
  calendarDays: Date[];
}

export const AttendanceSummary = ({
  currentMonth,
  daysWithWorklogsCount,
  calendarDays
}: AttendanceSummaryProps) => {
  const today = new Date();

  const pastOrTodayDaysInMonth = calendarDays.filter(day =>
    isSameMonth(day, currentMonth) &&
    (isBefore(day, today) || isToday(day))
  );

  const leaveDays = pastOrTodayDaysInMonth.length - daysWithWorklogsCount;

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
            <p className="text-sm text-gray-600">Days Leave</p>
          </div>
        </div>
      </div>
    </div>
  );
};
