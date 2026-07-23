"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  linkify: (text: string) => React.ReactNode;
  wordLimit?: number;
  charLimit?: number;
  className?: string;
}

export function ExpandableText({
  text,
  linkify,
  wordLimit,
  charLimit = 200,
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  let isTruncatable: boolean;
  let truncated: string;

  if (wordLimit) {
    const words = text.split(/\s+/).filter(Boolean);
    isTruncatable = words.length > wordLimit;
    truncated = words.slice(0, wordLimit).join(" ");
  } else {
    isTruncatable = text.length > charLimit;
    truncated = text.slice(0, charLimit);
  }

  const displayText = !isTruncatable || expanded ? text : truncated + "…";

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