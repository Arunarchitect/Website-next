import { format} from "date-fns";

interface AttendanceSummaryProps {
  currentMonth: Date;          // The currently displayed month
  daysWithWorklogsCount: number; // Number of days with worklogs in current month
  totalHours?: number;         // Optional total hours worked (defaults to 0)
}

export const AttendanceSummary = ({
  currentMonth,
  daysWithWorklogsCount,
  totalHours = 0 // Default to 0 if not provided
}: AttendanceSummaryProps) => {
  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        {/* Month and year display */}
        <div>
          <h3 className="text-lg font-medium text-gray-700">Monthly Summary</h3>
          <p className="text-sm text-gray-600">
            {format(currentMonth, "MMMM yyyy")}
          </p>
        </div>

        {/* Stats display - only showing days worked and total hours */}
        <div className="flex space-x-4">
          {/* Days Worked */}
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{daysWithWorklogsCount}</p>
            <p className="text-sm text-gray-600">Days Worked</p>
          </div>

          {/* Total Hours */}
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">
              {totalHours.toFixed(1)} {/* Format to 1 decimal place */}
            </p>
            <p className="text-sm text-gray-600">Total Hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};