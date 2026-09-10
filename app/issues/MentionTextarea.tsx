"use client";

import { useEffect, useRef, useState } from "react";
import { getOrganisationMembers, AssigneeOption } from "./issueApi";
import "./mentionTextarea.css";

interface MentionTextareaProps {
  organisationId: number | string;
  value: string;
  onChange: (value: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * A plain <textarea> with @-mention autocomplete. Selecting a member
 * inserts a `@[Display Name](userId)` token — the backend's
 * notifications/services.py `extract_mentioned_user_ids` parses exactly
 * this shape, so keep them in sync if you ever change the format.
 */
export function MentionTextarea({
  organisationId,
  value,
  onChange,
  onPaste,
  placeholder,
  rows = 3,
}: MentionTextareaProps) {
  const [members, setMembers] = useState<AssigneeOption[]>([]);
  const [showList, setShowList] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!organisationId) return;
    getOrganisationMembers(organisationId).then(setMembers);
  }, [organisationId]);

  const filteredMembers = members.filter((m) => {
    const q = query.toLowerCase();
    return (
      m.displayName.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(newValue);

    const textBeforeCursor = newValue.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setQuery(atMatch[1]);
      setShowList(true);
    } else {
      setShowList(false);
      setMentionStart(null);
    }
  };

  const insertMention = (member: AssigneeOption) => {
    if (mentionStart === null || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const token = `@[${member.displayName}](${member.id})`;
    const newValue = value.slice(0, mentionStart) + token + " " + value.slice(cursor);
    onChange(newValue);
    setShowList(false);
    setMentionStart(null);
    setQuery("");

    requestAnimationFrame(() => {
      const pos = mentionStart + token.length + 1;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="mention-textarea-wrapper">
      <textarea
        ref={textareaRef}
        className="field-input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onPaste={onPaste}
      />
      {showList && filteredMembers.length > 0 && (
        <ul className="mention-suggestions">
          {filteredMembers.slice(0, 20).map((m) => (
            <li key={m.id} onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}>
              <span className="mention-suggestion-name">{m.displayName}</span>
              {m.email && <span className="mention-suggestion-email">{m.email}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="file-hint">Type @ to mention a teammate.</span>
    </div>
  );
}

export default MentionTextarea;