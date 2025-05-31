import { useMemo, useState } from "react";
import {
  SortKey,
  SortDirection,
  Worklog,
  Project,
  Deliverable,
} from "@/types/worklogs";

export const useWorklogsSort = (
  initialField: SortKey = "start_time",
  initialDirection: SortDirection = "desc"
) => {
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({ key: initialField, direction: initialDirection });

  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key && prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <span className="ml-1 text-gray-300">↑</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  const sortedWorklogs = useMemo(() => {
    return (
      worklogs: Worklog[],
      projectMap: Map<number, Project>,
      deliverableMap: Map<number, Deliverable>
    ) => {
      const sorted = [...worklogs];
      sorted.sort((a, b) => {
        let aValue: string | number | Date = "";
        let bValue: string | number | Date = "";

        if (sortConfig.key === "project") {
          const aDeliverable = deliverableMap.get(a.deliverable);
          const bDeliverable = deliverableMap.get(b.deliverable);
          aValue = aDeliverable
            ? projectMap.get(aDeliverable.project)?.name || ""
            : "";
          bValue = bDeliverable
            ? projectMap.get(bDeliverable.project)?.name || ""
            : "";
        } else if (sortConfig.key === "deliverable") {
          aValue = deliverableMap.get(a.deliverable)?.name || "";
          bValue = deliverableMap.get(b.deliverable)?.name || "";
        } else {
          // Handle direct properties of Worklog
          if (sortConfig.key === "duration") {
            aValue = a.duration || 0;
            bValue = b.duration || 0;
          } else {
            aValue = new Date(a[sortConfig.key]);
            bValue = new Date(b[sortConfig.key]);
          }
        }

        if (aValue instanceof Date && bValue instanceof Date) {
          return sortConfig.direction === "asc"
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return 0;
      });
      return sorted;
    };
  }, [sortConfig]);

  return { sortedWorklogs, requestSort, getSortIcon, sortConfig };
};
