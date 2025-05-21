import { useState, useMemo } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  addDays
} from "date-fns";

export const useCalendarDays = (worklogs: { start_time: string }[]) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { worklogDates, daysWithWorklogsCount } = useMemo(() => {
    const dates = new Set<string>();
    let count = 0;
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    worklogs.forEach((worklog) => {
      const date = parseISO(worklog.start_time);
      const dateStr = format(date, "yyyy-MM-dd");
      dates.add(dateStr);
      
      if (date >= monthStart && date <= monthEnd) {
        count++;
      }
    });
    
    return {
      worklogDates: dates,
      daysWithWorklogsCount: new Set(
        Array.from(dates).filter(dateStr => {
          const date = parseISO(dateStr);
          return date >= monthStart && date <= monthEnd;
        })
      ).size,
      worklogCount: count,
    };
  }, [worklogs, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart);
    const daysFromPrevMonth = startDay;
    const startDate = addDays(monthStart, -daysFromPrevMonth);
    const daysNeeded = 42;
    const daysInMonth = monthEnd.getDate();
    const daysFromNextMonth = daysNeeded - daysFromPrevMonth - daysInMonth;
    const endDate = addDays(monthEnd, daysFromNextMonth);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };
  
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(day);
    }
  };

  return {
    currentMonth,
    calendarDays,
    worklogDates,
    daysWithWorklogsCount,
    selectedDate,
    prevMonth,
    nextMonth,
    handleDateClick,
    setSelectedDate
  };
};