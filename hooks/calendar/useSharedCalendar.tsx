// hooks/useSharedCalendar.tsx
import { useState, useMemo } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  parseISO,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { Worklog } from "@/types/worklogs";
import { Expense } from "@/types/expenses";

interface UseSharedCalendarProps {
  worklogs?: Worklog[];
  expenses?: Expense[];
  initialDate?: Date;
}

export const useSharedCalendar = ({
  worklogs = [],
  expenses = [],
  initialDate = new Date(),
}: UseSharedCalendarProps = {}) => {
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate the month range
  const monthRange = useMemo(() => ({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  }), [currentMonth]);

  // Create Sets of dates that have worklogs or expenses
  const worklogDates = useMemo(() => {
    const dates = new Set<string>();
    worklogs.forEach((worklog) => {
      try {
        if (worklog.start_time) {
          const date = parseISO(worklog.start_time);
          if (!isNaN(date.getTime())) {
            dates.add(format(date, "yyyy-MM-dd"));
          }
        }
      } catch (error) {
        console.warn('Invalid worklog date:', worklog, error);
      }
    });
    return dates;
  }, [worklogs]);

  const expenseDates = useMemo(() => {
    const dates = new Set<string>();
    expenses.forEach((expense) => {
      try {
        if (expense.date) {
          const date = parseISO(expense.date);
          if (!isNaN(date.getTime())) {
            dates.add(format(date, "yyyy-MM-dd"));
          }
        }
      } catch (error) {
        console.warn('Invalid expense date:', expense, error);
      }
    });
    return dates;
  }, [expenses]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Navigation handlers
  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const handleDateClick = (day: Date) => {
    setSelectedDate(prev => prev && isSameDay(day, prev) ? null : day);
  };
  
  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
    setSelectedDate(null);
  };

  return {
    currentMonth,
    monthRange,
    calendarDays,
    worklogDates,
    expenseDates,
    selectedDate,
    setSelectedDate,
    prevMonth,
    nextMonth,
    handleDateClick,
    handleMonthChange,
  };
};