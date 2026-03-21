"use client";

import { useState } from "react";
import { GLOBAL_CSS, type DateFilter } from "./shared";
import LeftPanel  from "./LeftPanel";
import RightPanel from "./RightPanel";

const INITIAL_FILTER: DateFilter = {
  rangeStart:    "",
  rangeEnd:      "",
  selectedDates: new Set(),
  selectedMonth: null,
  selectedYear:  null,
};

export default function OrgPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>(INITIAL_FILTER);

  return (
    <div className="oa-wrap">
      <style>{GLOBAL_CSS}</style>
      <div className="oa-root">
        <LeftPanel  filter={dateFilter} onChange={setDateFilter} />
        <RightPanel dateFilter={dateFilter} />
      </div>
    </div>
  );
}
