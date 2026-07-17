// app/issues/ExpandableText.tsx
"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  linkify: (text: string) => React.ReactNode;
  wordLimit?: number;
  className?: string;
}

export function ExpandableText({
  text,
  linkify,
  wordLimit = 60,
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  const words = text.split(/\s+/).filter(Boolean);
  const isTruncatable = words.length > wordLimit;

  const displayText =
    !isTruncatable || expanded
      ? text
      : words.slice(0, wordLimit).join(" ") + "…";

  return (
    <div className={className}>
      {linkify(displayText)}
      {isTruncatable && (
        <button
          type="button"
          className="expandable-text-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}