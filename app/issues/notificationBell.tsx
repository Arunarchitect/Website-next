// NotificationBell.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AppNotification,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "./notificationApi";
import "./notificationBell.css";

const POLL_INTERVAL_MS = 30000;
const PAGE_SIZE = 20;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Inline SVG — no icon-library dependency, always renders. */
function BellIcon() {
  return (
    <svg
      className="notif-bell-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/** Inline SVG — no icon-library dependency, always renders. */
function XMarkIcon() {
  return (
    <svg
      className="notif-item-delete-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ page_size: PAGE_SIZE, page: 1 });
      setNotifications(data.results);
      setPage(1);
      setHasMore(data.results.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await getNotifications({ page_size: PAGE_SIZE, page: nextPage });
      setNotifications((prev) => [...prev, ...data.results]);
      setPage(nextPage);
      setHasMore(data.results.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationRead(n.id);
      } catch {
        // best-effort — UI already optimistically updated
      }
    }
    setOpen(false);
    router.push(`/issues/${n.issue}`);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      loadNotifications();
      refreshUnreadCount();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await deleteNotification(id);
    } catch {
      loadNotifications();
      refreshUnreadCount();
    }
  };

  /** Deletes every notification currently loaded in the panel (not the user's full history). */
  const handleClearAllInView = async () => {
    if (notifications.length === 0 || clearingAll) return;
    setClearingAll(true);
    const idsToDelete = notifications.map((n) => n.id);
    const unreadRemoved = notifications.filter((n) => !n.is_read).length;

    setNotifications([]);
    setUnreadCount((c) => Math.max(0, c - unreadRemoved));

    try {
      await Promise.all(idsToDelete.map((id) => deleteNotification(id)));
    } catch {
      loadNotifications();
      refreshUnreadCount();
    } finally {
      setClearingAll(false);
    }
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="notif-bell-wrapper" ref={panelRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notifications</span>
            <div className="notif-header-actions">
              {hasUnread && (
                <button type="button" className="notif-mark-all" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="notif-clear-all"
                  onClick={handleClearAllInView}
                  disabled={clearingAll}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="notif-panel-list">
            {loading ? (
              <div className="notif-empty">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              <>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={[
                      "notif-item",
                      n.is_read ? "notif-item-read" : "notif-item-unread",
                      n.is_priority ? "notif-item-priority" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {!n.is_read && <span className="notif-unread-dot" aria-hidden="true" />}
                    <div className="notif-item-body">
                      <p className="notif-item-message">{n.message}</p>
                      <span className="notif-item-time">{timeAgo(n.created)}</span>
                    </div>
                    <button
                      type="button"
                      className="notif-item-delete"
                      onClick={(e) => handleDelete(e, n.id)}
                      aria-label="Delete notification"
                    >
                      <XMarkIcon />
                    </button>
                  </div>
                ))}
                {hasMore && (
                  <button
                    type="button"
                    className="notif-load-more"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;