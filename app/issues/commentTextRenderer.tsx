// app/issues/commentTextRenderer.tsx
"use client";

import React from "react";
import { linkifyText } from "./issueCardHelpers";
import { renderCommentText } from "./mentionRender";

/**
 * Renders comment text with both @mention chips and bare-URL links.
 * renderCommentText() splits the raw text into mention-chip elements and
 * plain string segments; we then run linkifyText() over just the plain
 * string segments, so URLs inside a comment still become clickable even
 * when the same comment also contains @mentions.
 */
export function renderCommentContent(text: string | undefined | null): React.ReactNode {
  if (!text) return text;
  return renderCommentText(text).map((node: React.ReactNode, i: number) =>
    typeof node === "string" ? (
      <React.Fragment key={`seg-${i}`}>{linkifyText(node)}</React.Fragment>
    ) : (
      node
    )
  );
}