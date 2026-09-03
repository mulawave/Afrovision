"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  archiveNotificationApi,
  bulkNotificationActionApi,
  clearArchivedNotificationsApi,
  deleteNotificationApi,
  getNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  markNotificationUnreadApi,
  type NotificationItem,
  unarchiveNotificationApi,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type Scope = "inbox" | "archived";
type BulkAction = "read" | "unread" | "archive" | "unarchive" | "delete";

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveHref(item: NotificationItem) {
  if (item.link && item.link.startsWith("/")) return item.link;
  return "/notifications";
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [scope, setScope] = useState<Scope>("inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getNotificationsApi({ scope, unreadOnly, limit: 100 });
    if (res.ok && "notifications" in res.data) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
      setSelectedIds((current) =>
        current.filter((id) => res.data.notifications.some((item) => item.id === id))
      );
    } else {
      setError("Failed to load notifications.");
    }
    setLoading(false);
  }, [scope, unreadOnly]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, loadNotifications]);

  const allVisibleSelected = useMemo(
    () => notifications.length > 0 && notifications.every((item) => selectedIds.includes(item.id)),
    [notifications, selectedIds]
  );

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(notifications.map((item) => item.id));
  }

  async function handleSingleAction(id: string, action: Exclude<BulkAction, "delete"> | "delete") {
    const actionKey = `${id}:${action}`;
    setBusyAction(actionKey);
    setBusy(true);
    let res;
    if (action === "read") res = await markNotificationReadApi(id);
    if (action === "unread") res = await markNotificationUnreadApi(id);
    if (action === "archive") res = await archiveNotificationApi(id);
    if (action === "unarchive") res = await unarchiveNotificationApi(id);
    if (action === "delete") res = await deleteNotificationApi(id);
    if (res?.ok && "unread_count" in res.data) {
      window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { unread_count: res.data.unread_count } }));
    }
    await loadNotifications();
    setBusyAction(null);
    setBusy(false);
  }

  async function handleBulkAction(action: BulkAction) {
    if (selectedIds.length === 0) return;
    setBusy(true);
    const res = await bulkNotificationActionApi(selectedIds, action);
    if (!res.ok) {
      setError("Bulk action failed.");
    } else if ("unread_count" in res.data) {
      window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { unread_count: res.data.unread_count } }));
    }
    setSelectedIds([]);
    await loadNotifications();
    setBusy(false);
  }

  async function handleMarkAllRead() {
    setBusy(true);
    const res = await markAllNotificationsReadApi();
    if (!res.ok) {
      setError("Could not mark all notifications as read.");
    } else if ("unread_count" in res.data) {
      window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { unread_count: res.data.unread_count } }));
    }
    await loadNotifications();
    setBusy(false);
  }

  async function handleClearArchived() {
    setBusy(true);
    const res = await clearArchivedNotificationsApi();
    if (!res.ok) {
      setError("Could not clear archived notifications.");
    } else if ("unread_count" in res.data) {
      window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { unread_count: res.data.unread_count } }));
    }
    setSelectedIds([]);
    await loadNotifications();
    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to access your notification inbox.</p>
          <Link href="/login?redirect=/notifications" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Notifications — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Inbox</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Notifications</h1>
            <p className="mt-2 text-sm text-av-light-orange">Unread: {unreadCount}. Review alerts, go-live notices, account updates, and admin messages.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={busy || unreadCount === 0}
              className="rounded-full border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-sm font-semibold text-av-orange disabled:opacity-50"
            >
              {busy ? "Updating…" : "Mark all read"}
            </button>
            {scope === "archived" ? (
              <button
                onClick={handleClearArchived}
                disabled={busy || notifications.length === 0}
                className="rounded-full border border-av-error/30 bg-av-error/5 px-4 py-2 text-sm font-semibold text-av-error disabled:opacity-50"
              >
                {busy ? "Clearing…" : "Clear archived"}
              </button>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["inbox", "archived"] as Scope[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setScope(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${scope === value ? "bg-av-orange text-av-dark-blue" : "border border-av-input-border/30 bg-av-input-fill/40 text-av-light-orange"}`}
                >
                  {value === "inbox" ? "Inbox" : "Archived"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-av-light-orange">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
                className="h-4 w-4 rounded border-av-input-border/30 bg-av-input-fill text-av-orange focus:ring-av-orange"
              />
              Show unread only
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-av-input-border/20 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-sm text-av-light-orange">
              <button onClick={toggleSelectAll} className="font-semibold text-av-light-orange">
                {allVisibleSelected ? "Clear selection" : "Select all visible"}
              </button>
              <span>{selectedIds.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {scope === "inbox" ? (
                <>
                  <BulkButton label="Mark read" busyLabel="Marking…" onClick={() => handleBulkAction("read")} disabled={busy || selectedIds.length === 0} busy={busy} />
                  <BulkButton label="Archive" busyLabel="Archiving…" onClick={() => handleBulkAction("archive")} disabled={busy || selectedIds.length === 0} busy={busy} />
                </>
              ) : (
                <>
                  <BulkButton label="Unarchive" busyLabel="Unarchiving…" onClick={() => handleBulkAction("unarchive")} disabled={busy || selectedIds.length === 0} busy={busy} />
                  <BulkButton label="Mark unread" busyLabel="Marking…" onClick={() => handleBulkAction("unread")} disabled={busy || selectedIds.length === 0} busy={busy} />
                </>
              )}
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={busy || selectedIds.length === 0}
                className="rounded-full border border-av-error/30 bg-av-error/5 px-4 py-2 text-sm font-semibold text-av-error disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete selected"}
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-av-error/30 bg-av-error/5 p-8 text-center text-sm text-av-error">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-av-input-border/20 bg-av-card/60 p-12 text-center">
            <p className="text-sm text-av-light-orange">
              {scope === "archived" ? "No archived notifications." : "Your inbox is clear."}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {notifications.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-5 transition-colors ${item.is_read ? "border-av-input-border/20 bg-av-card/70" : "border-av-orange/20 bg-av-card"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      className="mt-1 h-4 w-4 rounded border-av-input-border/30 bg-av-input-fill text-av-orange focus:ring-av-orange"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.is_read ? "bg-av-hint/40" : "bg-av-orange"}`} />
                        <h2 className="text-lg font-semibold text-av-white">{item.title}</h2>
                        <span className="rounded-full border border-av-input-border/20 bg-av-input-fill/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-av-light-orange">
                          {item.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-av-light-orange">{item.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-av-light-orange">
                        <span>{formatTimestamp(item.created_at)}</span>
                        {item.source ? <span>Source: {item.source.replace(/_/g, " ")}</span> : null}
                        {item.link ? (
                          <Link href={resolveHref(item)} className="font-semibold text-av-light-orange hover:text-av-orange">
                            Open destination →
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    {item.archived ? (
                      <button onClick={() => handleSingleAction(item.id, "unarchive")} disabled={busy} className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange disabled:opacity-50">
                        {busyAction === `${item.id}:unarchive` ? "Unarchiving…" : "Unarchive"}
                      </button>
                    ) : (
                      <button onClick={() => handleSingleAction(item.id, item.is_read ? "unread" : "read")} disabled={busy} className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange disabled:opacity-50">
                        {busyAction === `${item.id}:read` || busyAction === `${item.id}:unread` ? "Updating…" : item.is_read ? "Mark unread" : "Mark read"}
                      </button>
                    )}
                    {!item.archived ? (
                      <button onClick={() => handleSingleAction(item.id, "archive")} disabled={busy} className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1.5 text-xs font-semibold text-av-orange disabled:opacity-50">
                        {busyAction === `${item.id}:archive` ? "Archiving…" : "Archive"}
                      </button>
                    ) : null}
                    <button onClick={() => handleSingleAction(item.id, "delete")} disabled={busy} className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error disabled:opacity-50">
                      {busyAction === `${item.id}:delete` ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
    </>
  );
}

function BulkButton({
  label,
  busyLabel,
  onClick,
  disabled,
  busy,
}: {
  label: string;
  busyLabel: string;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-av-input-border/30 bg-av-input-fill/40 px-4 py-2 text-sm font-semibold text-av-light-orange disabled:opacity-50"
    >
      {busy ? busyLabel : label}
    </button>
  );
}
