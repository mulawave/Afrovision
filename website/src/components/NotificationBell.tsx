"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getNotificationUnreadCountApi,
  getNotificationsApi,
  markAllNotificationsReadApi,
  type NotificationItem,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveHref(item: NotificationItem) {
  if (item.link && item.link.startsWith("/")) return item.link;
  return "/notifications";
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function loadUnreadCount() {
      const res = await getNotificationUnreadCountApi();
      if (!cancelled && res.ok && "unread_count" in res.data) {
        setUnreadCount(res.data.unread_count);
      }
    }

    loadUnreadCount();
    const intervalId = window.setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function loadPreview() {
    setLoading(true);
    const res = await getNotificationsApi({ scope: "inbox", limit: 5 });
    if (res.ok && "notifications" in res.data) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    }
    setLoading(false);
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadPreview();
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const res = await markAllNotificationsReadApi();
    if (res.ok && "unread_count" in res.data) {
      setUnreadCount(res.data.unread_count);
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? Date.now(),
        }))
      );
    }
    setMarkingAll(false);
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={handleToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-av-input-border/30 bg-av-card text-av-light-orange transition-colors hover:text-av-white hover:border-av-orange/40"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-av-orange px-1.5 py-0.5 text-[10px] font-bold text-av-dark-blue">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[22rem] overflow-hidden rounded-2xl border border-av-input-border/30 bg-av-card shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-av-input-border/20 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-av-white">Notifications</p>
              <p className="text-[11px] text-av-light-orange">{unreadCount} unread</p>
            </div>
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="text-[11px] font-semibold text-av-orange disabled:opacity-50"
            >
              {markingAll ? "Updating..." : "Mark all read"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-av-light-orange">No notifications yet.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href={resolveHref(item)}
                  onClick={() => setOpen(false)}
                  className="block border-b border-av-input-border/10 px-4 py-3 transition-colors last:border-b-0 hover:bg-av-input-fill/40"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${item.is_read ? "bg-av-hint/40" : "bg-av-orange"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-av-white">{item.title}</p>
                        <span className="shrink-0 text-[10px] text-av-light-orange">{formatTimestamp(item.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-av-light-orange">{item.body}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="border-t border-av-input-border/20 px-4 py-3 text-right">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-sm font-semibold text-av-light-orange hover:text-av-orange">
              Open inbox →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
