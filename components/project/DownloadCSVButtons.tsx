import React from "react";
import { useDownloadDeliverablesCSVQuery, useDownloadWorklogsCSVQuery } from "@/redux/features/csvApiSlice";

const DownloadCSVButtons: React.FC = () => {
  const { data: deliverablesCSVData } = useDownloadDeliverablesCSVQuery();
  const { data: worklogsCSVData } = useDownloadWorklogsCSVQuery();

  const downloadCSV = (data: string, filename: string) => {
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex space-x-4">
      {deliverablesCSVData && (
        <button
          onClick={() => downloadCSV(deliverablesCSVData, "deliverables.csv")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Download Deliverables
        </button>
      )}
      {worklogsCSVData && (
        <button
          onClick={() => downloadCSV(worklogsCSVData, "worklogs.csv")}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Download Worklogs
        </button>
      )}
    </div>
  );
};

export default DownloadCSVButtons;
