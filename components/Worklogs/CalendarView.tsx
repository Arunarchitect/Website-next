// CalendarView.tsx
import {
  format,
  isSameMonth,
  isSameDay,
  getYear,
  getMonth,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CalendarViewProps {
  currentMonth: Date;
  calendarDays: Date[];
  worklogDates: Set<string>;
  selectedDate: Date | null;
  prevMonth: () => void;
  nextMonth: () => void;
  handleDateClick: (day: Date) => void;
  handleMonthChange: (month: number) => void;
  handleYearChange: (year: number) => void;
  showOnlyCurrentMonth?: boolean; // Add this prop
}

export const CalendarView = ({
  currentMonth,
  calendarDays,
  worklogDates,
  selectedDate,
  prevMonth,
  nextMonth,
  handleDateClick,
  handleMonthChange,
  handleYearChange,
  showOnlyCurrentMonth = false, // Default to false
}: CalendarViewProps) => {
  const months = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: endOfYear(new Date()),
  }).map((month) => ({
    value: getMonth(month),
    label: format(month, "MMMM"),
  }));

  const currentYear = getYear(currentMonth);
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  // Filter days to show only current month if showOnlyCurrentMonth is true
  const displayedDays = showOnlyCurrentMonth
    ? calendarDays.filter(day => isSameMonth(day, currentMonth))
    : calendarDays;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          <select
            value={getMonth(currentMonth)}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="p-1 border rounded"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="p-1 border rounded"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {displayedDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasWorklog = worklogDates.has(dateStr);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(day)}
              className={`h-10 flex items-center justify-center rounded-full text-sm
                ${isCurrentMonth ? "text-gray-900" : "text-gray-400"}
                ${hasWorklog ? "bg-blue-100 font-medium" : ""}
                ${isSameDay(day, new Date()) ? "border border-blue-500" : ""}
                ${isSelected ? "bg-blue-200 ring-2 ring-blue-400" : ""}
                ${isCurrentMonth ? "hover:bg-gray-100" : "hover:bg-gray-50"}
                transition-colors
              `}
              aria-label={`Day ${format(day, "d MMMM yyyy")}`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};