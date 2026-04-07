/* eslint-disable @next/next/no-img-element */

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { LivePlayer } from "@/components/LivePlayer";
import { LiveChat } from "@/components/LiveChat";
import { GiftPanel } from "@/components/GiftPanel";
import { Reactions } from "@/components/Reactions";
import { useAuth } from "@/lib/AuthContext";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  type GiftItem,
  type NowPlaying,
  type Channel,
  type ChannelEvent,
  sendGiftApi,
  sendReactionApi,
  getNowPlayingApi,
  getChannelApi,
  checkChannelAccessApi,
  payForAccessApi,
  getFollowStatusApi,
  followCreatorApi,
  unfollowCreatorApi,
  getChannelEventsApi,
  getChannelEventsSinceApi,
} from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";

type RightPanel = "chat" | "gifts";

type AccessState = {
  checked: boolean;
  has_access: boolean;
  entry_fee_type?: string;
  entry_fee_vpt_units?: number;
  entry_fee_ngn?: number;
  access_duration_minutes?: number;
};

export function LiveStream({ id }: { id: string }) {
  const [rightPanel, setRightPanel] = useState<RightPanel>("chat");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [giftOverlay, setGiftOverlay] = useState<string | null>(null);
  const [events, setEvents] = useState<ChannelEvent[]>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const { user, isAuthenticated, refreshUser } = useAuth();
  const requireAuth = useRequireAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [access, setAccess] = useState<AccessState>({ checked: false, has_access: true });
  const [payLoading, setPayLoading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);

  // Use real VPT balance if authenticated, otherwise demo balance
  const walletBalance = isAuthenticated && user ? user.vpt_balance : 0;

  // Fetch channel + now-playing + access check
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [channelRes, npRes, accessRes] = await Promise.all([
        getChannelApi(id),
        getNowPlayingApi(id),
        checkChannelAccessApi(id),
      ]);

      if (cancelled) return;

      if (channelRes.ok && "channel" in channelRes.data) {
        setChannel(channelRes.data.channel);
      }
      if (npRes.ok && "now_playing" in npRes.data && npRes.data.now_playing) {
        setNowPlaying(npRes.data.now_playing);
      }

      // Set access state from backend
      if (accessRes.ok && "has_access" in accessRes.data) {
        setAccess({
          checked: true,
          has_access: accessRes.data.has_access,
          entry_fee_type: accessRes.data.entry_fee_type,
          entry_fee_vpt_units: accessRes.data.entry_fee_vpt_units,
          entry_fee_ngn: accessRes.data.entry_fee_ngn,
          access_duration_minutes: accessRes.data.access_duration_minutes,
        });
      } else {
        setAccess({ checked: true, has_access: true });
      }

      setLoading(false);
    }

    load();
    // Poll now-playing every 60s to detect program changes
    const interval = setInterval(async () => {
      if (cancelled) return;
      const res = await getNowPlayingApi(id);
      if (res.ok && "now_playing" in res.data) {
        setNowPlaying(res.data.now_playing ?? null);
      }
    }, 60000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated || !channel?.owner_id || channel.owner_id === user?.id) return;
    let cancelled = false;

    getFollowStatusApi(channel.owner_id).then((res) => {
      if (cancelled || !res.ok || !("followed" in res.data)) return;
      setIsFollowing(res.data.followed);
      setFollowersCount(res.data.followers_count);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, channel?.owner_id, user?.id]);

  useEffect(() => {
    if (!access.has_access) return;
    let cancelled = false;

    async function loadInitialEvents() {
      const res = await getChannelEventsApi(id);
      if (cancelled || !res.ok || !("events" in res.data)) return;
      const initialEvents = res.data.events;
      setEvents(initialEvents.slice(-8));
      setLastEventAt(initialEvents[initialEvents.length - 1]?.created_at ?? 0);
    }

    loadInitialEvents();

    const interval = setInterval(async () => {
      const res = await getChannelEventsSinceApi(id, lastEventAt);
      if (cancelled || !res.ok || !("events" in res.data) || res.data.events.length === 0) {
        return;
      }
      setEvents((prev) => [...prev, ...res.data.events].slice(-12));
      setLastEventAt(res.data.events[res.data.events.length - 1]?.created_at ?? lastEventAt);
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, access.has_access, lastEventAt]);

  const streamTitle = nowPlaying?.video_title ?? channel?.name ?? `Stream #${id}`;
  const channelName = channel?.name ?? `Channel #${id}`;
  const channelInitials = channel
    ? channel.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CH";

  const handleSendGift = useCallback((gift: GiftItem) => {
    requireAuth(async () => {
      setGiftOverlay(`${gift.icon} ${gift.name}`);
      await sendGiftApi(id, gift.id);
      // Refresh user balance after gift send
      await refreshUser();
      setTimeout(() => setGiftOverlay(null), 2000);
    });
  }, [requireAuth, id, refreshUser]);

  const handleReaction = useCallback((emoji: string) => {
    requireAuth(() => {
      sendReactionApi(id, emoji);
    });
  }, [requireAuth, id]);

  const handlePayForAccess = useCallback(() => {
    requireAuth(async () => {
      setPayLoading(true);
      const res = await payForAccessApi(id);
      if (res.ok && "has_access" in res.data && res.data.has_access) {
        setAccess({ checked: true, has_access: true });
        await refreshUser();
      }
      setPayLoading(false);
    });
  }, [requireAuth, id, refreshUser]);

  const handleFollowToggle = useCallback(() => {
    if (!channel?.owner_id || channel.owner_id === user?.id) return;
    requireAuth(async () => {
      setFollowLoading(true);
      const res = isFollowing
        ? await unfollowCreatorApi(channel.owner_id)
        : await followCreatorApi(channel.owner_id);

      if (res.ok && "followed" in res.data) {
        setIsFollowing(res.data.followed);
        setFollowersCount(res.data.followers_count);
      }
      setFollowLoading(false);
    });
  }, [channel, isFollowing, requireAuth, user?.id]);

  if (loading) {
    return (
      <main className="min-h-screen pt-16 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </main>
    );
  }

  // Paywall: access denied for premium channels
  if (access.checked && !access.has_access) {
    const feeDisplay = access.entry_fee_type === 'vpt'
      ? `${access.entry_fee_vpt_units?.toLocaleString()} VPT`
      : `₦${access.entry_fee_ngn?.toLocaleString()}`;
    const durationDisplay = access.access_duration_minutes
      ? `${Math.round(access.access_duration_minutes / 60)}h`
      : '2h';

    return (
      <main className="min-h-screen pt-16 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-av-dark-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Premium Channel</h2>
          <p className="text-av-hint text-sm mb-1">{channelName}</p>
          <p className="text-av-hint text-sm mb-6">
            This channel requires payment to access. Pay once for {durationDisplay} of streaming.
          </p>
          <div className="bg-av-input-fill rounded-xl border border-av-input-border/30 p-4 mb-6">
            <p className="text-xs text-av-hint uppercase tracking-wider mb-1">Entry Fee</p>
            <p className="text-2xl font-bold text-av-orange">{feeDisplay}</p>
            <p className="text-xs text-av-hint mt-1">{durationDisplay} access</p>
          </div>
          <button
            onClick={handlePayForAccess}
            disabled={payLoading}
            className="w-full py-3 rounded-xl font-semibold text-av-dark-blue bg-gradient-to-r from-av-orange to-av-light-orange hover:brightness-110 transition-all disabled:opacity-50"
          >
            {payLoading ? "Processing..." : `Pay ${feeDisplay} to Watch`}
          </button>
          <Link
            href={`/channel/${id}`}
            className="block mt-4 text-sm text-av-hint hover:text-av-orange transition-colors"
          >
            ← Back to channel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-16 lg:pt-16 pb-4 lg:pb-8">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">

        {/* ===== MAIN GRID: Player + Right Panel ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:gap-5">

          {/* ===== LEFT COLUMN: Player + Stream Info ===== */}
          <div className="min-w-0">
            {/* Video player */}
            <div className="relative">
              <LivePlayer
                channelName={channelName}
                channelLogoUrl={channel?.logo_url ?? undefined}
                title={streamTitle}
                viewers={0}
                isLive={!!nowPlaying}
                streamUrl={nowPlaying?.video_url ? resolveWebsiteMediaUrl(nowPlaying.video_url) : undefined}
                startTime={nowPlaying?.start_time}
                duration={nowPlaying?.duration}
                isLoop={nowPlaying?.is_loop}
              />

              {/* Gift overlay animation */}
              {giftOverlay && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="gift-send-animation text-6xl bg-black/30 backdrop-blur-sm px-8 py-4 rounded-2xl">
                    {giftOverlay}
                  </div>
                </div>
              )}
            </div>

            {/* Stream info bar */}
            <div className="mt-4 rounded-xl bg-av-card border border-av-input-border/20 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Channel avatar + info */}
                <Link
                  href={`/channel/${id}`}
                  className="flex items-center gap-3 group flex-shrink-0"
                >
                  {channel?.logo_url ? (
                    <img
                      src={channel.logo_url}
                      alt={channelName}
                      className="w-12 h-12 rounded-xl object-cover group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-sm font-bold text-av-dark-blue group-hover:scale-110 transition-transform">
                      {channelInitials}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-semibold text-av-white group-hover:text-av-orange transition-colors">
                        {channelName}
                      </h2>
                      <svg className="w-3.5 h-3.5 text-av-orange" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-av-hint">{channel?.category ?? "General"}</p>
                  </div>
                </Link>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-av-white leading-snug">
                    {streamTitle}
                  </h1>
                  <p className="text-xs text-av-white/50 mt-1 line-clamp-2">
                    {channel?.description ?? ""}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading || !channel?.owner_id || channel.owner_id === user?.id}
                    className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-full transition-all ${
                      isFollowing
                        ? "bg-av-card border border-av-orange/40 text-av-orange"
                        : "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25"
                    } disabled:opacity-60`}
                  >
                    {followLoading ? "Working..." : isFollowing ? `✓ Following${followersCount ? ` · ${followersCount}` : ""}` : `🔔 Follow${followersCount ? ` · ${followersCount}` : ""}`}
                  </button>
                  <button className="w-10 h-10 rounded-full bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-hint hover:text-av-white hover:border-av-input-border/50 transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Reactions bar (below player on desktop, above on mobile) */}
            <div className="mt-3">
              <Reactions onReact={handleReaction} />
            </div>

            <div className="mt-4 rounded-xl bg-av-card border border-av-input-border/20 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-av-white">Live Activity</h3>
                <span className="text-[11px] text-av-hint">Updates every 5s</span>
              </div>
              {events.length === 0 ? (
                <p className="text-xs text-av-white/50">No reactions or gifts yet for this session.</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(-5).reverse().map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg bg-av-input-fill/40 px-3 py-2 text-xs">
                      <p className="text-av-white/80 min-w-0 flex-1 truncate">
                        <span className="font-semibold text-av-white">{event.sender_name}</span>{" "}
                        {event.type === "gift"
                          ? `sent ${event.gift_icon || "🎁"} ${event.gift_name || "a gift"}`
                          : `reacted ${event.emoji || "🔥"}`}
                      </p>
                      <span className="text-av-hint flex-shrink-0">
                        {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other live streams */}
            <div className="mt-6 rounded-xl bg-av-card border border-av-input-border/20 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-av-white">More Channels</h3>
                <Link href="/" className="text-[11px] text-av-orange hover:text-av-light-orange transition-colors">
                  Browse All →
                </Link>
              </div>
              <p className="text-xs text-av-white/50">
                Discover more channels on the AfroVision homepage.
              </p>
            </div>
          </div>

          {/* ===== RIGHT COLUMN: Chat + Gifts ===== */}
          <div className="flex flex-col h-[calc(100vh-80px)] lg:sticky lg:top-20">
            {/* Panel switcher tabs */}
            <div className="flex items-center gap-1 mb-2 p-1 rounded-xl bg-av-card border border-av-input-border/20">
              <button
                onClick={() => setRightPanel("chat")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  rightPanel === "chat"
                    ? "bg-av-input-fill text-av-white"
                    : "text-av-hint hover:text-av-white"
                }`}
              >
                💬 Live Chat
              </button>
              <button
                onClick={() => setRightPanel("gifts")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  rightPanel === "gifts"
                    ? "bg-av-input-fill text-av-white"
                    : "text-av-hint hover:text-av-white"
                }`}
              >
                🎁 Gifts
              </button>
            </div>

            {/* Chat panel */}
            <div className={`flex-1 min-h-0 ${rightPanel === "chat" ? "block" : "hidden"}`}>
              <LiveChat channelId={id} />
            </div>

            {/* Gifts panel */}
            <div className={`${rightPanel === "gifts" ? "block" : "hidden"}`}>
              <GiftPanel
                walletBalance={walletBalance}
                onSendGift={handleSendGift}
              />

              {/* Wallet info */}
              <div className="mt-3 rounded-xl bg-av-card border border-av-input-border/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-av-white">Your Wallet</h4>
                  <span className="text-xs font-bold text-av-orange">💎 {walletBalance.toLocaleString()} VPT</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-av-input-fill overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-500"
                    style={{ width: `${Math.min(100, (walletBalance / 5000) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-av-hint">Balance</span>
                  <Link
                    href="/wallet"
                    className="text-[10px] text-av-orange font-medium hover:text-av-light-orange transition-colors"
                  >
                    Top Up →
                  </Link>
                </div>
              </div>

              {/* Gift history / ledger preview — admin only */}
              {user?.role === "admin" && (
              <div className="mt-3 rounded-xl bg-av-card border border-av-input-border/20 p-4">
                <h4 className="text-xs font-semibold text-av-white mb-2">Gift Ledger</h4>
                <p className="text-[10px] text-av-hint leading-relaxed">
                  Every gift is recorded on the AfroVision ledger. Creator receives 50%, 
                  operations 30%, community pool 20%.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { label: "Creator", pct: "50%", color: "text-green-400" },
                    { label: "Operations", pct: "30%", color: "text-av-orange" },
                    { label: "Community", pct: "20%", color: "text-purple-400" },
                  ].map((split) => (
                    <div key={split.label} className="text-center py-2 rounded-lg bg-av-dark-blue/50">
                      <p className={`text-sm font-bold ${split.color}`}>{split.pct}</p>
                      <p className="text-[9px] text-av-hint mt-0.5">{split.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
