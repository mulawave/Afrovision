/* eslint-disable @next/next/no-img-element */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAuth } from "@/lib/AuthContext";
import {
  type Channel,
  type ChannelVideo,
  type LibraryItem,
  type LibraryItemDetail,
  type ScheduleProgram,
  type NowPlaying,
  getChannelApi,
  getNowPlayingApi,
  getChannelVideosApi,
  getChannelScheduleApi,
  getChannelLibraryApi,
  getChannelLibraryItemDetailApi,
  addChannelLibraryFavoriteApi,
  removeChannelLibraryFavoriteApi,
  checkChannelSubApi,
  subscribeToChannelApi,
  cancelChannelSubApi,
  checkChannelAccessApi,
  getExclusiveAccessStatusApi,
  getChannelFollowStatusApi,
  followChannelApi,
  unfollowChannelApi,
  recordChannelViewApi,
  deleteChannelApi,
} from "@/lib/api";
import { addToRecentlyViewed } from "@/components/RecentlyViewedRow";

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatScheduleTime(epoch: number): string {
  return new Date(epoch).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function extractLibraryItemEpoch(itemId: string): number {
  const match = /^li_(\d+)_/.exec(itemId || "");
  if (!match) return 0;
  return Number(match[1] || 0);
}

type Tab = "streams" | "about" | "schedule" | "library";

export function ChannelProfile({ id }: { id: string }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const requireAuth = useRequireAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleProgram[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryDetail, setLibraryDetail] = useState<LibraryItemDetail | null>(null);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [libraryModalLoading, setLibraryModalLoading] = useState(false);
  const [libraryFavoriteItemIds, setLibraryFavoriteItemIds] = useState<Record<string, boolean>>({});
  const [newLibraryItemsCount, setNewLibraryItemsCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subId, setSubId] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [exclusiveGateReason, setExclusiveGateReason] = useState<null | "login" | "kyc" | "entitlement">(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("streams");
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const isExclusive = channel?.type === "exclusive";

  // Fetch channel + now-playing on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const channelRes = await getChannelApi(id);
      if (cancelled) return;

      if (!channelRes.ok || !("channel" in channelRes.data)) {
        setError("Channel not found");
        setLoading(false);
        return;
      }
      setChannel(channelRes.data.channel);

      // Track in Recently Viewed (localStorage)
      addToRecentlyViewed({
        channelId: id,
        channelName: channelRes.data.channel.name,
        logoUrl: channelRes.data.channel.logo_url,
        bannerUrl: channelRes.data.channel.banner_url,
      });

      // Record view for analytics (non-blocking)
      recordChannelViewApi(id).catch(() => {});

      // Check now-playing (non-blocking)
      getNowPlayingApi(id).then((res) => {
        if (cancelled) return;
        if (res.ok && "now_playing" in res.data && res.data.now_playing) {
          setNowPlaying(res.data.now_playing);
        }
      });

      if (channelRes.data.channel.type === "exclusive") {
        const isOwner = !!user && user.id === channelRes.data.channel.owner_id;
        if (!isOwner) {
          if (!isAuthenticated) {
            setHasAccess(false);
            setExclusiveGateReason("login");
            router.replace(`/channel/${id}/exclusive-access`);
            return;
          }

          const statusRes = await getExclusiveAccessStatusApi(id);
          if (cancelled) return;

          if (statusRes.ok && "eligibleByKyc" in statusRes.data) {
            const allowed = statusRes.data.eligibleByKyc && statusRes.data.hasActiveEntitlement;
            setHasAccess(allowed);
            if (!allowed) {
              if (!statusRes.data.eligibleByKyc) {
                setExclusiveGateReason("kyc");
              } else {
                setExclusiveGateReason("entitlement");
              }
              router.replace(`/channel/${id}/exclusive-access`);
              return;
            }
            setExclusiveGateReason(null);
          } else {
            setHasAccess(false);
            setExclusiveGateReason("entitlement");
            router.replace(`/channel/${id}/exclusive-access`);
            return;
          }
        } else {
          setHasAccess(true);
          setExclusiveGateReason(null);
        }
      } else {
        // Check premium access (non-blocking)
        checkChannelAccessApi(id).then((res) => {
          if (cancelled) return;
          if (res.ok && "has_access" in res.data) {
            setHasAccess(res.data.has_access);
          }
        });
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id, isAuthenticated, router, user]);

  // Check subscription status
  useEffect(() => {
    if (!isAuthenticated || !channel) return;
    let cancelled = false;

    checkChannelSubApi(id).then((res) => {
      if (cancelled) return;
      if (res.ok && "subscribed" in res.data) {
        setIsSubscribed(res.data.subscribed);
        setSubId(res.data.subscription?.id ?? null);
      }
    });

    return () => { cancelled = true; };
  }, [id, isAuthenticated, channel]);

  useEffect(() => {
    if (!isAuthenticated || !channel?.id) return;
    let cancelled = false;

    getChannelFollowStatusApi(channel.id).then((res) => {
      if (cancelled || !res.ok || !("followed" in res.data)) return;
      setIsFollowing(res.data.followed);
      setFollowersCount(res.data.followers_count);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, channel?.id]);

  // Lazy-load videos when streams tab is activated
  useEffect(() => {
    if (activeTab !== "streams" || videosLoaded) return;
    let cancelled = false;

    getChannelVideosApi(id).then((res) => {
      if (cancelled) return;
      if (res.ok && "videos" in res.data) {
        setVideos(res.data.videos);
      }
      setVideosLoaded(true);
    });

    return () => { cancelled = true; };
  }, [activeTab, videosLoaded, id]);

  // Lazy-load schedule when schedule tab is activated
  useEffect(() => {
    if (activeTab !== "schedule" || scheduleLoaded) return;
    let cancelled = false;

    getChannelScheduleApi(id).then((res) => {
      if (cancelled) return;
      if (res.ok && "schedule" in res.data) {
        setSchedule(res.data.schedule);
      }
      setScheduleLoaded(true);
    });

    return () => { cancelled = true; };
  }, [activeTab, scheduleLoaded, id]);

  // Lazy-load library when library tab is activated for exclusive channels
  useEffect(() => {
    if (activeTab !== "library" || libraryLoaded || !isExclusive || !hasAccess) return;
    let cancelled = false;

    getChannelLibraryApi(id).then((res) => {
      if (cancelled) return;
      if (res.ok && "data" in res.data) {
        const nextItems = res.data.data.items || [];
        setLibraryItems(nextItems);

        if (typeof window !== "undefined") {
          const key = `afrovision:library:last-seen:${id}`;
          const lastSeenRaw = window.localStorage.getItem(key);
          const lastSeen = Number(lastSeenRaw || 0);
          const newCount = nextItems.filter((item) => {
            const createdAt = extractLibraryItemEpoch(item.id);
            return createdAt > lastSeen;
          }).length;
          setNewLibraryItemsCount(newCount);
        }
      }
      setLibraryLoaded(true);
    });

    return () => { cancelled = true; };
  }, [activeTab, libraryLoaded, isExclusive, hasAccess, id]);

  const acknowledgeLibraryNewItems = useCallback(() => {
    if (typeof window === "undefined") return;
    const key = `afrovision:library:last-seen:${id}`;
    window.localStorage.setItem(key, String(Date.now()));
    setNewLibraryItemsCount(0);
  }, [id]);

  const openLibraryDetail = useCallback(async (itemId: string) => {
    setLibraryModalOpen(true);
    setLibraryModalLoading(true);
    const detailRes = await getChannelLibraryItemDetailApi(id, itemId);
    if (detailRes.ok && "data" in detailRes.data) {
      setLibraryDetail(detailRes.data.data);
    }
    setLibraryModalLoading(false);
  }, [id]);

  const handleLibrarySeeNext = useCallback(async () => {
    const nextItemId = libraryDetail?.navigation?.nextItemId;
    if (!nextItemId) return;
    await openLibraryDetail(nextItemId);
  }, [libraryDetail?.navigation?.nextItemId, openLibraryDetail]);

  const handleLibraryFavoriteToggle = useCallback(async () => {
    const itemId = libraryDetail?.item?.id;
    if (!itemId) return;

    const isFav = !!libraryFavoriteItemIds[itemId];
    const res = isFav
      ? await removeChannelLibraryFavoriteApi(id, itemId)
      : await addChannelLibraryFavoriteApi(id, itemId);

    if (!res.ok) return;

    setLibraryFavoriteItemIds((prev) => ({
      ...prev,
      [itemId]: !isFav,
    }));
  }, [libraryDetail?.item?.id, libraryFavoriteItemIds, id]);

  const handleSubscribe = useCallback(() => {
    requireAuth(async () => {
      if (!channel) return;
      setSubLoading(true);

      if (isSubscribed && subId) {
        const res = await cancelChannelSubApi(subId);
        if (res.ok) {
          setIsSubscribed(false);
          setSubId(null);
        }
      } else {
        const res = await subscribeToChannelApi(id);
        if (res.ok && "subscription" in res.data) {
          setIsSubscribed(true);
          setSubId(res.data.subscription.id);
        }
      }
      setSubLoading(false);
    });
  }, [requireAuth, id, channel, isSubscribed, subId]);

  const handleFollow = useCallback(() => {
    requireAuth(async () => {
      if (!channel?.id) return;
      setFollowLoading(true);
      const res = isFollowing
        ? await unfollowChannelApi(channel.id)
        : await followChannelApi(channel.id);
      if (res.ok && "followed" in res.data) {
        setIsFollowing(res.data.followed);
        setFollowersCount(res.data.followers_count);
      }
      setFollowLoading(false);
    });
  }, [channel, isFollowing, requireAuth]);

  const handleDeleteChannel = useCallback(() => {
    requireAuth(async () => {
      if (!channel) return;
      const confirmed = window.confirm(
        `Delete channel "${channel.name}"? This will disable the channel and remove it from discovery.`,
      );
      if (!confirmed) return;

      setDeleting(true);
      const res = await deleteChannelApi(channel.id);
      setDeleting(false);

      if (res.ok) {
        router.push("/channels");
        return;
      }

      setError("error" in res.data ? res.data.error : "Failed to delete channel.");
    });
  }, [channel, requireAuth, router]);

  const isLive = !!nowPlaying;

  // External stream source derived values (AV-STR-003)
  const isExternalSource = !!channel?.stream_source_mode && channel.stream_source_mode !== "native";
  const extStreamStatus = channel?.stream_status ?? "unknown";
  const isExternalLive = isExternalSource && (extStreamStatus === "live" || extStreamStatus === "valid");
  const ownerDetailsVisible = channel?.owner_details_visible !== false;
  const ownerDisplayMode = channel?.owner_display_mode || "show_owner";
  const publicOwnerName = channel?.public_owner_name || channel?.owner_name || "";
  const ownerIdentityText = ownerDetailsVisible && publicOwnerName
    ? ownerDisplayMode === "brand_only"
      ? publicOwnerName
      : `by ${publicOwnerName}`
    : "";
  const watchLiveLabel = isExternalSource
    ? extStreamStatus === "live" ? "Watch Live" : extStreamStatus === "scheduled" ? "Tune In (Scheduled)" : "Open Channel"
    : "Watch Live";
  const watchTarget = isExclusive && !hasAccess ? `/channel/${id}/exclusive-access` : `/live/${id}`;
  const canManageChannel = !!user && (user.role === "admin" || user.id === channel?.owner_id);

  const TABS: { key: Tab; label: string }[] = [
    { key: "streams", label: "Past Streams" },
    { key: "about", label: "About" },
    { key: "schedule", label: "Schedule" },
    ...(isExclusive ? [{ key: "library" as Tab, label: "Library" }] : []),
  ];

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen pt-16 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </main>
    );
  }

  // Error state
  if (error || !channel) {
    return (
      <main className="min-h-screen pt-16 flex flex-col items-center justify-center gap-4">
        <p className="text-3xl">📺</p>
        <p className="text-sm text-av-light-orange">{error || "Channel not found"}</p>
        <Link href="/" className="text-xs text-av-orange hover:text-av-light-orange transition-colors">
          ← Back to Home
        </Link>
      </main>
    );
  }

  const initials = channel.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen pt-16 pb-16">
      {/* ===== BANNER ===== */}
      <div className="relative h-56 sm:h-64 lg:h-80 overflow-hidden">
        {channel.banner_url ? (
          <img
            src={channel.banner_url}
            alt={`${channel.name} banner`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-av-light-blue/50 via-av-dark-blue to-av-dark-blue" />
        )}
        {/* Decorative overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-av-dark-blue/60" />
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-av-light-blue/15 blur-3xl" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-av-dark-blue to-transparent" />

        {/* LIVE overlay on banner */}
        {isLive && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-3 animate-fade-in-up">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-av-error text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-av-error/30">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE NOW
            </span>
          </div>
        )}
      </div>

      {/* ===== PROFILE HEADER ===== */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 mb-8">
          {/* Avatar */}
          {channel.logo_url ? (
            <img
              src={channel.logo_url}
              alt={channel.name}
              className="w-28 h-28 lg:w-32 lg:h-32 rounded-2xl object-cover shadow-2xl ring-4 ring-av-dark-blue flex-shrink-0"
            />
          ) : (
            <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-2xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-4xl lg:text-5xl font-bold text-av-dark-blue shadow-2xl ring-4 ring-av-dark-blue flex-shrink-0">
              {initials}
            </div>
          )}

          {/* Info + actions */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 w-full">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl lg:text-3xl font-bold text-av-white truncate">
                  {channel.name}
                </h1>
                {channel.is_premium_channel ? (
                  <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-av-orange flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-av-light-orange mt-0.5">
                #{channel.channel_number} · {channel.category}
                {(channel.type === "private" || channel.type === "exclusive") && (
                  <>
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold text-av-orange bg-av-orange/10 border border-av-orange/20">
                      {channel.type === "exclusive" ? "EXCLUSIVE" : "PREMIUM"}
                    </span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold border ${hasAccess ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" : "text-av-light-orange bg-av-input-fill/60 border-av-input-border/30"}`}>
                      {hasAccess ? "ACCESS ACTIVE" : "LOCKED"}
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-av-light-orange mt-1">
                {ownerIdentityText ? `${ownerIdentityText} · Joined ${formatDate(channel.created_at)}` : `Joined ${formatDate(channel.created_at)}`}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {(isLive || isExternalLive || (isExclusive && !hasAccess)) && (
                <button
                  onClick={() => router.push(watchTarget)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-full bg-av-error text-white hover:shadow-xl hover:shadow-av-error/30 hover:scale-105 active:scale-95 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {isExclusive && !hasAccess ? "Unlock Exclusive Access" : watchLiveLabel}
                </button>
              )}
              {channel.owner_id && ownerDetailsVisible && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full transition-all disabled:opacity-60 ${
                    isFollowing
                      ? "bg-av-card border border-av-orange/40 text-av-orange"
                      : "bg-av-input-fill border border-av-input-border/30 text-av-white hover:border-av-orange/40"
                  }`}
                >
                  {followLoading ? "Working..." : isFollowing ? `✓ Following${followersCount ? ` · ${formatNumber(followersCount)}` : ""}` : `Follow${followersCount ? ` · ${formatNumber(followersCount)}` : ""}`}
                </button>
              )}
              <button
                onClick={handleSubscribe}
                disabled={subLoading}
                className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full transition-all disabled:opacity-60 ${
                  isSubscribed
                    ? "bg-av-card border border-av-orange/40 text-av-orange"
                    : "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25"
                }`}
              >
                {subLoading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : isSubscribed ? (
                  "✓ Subscribed"
                ) : (
                  "🔔 Subscribe"
                )}
              </button>
              <button className="w-11 h-11 rounded-full bg-av-card border border-av-input-border/30 flex items-center justify-center text-av-light-orange hover:text-av-white hover:border-av-input-border/50 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ===== LIVE BANNER CTA (if live) ===== */}
        {isLive && nowPlaying && (
          <button
            onClick={() => router.push(watchTarget)}
            className="w-full mb-8 rounded-xl bg-gradient-to-r from-av-error/15 via-av-card to-av-error/10 border border-av-error/30 p-4 flex items-center gap-4 hover:border-av-error/50 transition-all group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-xl bg-av-error/15 border border-av-error/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF4D6A">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-av-error font-bold uppercase tracking-wider mb-0.5">
                🔴 Currently Streaming
              </p>
              <p className="text-sm font-semibold text-av-white truncate">
                {nowPlaying.video_title}
              </p>
            </div>
            <span className="px-4 py-2 rounded-full bg-av-error text-xs font-bold text-white group-hover:shadow-lg group-hover:shadow-av-error/30 transition-all flex-shrink-0">
              {isExclusive && !hasAccess ? "Unlock →" : "Join →"}
            </span>
          </button>
        )}

        {isExclusive && !hasAccess && (
          <div className="mb-8 rounded-xl border border-av-orange/30 bg-av-card p-4 text-sm text-av-light-orange">
            <p>
              {exclusiveGateReason === "login" && "Sign in to continue with exclusive access."}
              {exclusiveGateReason === "kyc" && "Adult KYC verification is required before this channel can be opened."}
              {exclusiveGateReason === "entitlement" && "You need an active exclusive entitlement for this channel."}
            </p>
            <button
              onClick={() => router.push(`/channel/${id}/exclusive-access`)}
              className="mt-3 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
            >
              Open Exclusive Access
            </button>
          </div>
        )}

        {/* ===== TABS ===== */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto hide-scrollbar border-b border-av-input-border/20">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all relative ${
                activeTab === tab.key
                  ? "text-av-orange"
                  : "text-av-light-orange hover:text-av-white"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-av-orange rounded-full" />
              )}
            </button>
          ))}
        </div>
              {canManageChannel && (
                <button
                  onClick={handleDeleteChannel}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete Channel"}
                </button>
              )}

        {/* ===== TAB CONTENT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-2">
            {/* Past Streams tab */}
            {activeTab === "streams" && (
              <div className="space-y-3">
                {!videosLoaded ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
                  </div>
                ) : videos.length === 0 ? (
                  <div className="text-center py-16 rounded-xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-sm text-av-light-orange">No past streams yet</p>
                  </div>
                ) : (
                  videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex gap-4 p-4 rounded-xl bg-av-card border border-av-input-border/20 hover:border-av-orange/30 transition-all group"
                    >
                      <div className="w-36 h-20 rounded-lg bg-gradient-to-br from-av-light-blue/30 to-av-dark-blue flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        ) : (
                          <span className="text-3xl group-hover:scale-110 transition-transform">🎬</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-av-white truncate group-hover:text-av-orange transition-colors">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-av-light-orange">
                            ⏱ {formatDuration(video.duration)}
                          </span>
                          <span className="text-[11px] text-av-light-orange">
                            {formatDate(video.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* About tab */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-av-card border border-av-input-border/20 p-6">
                  <h3 className="text-sm font-semibold text-av-white mb-3">About {channel.name}</h3>
                  <p className="text-sm text-av-light-orange leading-relaxed">
                    {channel.description || "No description provided."}
                  </p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-av-input-border/15">
                    <span className="text-xs text-av-light-orange">
                      📅 Joined {formatDate(channel.created_at)}
                    </span>
                    <span className="text-xs text-av-light-orange">📍 {channel.category}</span>
                    <span className="text-xs text-av-light-orange">
                      📺 Channel #{channel.channel_number}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule tab */}
            {activeTab === "schedule" && (
              <div className="space-y-3">
                {!scheduleLoaded ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
                  </div>
                ) : schedule.length === 0 ? (
                  <div className="text-center py-16 rounded-xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-3xl mb-2">📅</p>
                    <p className="text-sm text-av-light-orange">No upcoming programs scheduled</p>
                  </div>
                ) : (
                  schedule.map((prog) => (
                    <div
                      key={prog.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-av-card border border-av-input-border/20"
                    >
                      <div className="w-12 h-12 rounded-xl bg-av-orange/10 border border-av-orange/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {prog.video_thumbnail ? (
                          <img
                            src={prog.video_thumbnail}
                            alt={prog.video_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">📅</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-av-white truncate">
                          {prog.video_title}
                        </h4>
                        <p className="text-xs text-av-light-orange mt-0.5">
                          {formatScheduleTime(prog.start_time)} · {formatDuration(prog.video_duration)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Library tab (exclusive channels only) */}
            {activeTab === "library" && isExclusive && (
              <div className="space-y-4">
                {newLibraryItemsCount > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-av-orange/30 bg-av-card p-3">
                    <p className="text-xs text-av-light-orange">
                      {newLibraryItemsCount} new library item{newLibraryItemsCount > 1 ? "s" : ""} since your last visit.
                    </p>
                    <button
                      type="button"
                      onClick={acknowledgeLibraryNewItems}
                      className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-3 py-1.5 text-xs font-semibold text-av-dark-blue"
                    >
                      Mark viewed
                    </button>
                  </div>
                ) : null}

                {!hasAccess ? (
                  <div className="text-center py-16 rounded-xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-3xl mb-2">🔒</p>
                    <p className="text-sm text-av-light-orange">Unlock exclusive access to view this library</p>
                    <button
                      onClick={() => router.push(`/channel/${id}/exclusive-access`)}
                      className="mt-4 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
                    >
                      Open Exclusive Access
                    </button>
                  </div>
                ) : !libraryLoaded ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="rounded-xl bg-av-card border border-av-input-border/20 p-3 animate-pulse">
                        <div className="h-40 rounded-lg bg-av-input-fill/60" />
                        <div className="mt-3 h-4 w-3/4 rounded bg-av-input-fill/60" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-av-input-fill/60" />
                      </div>
                    ))}
                  </div>
                ) : libraryItems.length === 0 ? (
                  <div className="text-center py-16 rounded-xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-3xl mb-2">📚</p>
                    <p className="text-sm text-av-light-orange">No library content published yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {libraryItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void openLibraryDetail(item.id)}
                        className="text-left rounded-xl bg-av-card border border-av-input-border/20 hover:border-av-orange/30 transition-all overflow-hidden"
                      >
                        <div className="h-44 bg-gradient-to-br from-av-light-blue/20 to-av-dark-blue/50 overflow-hidden">
                          {item.coverAssetUrl ? (
                            <img
                              src={item.coverAssetUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl">📘</div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-sm font-semibold text-av-white truncate">{item.title}</p>
                          <p className="mt-1 text-xs text-av-light-orange truncate">{item.author}</p>
                          <p className="mt-2 text-[11px] text-av-light-orange/80">
                            {item.totalPages} pages · {item.estimatedReadMinutes} min read
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick description */}
            <div className="rounded-xl bg-av-card border border-av-input-border/20 p-5">
              <h3 className="text-sm font-semibold text-av-white mb-2">About</h3>
              <p className="text-xs text-av-light-orange leading-relaxed line-clamp-3">
                {channel.description || "No description provided."}
              </p>
            </div>

            {/* Channel info */}
            <div className="rounded-xl bg-av-card border border-av-input-border/20 p-5">
              <h3 className="text-sm font-semibold text-av-white mb-3">Channel Info</h3>
              <div className="space-y-2.5 text-xs text-av-light-orange">
                {ownerDisplayMode === "show_owner" && ownerDetailsVisible && (
                  <div className="flex items-center justify-between">
                    <span>Owner</span>
                    <span className="text-av-white font-medium">{publicOwnerName}</span>
                  </div>
                )}
                {ownerDisplayMode === "brand_only" && (
                  <div className="flex items-center justify-between">
                    <span>Brand</span>
                    <span className="text-av-white font-medium">{publicOwnerName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Category</span>
                  <span className="text-av-white font-medium">{channel.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Channel #</span>
                  <span className="text-av-white font-medium">{channel.channel_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Type</span>
                  <span className="text-av-white font-medium capitalize">{channel.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span className="text-av-white font-medium">{formatDate(channel.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Followers</span>
                  <span className="text-av-white font-medium">{formatNumber(followersCount || channel.followers_count || 0)}</span>
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-xl border border-av-input-border/20 hover:border-av-input-border/40 transition-all"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {libraryModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-av-card border border-av-input-border/30 p-6 relative">
            <button
              onClick={() => {
                setLibraryModalOpen(false);
                setLibraryDetail(null);
              }}
              className="absolute top-4 right-4 text-av-light-orange hover:text-av-white"
            >
              ✕
            </button>

            {libraryModalLoading || !libraryDetail ? (
              <div className="py-20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
              </div>
            ) : (
              <div>
                <p className="text-xl font-bold text-av-white">{libraryDetail.item.title}</p>
                <p className="mt-1 text-sm text-av-light-orange">{libraryDetail.item.author}</p>
                <p className="mt-4 text-sm text-av-light-orange leading-relaxed">
                  {libraryDetail.item.description || "No description provided."}
                </p>
                <div className="mt-5 flex items-center gap-2 flex-wrap">
                  {(libraryDetail.item.tags || []).slice(0, 6).map((tag) => (
                    <span key={tag} className="text-[11px] px-2 py-1 rounded-full border border-av-input-border/30 text-av-light-orange">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => router.push(`/channel/${id}/library/${libraryDetail.item.id}`)}
                    className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-3 text-sm font-semibold text-av-dark-blue"
                  >
                    Read Now
                  </button>
                  <button
                    onClick={() => void handleLibraryFavoriteToggle()}
                    className="rounded-xl border border-av-input-border/30 px-4 py-3 text-sm font-semibold text-av-white hover:border-av-orange/35"
                  >
                    {libraryFavoriteItemIds[libraryDetail.item.id] ? "Saved ✓" : "Save to Favorites"}
                  </button>
                  <button
                    disabled={!libraryDetail.navigation.nextItemId}
                    onClick={() => void handleLibrarySeeNext()}
                    className="rounded-xl border border-av-input-border/30 px-4 py-3 text-sm font-semibold text-av-white disabled:opacity-40 hover:border-av-orange/35"
                  >
                    See Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
