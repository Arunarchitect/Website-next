import { useMemo, useState } from "react";
import { SortableField, SortDirection, Worklog } from "@/types/worklogs";

export const useWorklogsSort = (initialField: SortableField = "start_time", initialDirection: SortDirection = "desc") => {
  const [sortConfig, setSortConfig] = useState<{
    key: SortableField;
    direction: SortDirection;
  }>({ key: initialField, direction: initialDirection });

  const requestSort = (key: SortableField) => {
    setSortConfig((prev) => {
      if (prev?.key === key && prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: SortableField) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="ml-1 text-gray-300">↑</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  const sortedWorklogs = useMemo(() => {
    return (worklogs: Worklog[], projectMap: Map<number, Project>, deliverableMap: Map<number, Deliverable>) => {
      const sorted = [...worklogs];
      if (sortConfig) {
        sorted.sort((a, b) => {
          let aValue: string | number = "";
          let bValue: string | number = "";

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
            aValue = new Date(a[sortConfig.key]).getTime();
            bValue = new Date(b[sortConfig.key]).getTime();
          }

          if (typeof aValue === "string" && typeof bValue === "string") {
            return sortConfig.direction === "asc"
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }
          return sortConfig.direction === "asc"
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        });
      }
      return sorted;
    };
  }, [sortConfig]);

  return { sortedWorklogs, requestSort, getSortIcon, sortConfig };
};