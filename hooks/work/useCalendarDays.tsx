import { useState, useMemo } from "react";
import {
  format,
  isSameDay,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
  isSameMonth,
  differenceInMinutes,
  isValid,
} from "date-fns";
import { Worklog, WorklogWithDuration } from "@/types/worklogs";

interface UseCalendarDaysProps {
  worklogs?: Worklog[];
  leaveDays?: Date[];
}

interface UseCalendarDaysReturn {
  currentMonth: Date;
  calendarDays: Date[];
  worklogDates: Set<string>;
  daysWithWorklogsCount: number;
  leaveDaysCount: number;
  totalHours: number;
  selectedDate: Date | null;
  worklogsWithDuration: WorklogWithDuration[];
  prevMonth: () => void;
  nextMonth: () => void;
  handleDateClick: (day: Date) => void;
  handleMonthChange: (month: number) => void;
  handleYearChange: (year: number) => void;
  setSelectedDate: (date: Date | null) => void;
}

export const useCalendarDays = ({ 
  worklogs = [], 
  leaveDays = [] 
}: UseCalendarDaysProps = {}): UseCalendarDaysReturn => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Safely track dates with worklogs
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

  // Process worklogs with duration
  const worklogsWithDuration = useMemo<WorklogWithDuration[]>(() => {
    return worklogs.map((worklog) => {
      try {
        const start = worklog.start_time ? parseISO(worklog.start_time) : null;
        const end = worklog.end_time ? parseISO(worklog.end_time) : null;
        
        return {
          ...worklog,
          startDate: isValid(start) ? start : null,
          endDate: isValid(end) ? end : null,
          duration: isValid(start) && isValid(end) 
            ? differenceInMinutes(end, start) / 60 
            : 0
        };
      } catch (error) {
        console.warn('Invalid worklog format:', worklog, error);
        return {
          ...worklog,
          startDate: null,
          endDate: null,
          duration: 0
        };
      }
    });
  }, [worklogs]);

  // Days with worklogs (current month only)
  const daysWithWorklogsCount = useMemo(() => {
    let count = 0;
    worklogDates.forEach(dateStr => {
      try {
        const date = parseISO(dateStr);
        if (isValid(date) && isSameMonth(date, currentMonth)) {
          count++;
        }
      } catch (error) {
        console.warn('Invalid date in worklogDates:', dateStr, error);
      }
    });
    return count;
  }, [worklogDates, currentMonth]);

  // Leave days count (current month only)
  const leaveDaysCount = useMemo(() => {
    return leaveDays.filter(leaveDate => 
      leaveDate && isSameMonth(leaveDate, currentMonth)
    ).length;
  }, [leaveDays, currentMonth]);

  // Total hours worked (current month only)
  const totalHours = useMemo(() => {
    return worklogsWithDuration
      .filter(worklog => worklog.startDate && isSameMonth(worklog.startDate, currentMonth))
      .reduce((sum, worklog) => sum + (worklog.duration || 0), 0);
  }, [worklogsWithDuration, currentMonth]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: Date[] = [];
    let current = startDate;
    
    while (current <= endDate) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    return days;
  }, [currentMonth]);

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
    leaveDaysCount,
    totalHours,
    selectedDate,
    worklogsWithDuration,
    prevMonth,
    nextMonth,
    handleDateClick,
    handleMonthChange,
    handleYearChange,
    setSelectedDate,
  };
};