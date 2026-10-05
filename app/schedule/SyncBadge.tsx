"use client";

interface SyncBadgeProps {
  status:
    | "loading"
    | "saved"
    | "dirty"
    | "saving"
    | "error"
    | "conflict"
    | "readonly"
    | "empty"
    | "failed";
  savedAt?: string | Date | null;
  message?: string | null;
  onRetry?: () => void;
  onReload?: () => void;
}

function formatTime(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SyncBadge({
  status,
  savedAt,
  message,
  onRetry,
  onReload,
}: SyncBadgeProps) {
  const colours: Record<SyncBadgeProps["status"], string> = {
    saved: "bg-green-100 text-green-800 ring-green-200",
    dirty: "bg-amber-100 text-amber-800 ring-amber-200",
    saving: "bg-blue-100 text-blue-800 ring-blue-200",
    error: "bg-red-100 text-red-800 ring-red-200",
    conflict: "bg-red-100 text-red-800 ring-red-200",
    failed: "bg-red-100 text-red-800 ring-red-200",
    loading: "bg-gray-100 text-gray-700 ring-gray-200",
    readonly: "bg-gray-100 text-gray-700 ring-gray-200",
    empty: "bg-gray-100 text-gray-700 ring-gray-200",
  };

  const labels: Record<SyncBadgeProps["status"], string> = {
    saved: "Saved",
    dirty: "Unsaved changes…",
    saving: "Saving…",
    error: "Save failed",
    conflict: "Out of date",
    failed: "Load failed",
    loading: "Loading…",
    readonly: "Read-only",
    empty: "No schedule",
  };

  const time = formatTime(savedAt);
  const showRetry = status === "error" || status === "failed";
  const showReload = status === "conflict";

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${colours[status]}`}
      data-print-hide
      title={message ?? undefined}
    >
      <span>{labels[status]}</span>
      {status === "saved" && time && (
        <span className="text-[10px] opacity-70">· {time}</span>
      )}
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="rounded border border-current px-1.5 py-0.5 text-[10px] hover:bg-white/40"
        >
          Retry
        </button>
      )}
      {showReload && onReload && (
        <button
          onClick={onReload}
          className="rounded border border-current px-1.5 py-0.5 text-[10px] hover:bg-white/40"
        >
          Reload
        </button>
      )}
      {message && (status === "error" || status === "conflict" || status === "failed") && (
        <span
          className="max-w-[240px] truncate text-[10px] opacity-80"
          title={message}
        >
          · {message}
        </span>
      )}
    </div>
  );
}