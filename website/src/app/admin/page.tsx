"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  broadcastNotificationApi,
  disableAdminChannelApi,
  enableAdminChannelApi,
  getAdminChannelsApi,
  getAdminDashboardApi,
  getAdminUsersApi,
  getAuditLogsApi,
  getFeatureFlagsApi,
  regenerateWaveThumbnailsApi,
  sendUserNotificationApi,
  setFeatureFlagApi,
  updateAdminChannelNumberApi,
  type AdminDashboard,
  type AuditLogItem,
  type Channel,
  type FeatureFlag,
  type StoredUser,
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

function getChannelIdentityLabel(channel: Channel) {
  if (channel.owner_details_visible === false || channel.owner_display_mode === "hide_owner") {
    return "Owner hidden";
  }
  const name = (channel.public_owner_name || channel.owner_brand_name || channel.owner_name || "").trim();
  if (!name) {
    return "Owner hidden";
  }
  return channel.owner_display_mode === "brand_only" ? name : `by ${name}`;
}

export default function AdminPage() {
  const { isAuthenticated, user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeTarget, setNoticeTarget] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeLink, setNoticeLink] = useState("");
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);
  const [channelNumberDrafts, setChannelNumberDrafts] = useState<Record<string, string>>({});
  const [channelNumberSavingId, setChannelNumberSavingId] = useState<string | null>(null);
  const [channelNumberMessage, setChannelNumberMessage] = useState<string | null>(null);
  const [channelSearch, setChannelSearch] = useState("");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbMessage, setThumbMessage] = useState<string | null>(null);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [dashboardRes, usersRes, channelsRes, flagsRes, logsRes] = await Promise.all([
      getAdminDashboardApi(),
      getAdminUsersApi(),
      getAdminChannelsApi(),
      getFeatureFlagsApi(),
      getAuditLogsApi(25),
    ]);

    if (dashboardRes.ok && "dashboard" in dashboardRes.data) {
      setDashboard(dashboardRes.data.dashboard);
    } else {
      setError("Failed to load admin dashboard.");
    }
    if (usersRes.ok && "users" in usersRes.data) setUsers(usersRes.data.users);
    if (channelsRes.ok && "channels" in channelsRes.data) {
      setChannels(channelsRes.data.channels);
      setChannelNumberDrafts(
        Object.fromEntries(channelsRes.data.channels.map((channel) => [channel.id, String(channel.channel_number)]))
      );
    }
    if (flagsRes.ok && "flags" in flagsRes.data) setFlags(flagsRes.data.flags);
    if (logsRes.ok && "logs" in logsRes.data) setLogs(logsRes.data.logs);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutId = window.setTimeout(() => {
      void loadAdmin();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, loadAdmin]);

  async function handleFeatureToggle(flag: FeatureFlag) {
    setBusy(true);
    setError(null);
    const res = await setFeatureFlagApi(flag.key, !flag.enabled);
    if (!res.ok) {
      setError("Could not update feature flag.");
    }
    await loadAdmin();
    setBusy(false);
  }

  async function handleChannelToggle(channel: Channel) {
    setBusy(true);
    setError(null);
    const res = channel.is_active
      ? await disableAdminChannelApi(channel.id)
      : await enableAdminChannelApi(channel.id);
    if (!res.ok) {
      setError("Could not update channel state.");
    }
    await loadAdmin();
    setBusy(false);
  }

  async function handleChannelNumberSave(channel: Channel) {
    const draft = channelNumberDrafts[channel.id]?.trim();
    if (!draft) {
      setError("Channel number is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setChannelNumberSavingId(channel.id);
    setChannelNumberMessage(null);

    const res = await updateAdminChannelNumberApi(channel.id, draft);
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Could not update channel number.");
    } else {
      setChannelNumberMessage(`Channel ${channel.name} moved to #${draft}.`);
      await loadAdmin();
    }

    setChannelNumberSavingId(null);
    setBusy(false);
  }

  async function handleRegenerateThumbnails() {
    setThumbBusy(true);
    setError(null);
    setThumbMessage(null);
    const res = await regenerateWaveThumbnailsApi();
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Could not regenerate thumbnails.");
    } else if ("message" in res.data) {
      setThumbMessage(res.data.message);
    }
    setThumbBusy(false);
  }

  async function handleSendNotice(event: React.FormEvent) {
    event.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      setError("Notification title and body are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setNoticeSuccess(null);

    const res = noticeTarget.trim()
      ? await sendUserNotificationApi({
          userId: noticeTarget.trim(),
          title: noticeTitle.trim(),
          body: noticeBody.trim(),
          link: noticeLink.trim() || undefined,
          type: "admin_alert",
        })
      : await broadcastNotificationApi({
          title: noticeTitle.trim(),
          body: noticeBody.trim(),
          link: noticeLink.trim() || undefined,
          type: "admin_alert",
        });

    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Could not send notification.");
    } else {
      setNoticeSuccess(noticeTarget.trim() ? "Notification sent to user." : "Broadcast sent successfully.");
      setNoticeTitle("");
      setNoticeBody("");
      setNoticeLink("");
      setNoticeTarget("");
    }

    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in with an admin account to access this dashboard.</p>
          <Link href="/login?redirect=/admin" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (user?.role !== "admin") {
    return (
      <main className="min-h-screen px-6 pb-16 pt-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Admin only</p>
          <h1 className="mt-3 text-3xl font-bold text-av-white">This area is restricted</h1>
          <p className="mt-4 text-sm text-av-light-orange">Your account does not have administrator privileges.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Admin — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Administration</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Control Room</h1>
            <p className="mt-2 max-w-2xl text-sm text-av-light-orange">Review platform health, moderate channels, flip operational flags, and send inbox notifications from one admin surface.</p>
          </div>
          <Link href="/notifications" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white">
            Open notification inbox
          </Link>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-av-error/30 bg-av-error/5 p-4 text-sm text-av-error">{error}</div> : null}
        {noticeSuccess ? <div className="mb-6 rounded-2xl border border-av-orange/30 bg-av-orange/10 p-4 text-sm text-av-light-orange">{noticeSuccess}</div> : null}
        {channelNumberMessage ? <div className="mb-6 rounded-2xl border border-av-orange/30 bg-av-orange/10 p-4 text-sm text-av-light-orange">{channelNumberMessage}</div> : null}

        {loading || !dashboard ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Users" value={String(dashboard.users.total)} />
              <StatCard label="Creators" value={String(dashboard.users.creators)} />
              <StatCard label="Premium" value={String(dashboard.users.premium)} />
              <StatCard label="Channels" value={String(dashboard.channels.total)} />
              <StatCard label="Active" value={String(dashboard.channels.active)} />
              <StatCard label="Pending Withdrawals" value={String(dashboard.financial.pending_withdrawals || 0)} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-6">
                <form onSubmit={handleSendNotice} className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <h2 className="text-lg font-semibold text-av-white">Send platform notification</h2>
                  <div className="mt-4 grid gap-4">
                    <input value={noticeTarget} onChange={(event) => setNoticeTarget(event.target.value)} placeholder="Optional user ID for direct message" className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none" />
                    <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Title" className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none" />
                    <textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} rows={4} placeholder="Message body" className="rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none" />
                    <input value={noticeLink} onChange={(event) => setNoticeLink(event.target.value)} placeholder="Optional in-app path, for example /wallet" className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none" />
                    <button type="submit" disabled={busy} className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60">
                      {busy ? "Sending..." : noticeTarget.trim() ? "Send to user" : "Broadcast to all"}
                    </button>
                  </div>
                </form>

                <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-av-white">Feature flags</h2>
                    <span className="text-xs text-av-light-orange">{flags.length} flags</span>
                  </div>
                  {flags.length === 0 ? (
                    <p className="mt-4 text-sm text-av-light-orange">No feature flags stored yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {flags.map((flag) => (
                        <div key={flag.key} className="flex items-center justify-between gap-3 rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
                          <div>
                            <p className="text-sm font-semibold text-av-white">{flag.key}</p>
                            <p className="mt-1 text-xs text-av-light-orange">{flag.enabled ? "Enabled" : "Disabled"}</p>
                          </div>
                          <button onClick={() => handleFeatureToggle(flag)} disabled={busy} className={`rounded-full px-4 py-2 text-xs font-semibold ${flag.enabled ? "border border-av-error/30 bg-av-error/5 text-av-error" : "border border-av-orange/30 bg-av-orange/10 text-av-orange"}`}>
                            {flag.enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <h2 className="text-lg font-semibold text-av-white">Wave thumbnails</h2>
                  <p className="mt-2 text-xs text-av-light-orange">Regenerate missing thumbnails for all active waves. Runs synchronously and may take a while.</p>
                  {thumbMessage && (
                    <div className="mt-3 rounded-xl border border-av-orange/30 bg-av-orange/10 px-3 py-2 text-xs text-av-orange">
                      {thumbMessage}
                    </div>
                  )}
                  <button
                    onClick={handleRegenerateThumbnails}
                    disabled={thumbBusy}
                    className="mt-4 rounded-full border border-av-orange/30 bg-av-orange/10 px-5 py-2.5 text-sm font-semibold text-av-orange disabled:opacity-60"
                  >
                    {thumbBusy ? "Regenerating..." : "Backfill Missing Thumbnails"}
                  </button>
                </div>
              </section>

              <section className="space-y-6">
                <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-av-white">Channel moderation</h2>
                    <span className="text-xs text-av-light-orange">{channels.length} channels</span>
                  </div>
                  <p className="mt-2 text-xs text-av-light-orange">Numbers 1-10, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 are reserved for auto-assignment but can be manually assigned by admin.</p>
                  <div className="mt-4">
                    <input
                      type="text"
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      placeholder="Search by name or channel number..."
                      className="h-10 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    {[...channels]
                      .filter((ch) => {
                        const q = channelSearch.trim().toLowerCase();
                        if (!q) return true;
                        return ch.name.toLowerCase().includes(q) || String(ch.channel_number).includes(q);
                      })
                      .sort((left, right) => Number(left.channel_number) - Number(right.channel_number))
                      .map((channel) => (
                      <div key={channel.id} className="flex flex-col gap-3 rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-av-orange/20 bg-av-orange/10 px-2.5 py-0.5 text-xs font-semibold text-av-orange">#{channel.channel_number}</span>
                            <p className="text-sm font-semibold text-av-white">{channel.name}</p>
                          </div>
                          <p className="mt-1 text-xs text-av-light-orange">{getChannelIdentityLabel(channel)} · {channel.type} · {channel.is_active ? "active" : "disabled"}</p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="number"
                              min={1}
                              value={channelNumberDrafts[channel.id] ?? String(channel.channel_number)}
                              onChange={(event) => setChannelNumberDrafts((prev) => ({ ...prev, [channel.id]: event.target.value }))}
                              className="h-11 w-full max-w-[11rem] rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                              aria-label={`Channel number for ${channel.name}`}
                            />
                            <button
                              onClick={() => handleChannelNumberSave(channel)}
                              disabled={busy || channelNumberSavingId === channel.id || String(channel.channel_number) === (channelNumberDrafts[channel.id] ?? String(channel.channel_number)).trim()}
                              className="rounded-full border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-xs font-semibold text-av-orange disabled:opacity-50"
                            >
                              {channelNumberSavingId === channel.id ? "Saving..." : "Update number"}
                            </button>
                          </div>
                        </div>
                        <button onClick={() => handleChannelToggle(channel)} disabled={busy} className={`rounded-full px-4 py-2 text-xs font-semibold ${channel.is_active ? "border border-av-error/30 bg-av-error/5 text-av-error" : "border border-av-orange/30 bg-av-orange/10 text-av-orange"}`}>
                          {channel.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">Recent users</h2>
                      <span className="text-xs text-av-light-orange">{users.length} total</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {users.slice(0, 8).map((member) => (
                        <div key={member.id} className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
                          <p className="text-sm font-semibold text-av-white">{member.name || member.email}</p>
                          <p className="mt-1 text-xs text-av-light-orange">{member.email} · {member.role}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">Audit trail</h2>
                      <span className="text-xs text-av-light-orange">{logs.length} recent</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {logs.map((log) => (
                        <div key={log.id} className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
                          <p className="text-sm font-semibold text-av-white">{log.action.replace(/_/g, " ")}</p>
                          <p className="mt-1 text-xs text-av-light-orange">Actor: {log.actor_id}</p>
                          <p className="mt-1 text-xs text-av-light-orange">{formatTimestamp(log.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-av-light-orange">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-av-white">{value}</p>
    </div>
  );
}
