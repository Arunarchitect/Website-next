// components/common/SharedCalendar.tsx
"use client";

import { useState } from "react";
import {
  format,
  isSameMonth,
  isSameDay,
  getYear,
  getMonth,
  eachMonthOfInterval,
  startOfYear,
  endOfYear,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface SharedCalendarProps {
  currentDate: Date;
  worklogDates: Set<string>;
  expenseDates: Set<string>;
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
  onMonthChange: (date: Date) => void;
  showOnlyCurrentMonth?: boolean;
}

export const SharedCalendar = ({
  currentDate,
  worklogDates,
  expenseDates,
  selectedDate,
  onDateChange,
  onMonthChange,
  showOnlyCurrentMonth = false,
}: SharedCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(currentDate);

  const months = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: endOfYear(new Date()),
  }).map((month) => ({
    value: getMonth(month),
    label: format(month, "MMM"),
  }));

  const currentYear = getYear(currentMonth);
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Generate calendar grid
  const calendarDays = (() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = [];
    let day = start;
    
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    
    return days;
  })();

  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange(newMonth);
  };

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange(newMonth);
  };

  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(month);
    setCurrentMonth(newDate);
    onMonthChange(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
    onMonthChange(newDate);
  };

  const handleDateClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      onDateChange(null);
    } else {
      onDateChange(day);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          <select
            value={getMonth(currentMonth)}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="p-1 border rounded text-sm"
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
            className="p-1 border rounded text-sm"
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
        {daysOfWeek.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasWorklog = worklogDates.has(dateStr);
          const hasExpense = expenseDates.has(dateStr);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          if (showOnlyCurrentMonth && !isCurrentMonth) {
            return <div key={dateStr} className="h-10"></div>;
          }

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(day)}
              className={`h-10 flex items-center justify-center rounded-full text-sm relative
                ${isCurrentMonth ? "text-gray-900" : "text-gray-400"}
                ${hasWorklog ? "bg-blue-50 font-medium" : ""}
                ${hasExpense ? "bg-green-50 font-medium" : ""}
                ${hasWorklog && hasExpense ? "bg-purple-50 font-medium" : ""}
                ${isSameDay(day, new Date()) ? "border border-blue-500" : ""}
                ${isSelected ? "bg-blue-100 ring-2 ring-blue-400" : ""}
                ${isCurrentMonth ? "hover:bg-gray-100" : "hover:bg-gray-50"}
                transition-colors
              `}
              aria-label={`Day ${format(day, "d MMMM yyyy")}`}
            >
              {format(day, "d")}
              <div className="absolute bottom-1 flex justify-center space-x-1">
                {hasWorklog && (
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                )}
                {hasExpense && (
                  <span className="w-1 h-1 rounded-full bg-green-500"></span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};