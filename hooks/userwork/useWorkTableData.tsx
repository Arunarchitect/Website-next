import { useMemo } from 'react';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  addDays 
} from 'date-fns';
import { WorkLog, SortKey, SortDirection } from '@/types/worklogs';

export const useWorkTableData = (
  worklogs: WorkLog[],
  selectedOrg: string,
  currentMonth: Date,
  selectedDate: Date | null,
  sortKey: SortKey,
  sortDirection: SortDirection
) => {
  // Organization filtering
  const orgFilteredLogs = useMemo(() => (
    selectedOrg === 'all'
      ? worklogs
      : worklogs.filter((log) => log.organisation === selectedOrg)
  ), [worklogs, selectedOrg]);

  // Calendar data
  const { worklogDates, daysWithWorklogsCount } = useMemo(() => {
    const dates = new Set<string>();
    let count = 0;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    orgFilteredLogs.forEach((worklog) => {
      try {
        const date = parseISO(worklog.start_time);
        const dateStr = format(date, 'yyyy-MM-dd');
        dates.add(dateStr);

        if (date >= monthStart && date <= monthEnd) {
          count += 1;
        }
      } catch (error) {
        console.error('Invalid date format in worklog:', worklog.start_time);
      }
    });

    return {
      worklogDates: dates,
      daysWithWorklogsCount: new Set(
        Array.from(dates).filter((dateStr) => {
          try {
            const date = parseISO(dateStr);
            return date >= monthStart && date <= monthEnd;
          } catch {
            return false;
          }
        })
      ).size,
    };
  }, [orgFilteredLogs, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart);
    const startDate = addDays(monthStart, -startDay);
    const daysNeeded = 42; // 6 weeks
    const daysInMonth = monthEnd.getDate();
    const daysFromNextMonth = daysNeeded - startDay - daysInMonth;
    const endDate = addDays(monthEnd, daysFromNextMonth);

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Date filtering
  const filteredLogs = useMemo(() => {
    if (!selectedDate) {
      return orgFilteredLogs;
    }

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    return orgFilteredLogs.filter((log) => {
      try {
        const logDate = format(parseISO(log.start_time), 'yyyy-MM-dd');
        return logDate === selectedDateStr;
      } catch {
        return false;
      }
    });
  }, [orgFilteredLogs, selectedDate]);

  // Sorting
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Handle null/undefined values
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // Handle string values (including remarks)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle number values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filteredLogs, sortKey, sortDirection]);

  return {
    orgFilteredLogs,
    worklogDates,
    daysWithWorklogsCount,
    calendarDays,
    filteredLogs,
    sortedLogs,
  };
};