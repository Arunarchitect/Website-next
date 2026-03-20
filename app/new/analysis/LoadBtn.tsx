// analysis/LoadBtn.tsx

import React from "react";
import { ACCENT, BG, TEXT2 } from "./tokens";

export function LoadBtn({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: loading ? BG : ACCENT, color: loading ? TEXT2 : "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s", opacity: loading ? 0.7 : 1 }}
    >
      {loading && (
        <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff3", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
      )}
      {label}
    </button>
  );
}
