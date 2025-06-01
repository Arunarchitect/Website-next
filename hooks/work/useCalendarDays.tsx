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
  isSameMonth,
  differenceInMinutes,
  isValid,
  eachDayOfInterval,
} from "date-fns";
import { Worklog, WorklogWithDuration } from "@/types/worklogs";

interface UseCalendarDaysProps {
  worklogs?: Worklog[]; // Array of worklog data
}

interface UseCalendarDaysReturn {
  currentMonth: Date; // Currently displayed month
  calendarDays: Date[]; // All days to display in calendar (including surrounding weeks)
  worklogDates: Set<string>; // Dates that have worklogs (formatted as 'yyyy-MM-dd')
  daysWithWorklogsCount: number; // Number of days with worklogs in current month
  totalHours: number; // Total hours worked in current month
  selectedDate: Date | null; // Currently selected date
  worklogsWithDuration: WorklogWithDuration[]; // Worklogs with calculated duration
  monthlyWorklogs: WorklogWithDuration[]; // Worklogs filtered to current month
  prevMonth: () => void; // Go to previous month
  nextMonth: () => void; // Go to next month
  handleDateClick: (day: Date) => void; // Handle date selection
  handleMonthChange: (month: number) => void; // Handle month change
  handleYearChange: (year: number) => void; // Handle year change
  setSelectedDate: (date: Date | null) => void; // Set selected date directly
}

export const useCalendarDays = ({ 
  worklogs = [], 
}: UseCalendarDaysProps = {}): UseCalendarDaysReturn => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Create a Set of dates that have worklogs (formatted as 'yyyy-MM-dd')
  const worklogDates = useMemo(() => {
    const dates = new Set<string>();
    worklogs.forEach((worklog) => {
      try {
        if (worklog.start_time) {
          const date = parseISO(worklog.start_time);
          if (isValid(date)) {
            dates.add(format(date, "yyyy-MM-dd"));
          }
        }
      } catch (error) {
        console.warn('Invalid worklog date:', worklog, error);
      }
    });
    return dates;
  }, [worklogs]);

  // Process worklogs to include duration calculation with proper null checks
  const worklogsWithDuration = useMemo<WorklogWithDuration[]>(() => {
    return worklogs.map((worklog) => {
      try {
        const start = worklog.start_time ? parseISO(worklog.start_time) : null;
        const end = worklog.end_time ? parseISO(worklog.end_time) : null;
        
        // Only calculate duration if both dates are valid
        let duration = 0;
        if (start && end && isValid(start) && isValid(end)) {
          duration = differenceInMinutes(end, start) / 60;
        }

        return {
          ...worklog,
          startDate: start && isValid(start) ? start : null,
          endDate: end && isValid(end) ? end : null,
          duration,
        };
      } catch (error) {
        console.warn('Invalid worklog format:', worklog, error);
        return {
          ...worklog,
          startDate: null,
          endDate: null,
          duration: 0,
        };
      }
    });
  }, [worklogs]);

  // Filter worklogs to only those in the current month with null checks
  const monthlyWorklogs = useMemo(() => {
    return worklogsWithDuration.filter(worklog => 
      worklog.startDate && isSameMonth(worklog.startDate, currentMonth)
    );
  }, [worklogsWithDuration, currentMonth]);

  // Generate calendar grid with proper typing
  const calendarDays = useMemo(() => {
    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Count days with worklogs in current month with null checks
  const daysWithWorklogsCount = useMemo(() => {
    return Array.from(worklogDates).filter(dateStr => {
      try {
        const date = parseISO(dateStr);
        return isValid(date) && isSameMonth(date, currentMonth);
      } catch {
        return false;
      }
    }).length;
  }, [worklogDates, currentMonth]);

  // Calculate total hours with null checks
  const totalHours = useMemo(() => {
    return monthlyWorklogs.reduce((sum, worklog) => sum + (worklog.duration || 0), 0);
  }, [monthlyWorklogs]);

  // Navigation handlers
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleDateClick = (day: Date) => setSelectedDate(day);
  
  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(month);
    setCurrentMonth(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
  };

  return {
    currentMonth,
    calendarDays,
    worklogDates,
    daysWithWorklogsCount,
    totalHours,
    selectedDate,
    worklogsWithDuration,
    monthlyWorklogs,
    prevMonth,
    nextMonth,
    handleDateClick,
    handleMonthChange,
    handleYearChange,
    setSelectedDate,
  };
};