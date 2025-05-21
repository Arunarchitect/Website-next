import { format, isSameMonth, isSameDay } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CalendarViewProps {
  currentMonth: Date;
  calendarDays: Date[];
  worklogDates: Set<string>;
  selectedDate: Date | null;
  prevMonth: () => void;
  nextMonth: () => void;
  handleDateClick: (day: Date) => void;
}

export const CalendarView = ({
  currentMonth,
  calendarDays,
  worklogDates,
  selectedDate,
  prevMonth,
  nextMonth,
  handleDateClick
}: CalendarViewProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-700">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
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
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasWorklog = worklogDates.has(dateStr);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          
          return (
            <button
              key={dateStr}
              onClick={() => isCurrentMonth && handleDateClick(day)}
              className={`h-10 flex items-center justify-center rounded-full text-sm
                ${isCurrentMonth ? "text-gray-900" : "text-gray-400"}
                ${hasWorklog && isCurrentMonth ? "bg-blue-100 font-medium" : ""}
                ${isSameDay(day, new Date()) ? "border border-blue-500" : ""}
                ${isSelected && isCurrentMonth ? "bg-blue-200 ring-2 ring-blue-400" : ""}
                ${isCurrentMonth ? "hover:bg-gray-100" : "cursor-default"}
                transition-colors
              `}
              aria-label={`Day ${format(day, "d")}`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};