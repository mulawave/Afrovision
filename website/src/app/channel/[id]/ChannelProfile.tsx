/* eslint-disable @next/next/no-img-element */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useAuth } from "@/lib/AuthContext";
import {
  type Channel,
  type ChannelVideo,
  type Wave,
  type LibraryItem,
  type LibraryItemDetail,
  type ScheduleProgram,
  type NowPlaying,
  getChannelApi,
  getNowPlayingApi,
  getChannelVideosApi,
  getChannelWavesApi,
  getChannelScheduleApi,
  getChannelLibraryApi,
  getCreatorChannelLibraryItemsApi,
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
  deleteWaveApi,
  setWaveTimelineVisibilityApi,
  bulkDeleteWavesApi,
  bulkSetWaveTimelineVisibilityApi,
  trackWaveViewApi,
  recordChannelViewApi,
  getNotificationUnreadCountApi,
  markAllNotificationsReadApi,
} from "@/lib/api";
import { addToRecentlyViewed } from "@/components/RecentlyViewedRow";
import { ChannelCreatorPanel } from "./ChannelCreatorPanel";

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

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

type Tab = "streams" | "waves" | "about" | "schedule" | "library" | "manage";

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
  const [libraryDetailError, setLibraryDetailError] = useState<string | null>(null);
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
  const [libraryUnreadCount, setLibraryUnreadCount] = useState(0);
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("streams");
  const [videosLoaded, setVideosLoaded] = useState(false);
  const [channelWaves, setChannelWaves] = useState<Wave[]>([]);
  const [channelWavesLoaded, setChannelWavesLoaded] = useState(false);
  const [channelWavesLoading, setChannelWavesLoading] = useState(false);
  const [selectedWaveIds, setSelectedWaveIds] = useState<string[]>([]);
  const [waveActionMessage, setWaveActionMessage] = useState<string | null>(null);
  const [waveDeleteBusy, setWaveDeleteBusy] = useState<Record<string, boolean>>({});
  const [waveTimelineBusy, setWaveTimelineBusy] = useState<Record<string, boolean>>({});
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [bulkHideBusy, setBulkHideBusy] = useState(false);
  const [bulkUnhideBusy, setBulkUnhideBusy] = useState(false);
  const [waveViewerOpen, setWaveViewerOpen] = useState(false);
  const [activeWaveIndex, setActiveWaveIndex] = useState(0);
  const waveViewerRef = useRef<HTMLVideoElement | null>(null);
  const lastTrackedModalWaveId = useRef<string | null>(null);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const isExclusive = channel?.type === "exclusive";
  const channelId = channel?.id;
  const canManageChannel = !!user && (user.role === "admin" || user.id === channel?.owner_id);

  const loadLibraryUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !channelId || !isExclusive) {
      setLibraryUnreadCount(0);
      return;
    }

    const res = await getNotificationUnreadCountApi({ type: "library", channelId });
    if (res.ok && "unread_count" in res.data) {
      setLibraryUnreadCount(res.data.unread_count);
    }
  }, [channelId, isAuthenticated, isExclusive]);

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

  const loadChannelWaves = useCallback(async () => {
    setChannelWavesLoading(true);
    const res = await getChannelWavesApi(id, { includeHidden: canManageChannel });
    if (res.ok && Array.isArray(res.data)) {
      setChannelWaves(res.data as Wave[]);
    }
    setChannelWavesLoaded(true);
    setChannelWavesLoading(false);
  }, [id, canManageChannel]);

  // Lazy-load waves when waves tab is activated
  useEffect(() => {
    if (activeTab !== "waves" || channelWavesLoaded) return;
    void loadChannelWaves();
  }, [activeTab, channelWavesLoaded, loadChannelWaves]);

  useEffect(() => {
    if (!isAuthenticated || !channelId || !isExclusive) return;

    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      void loadLibraryUnreadCount();
    };

    refresh();

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [channelId, isAuthenticated, isExclusive, loadLibraryUnreadCount]);

  // Lazy-load library when library tab is activated for exclusive channels
  useEffect(() => {
    if (activeTab !== "library" || libraryLoaded || !isExclusive || !hasAccess) return;
    let cancelled = false;

    const isChannelAdmin = !!user && (user.role === "admin" || user.id === channel?.owner_id);

    const applyLibraryItems = (nextItems: LibraryItem[]) => {
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
    };

    const loadLibrary = async () => {
      const res = await getChannelLibraryApi(id);
      if (cancelled) return;
      if (res.ok && "data" in res.data) {
        const nextItems = res.data.data.items || [];
        applyLibraryItems(nextItems);
        setLibraryLoaded(true);
        return;
      }

      if (isChannelAdmin) {
        const creatorRes = await getCreatorChannelLibraryItemsApi(id);
        if (cancelled) return;
        if (creatorRes.ok && "data" in creatorRes.data) {
          const nextItems = (creatorRes.data.data || []).filter((item) => item.status === "published");
          applyLibraryItems(nextItems);
        }
      }

      setLibraryLoaded(true);
    };

    loadLibrary();

    return () => { cancelled = true; };
  }, [activeTab, libraryLoaded, isExclusive, hasAccess, id, user, channel?.owner_id]);

  const acknowledgeLibraryNewItems = useCallback(() => {
    if (typeof window === "undefined") return;
    const key = `afrovision:library:last-seen:${id}`;
    window.localStorage.setItem(key, String(Date.now()));
    setNewLibraryItemsCount(0);
    setLibraryUnreadCount(0);
  }, [id]);

  const handleMarkLibraryViewed = useCallback(async () => {
    if (!channelId) return;

    const res = await markAllNotificationsReadApi({ type: "library", channelId });
    if (res.ok && "unread_count" in res.data) {
      setLibraryUnreadCount(res.data.unread_count);
      acknowledgeLibraryNewItems();
    }
  }, [acknowledgeLibraryNewItems, channelId]);

  const openLibraryDetail = useCallback(async (itemId: string) => {
    setSelectedLibraryItemId(itemId);
    setLibraryModalOpen(true);
    setLibraryModalLoading(true);
    setLibraryDetailError(null);
    setLibraryDetail(null);
    const detailRes = await getChannelLibraryItemDetailApi(id, itemId);
    if (detailRes.ok && "data" in detailRes.data) {
      setLibraryDetail(detailRes.data.data);
    } else {
      const backendMessage =
        (detailRes.data && typeof detailRes.data === "object" && "message" in detailRes.data && typeof detailRes.data.message === "string"
          ? detailRes.data.message
          : null) ||
        (detailRes.data && typeof detailRes.data === "object" && "error" in detailRes.data && typeof detailRes.data.error === "string"
          ? detailRes.data.error
          : null);

      if (detailRes.status === 403) {
        setLibraryDetailError(backendMessage || "You do not have access to open this item.");
      } else if (detailRes.status === 404) {
        setLibraryDetailError(backendMessage || "This library item could not be found.");
      } else if (detailRes.status === 500) {
        setLibraryDetailError(backendMessage || "The library item detail endpoint failed on the server.");
      } else {
        setLibraryDetailError(backendMessage || "Could not load this library item right now. Please try again.");
      }
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
  const setWaveViewerAt = useCallback((nextIndex: number) => {
    const modalWaves = canManageChannel
      ? channelWaves
      : channelWaves.filter((wave) => wave.status === "active");
    if (modalWaves.length === 0) return;
    const wrapped = (nextIndex + modalWaves.length) % modalWaves.length;
    setActiveWaveIndex(wrapped);
  }, [canManageChannel, channelWaves]);

  const handleOpenWaveViewer = useCallback((waveId: string) => {
    const modalWaves = canManageChannel
      ? channelWaves
      : channelWaves.filter((wave) => wave.status === "active");
    const idx = modalWaves.findIndex((w) => w.id === waveId);
    if (idx < 0) return;
    setActiveWaveIndex(idx);
    setWaveViewerOpen(true);
  }, [canManageChannel, channelWaves]);

  const handleToggleWaveSelection = useCallback((waveId: string) => {
    setSelectedWaveIds((prev) => (
      prev.includes(waveId) ? prev.filter((idValue) => idValue !== waveId) : [...prev, waveId]
    ));
  }, []);

  const handleDeleteWave = useCallback(async (waveId: string) => {
    if (!canManageChannel) return;
    const ok = window.confirm("Delete this wave? This cannot be undone.");
    if (!ok) return;

    setWaveDeleteBusy((prev) => ({ ...prev, [waveId]: true }));
    const res = await deleteWaveApi(waveId);
    setWaveDeleteBusy((prev) => ({ ...prev, [waveId]: false }));

    if (!res.ok) {
      setWaveActionMessage("Delete failed. Please retry.");
      return;
    }

    setChannelWaves((prev) => prev.filter((w) => w.id !== waveId));
    setSelectedWaveIds((prev) => prev.filter((idValue) => idValue !== waveId));
    setWaveActionMessage("Wave deleted.");
  }, [canManageChannel]);

  const handleSetWaveHidden = useCallback(async (waveId: string, hidden: boolean) => {
    if (!canManageChannel) return;
    setWaveTimelineBusy((prev) => ({ ...prev, [waveId]: true }));
    const res = await setWaveTimelineVisibilityApi(waveId, hidden);
    setWaveTimelineBusy((prev) => ({ ...prev, [waveId]: false }));

    if (!res.ok) {
      setWaveActionMessage(hidden ? "Hide failed. Please retry." : "Unhide failed. Please retry.");
      return;
    }

    setChannelWaves((prev) => prev.map((wave) => (
      wave.id === waveId ? { ...wave, status: hidden ? "hidden" : "active" } : wave
    )));
    setWaveActionMessage(hidden ? "Wave hidden from timeline." : "Wave restored to timeline.");
  }, [canManageChannel]);

  const handleBulkDelete = useCallback(async () => {
    if (!canManageChannel || selectedWaveIds.length === 0 || bulkDeleteBusy) return;
    const ok = window.confirm(`Delete ${selectedWaveIds.length} selected wave(s)? This cannot be undone.`);
    if (!ok) return;

    setBulkDeleteBusy(true);
    const res = await bulkDeleteWavesApi(selectedWaveIds);
    setBulkDeleteBusy(false);

    if (!res.ok || !("deleted_ids" in res.data)) {
      setWaveActionMessage("Bulk delete failed.");
      return;
    }

    const deletedIds = new Set(res.data.deleted_ids || []);
    setChannelWaves((prev) => prev.filter((w) => !deletedIds.has(w.id)));
    setSelectedWaveIds((prev) => prev.filter((idValue) => !deletedIds.has(idValue)));
    setWaveActionMessage(`Deleted ${res.data.deleted_count} wave(s).`);
  }, [canManageChannel, selectedWaveIds, bulkDeleteBusy]);

  const handleBulkVisibility = useCallback(async (hidden: boolean) => {
    if (!canManageChannel || selectedWaveIds.length === 0) return;
    if (hidden ? bulkHideBusy : bulkUnhideBusy) return;

    if (hidden) setBulkHideBusy(true);
    else setBulkUnhideBusy(true);

    const res = await bulkSetWaveTimelineVisibilityApi(selectedWaveIds, hidden);

    if (hidden) setBulkHideBusy(false);
    else setBulkUnhideBusy(false);

    if (!res.ok || !("updated_ids" in res.data)) {
      setWaveActionMessage(hidden ? "Bulk hide failed." : "Bulk unhide failed.");
      return;
    }

    const updatedIds = new Set(res.data.updated_ids || []);
    setChannelWaves((prev) => prev.map((wave) => (
      updatedIds.has(wave.id) ? { ...wave, status: hidden ? "hidden" : "active" } : wave
    )));
    setWaveActionMessage(hidden ? `Hidden ${res.data.updated_count} wave(s).` : `Restored ${res.data.updated_count} wave(s).`);
  }, [canManageChannel, selectedWaveIds, bulkHideBusy, bulkUnhideBusy]);

  useEffect(() => {
    if (!waveActionMessage) return;
    const timer = setTimeout(() => setWaveActionMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [waveActionMessage]);

  useEffect(() => {
    const availableIds = new Set(channelWaves.map((wave) => wave.id));
    setSelectedWaveIds((prev) => prev.filter((waveId) => availableIds.has(waveId)));
  }, [channelWaves]);

  useEffect(() => {
    if (!waveViewerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWaveViewerOpen(false);
      if (event.key === "ArrowRight") setWaveViewerAt(activeWaveIndex + 1);
      if (event.key === "ArrowLeft") setWaveViewerAt(activeWaveIndex - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [waveViewerOpen, activeWaveIndex, setWaveViewerAt]);

  useEffect(() => {
    const modalWaves = canManageChannel
      ? channelWaves
      : channelWaves.filter((wave) => wave.status === "active");
    if (!waveViewerOpen || !modalWaves[activeWaveIndex]) return;
    const waveId = modalWaves[activeWaveIndex].id;
    if (lastTrackedModalWaveId.current === waveId) return;
    lastTrackedModalWaveId.current = waveId;
    void trackWaveViewApi(waveId);
    setChannelWaves((prev) => prev.map((wave) => (
      wave.id === waveId
        ? { ...wave, repeat_play_count: (wave.repeat_play_count || 0) + 1 }
        : wave
    )));
  }, [waveViewerOpen, activeWaveIndex, channelWaves, canManageChannel]);

  useEffect(() => {
    if (!waveViewerOpen) {
      lastTrackedModalWaveId.current = null;
    }
  }, [waveViewerOpen]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "streams", label: "Past Streams" },
    { key: "waves", label: "Waves" },
    { key: "about", label: "About" },
    { key: "schedule", label: "Schedule" },
    ...(isExclusive ? [{ key: "library" as Tab, label: "Library" }] : []),
    ...(canManageChannel ? [{ key: "manage" as Tab, label: "⚙ Manage" }] : []),
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

  const visibleChannelWaves = canManageChannel
    ? channelWaves
    : channelWaves.filter((wave) => wave.status === "active");
  const activeModalWave = waveViewerOpen ? visibleChannelWaves[activeWaveIndex] ?? null : null;

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
              <span className="inline-flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.key === "library" && libraryUnreadCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-av-orange px-1.5 py-0.5 text-[10px] font-bold text-av-dark-blue shadow-sm shadow-av-orange/25">
                    {libraryUnreadCount > 99 ? "99+" : libraryUnreadCount}
                  </span>
                ) : null}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-av-orange rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB CONTENT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className={activeTab === "manage" ? "lg:col-span-3" : "lg:col-span-2"}>
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

            {/* Waves tab */}
            {activeTab === "waves" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-av-input-border/20 bg-av-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-av-light-orange">
                    <Link href="/wave" className="rounded-lg border border-av-input-border/30 px-2.5 py-1 hover:border-av-orange/50 hover:text-av-orange transition-colors">
                      Open Waves Page
                    </Link>
                    {canManageChannel && (
                      <Link href="/creator-studio" className="rounded-lg border border-av-input-border/30 px-2.5 py-1 hover:border-av-orange/50 hover:text-av-orange transition-colors">
                        Creator Uploads
                      </Link>
                    )}
                  </div>

                  {canManageChannel && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedWaveIds(visibleChannelWaves.map((wave) => wave.id))}
                        className="rounded-lg border border-av-input-border/30 px-2.5 py-1 text-[11px] text-av-light-orange hover:border-av-orange/50 hover:text-av-orange transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedWaveIds([])}
                        className="rounded-lg border border-av-input-border/30 px-2.5 py-1 text-[11px] text-av-light-orange hover:border-av-orange/50 hover:text-av-orange transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => void handleBulkVisibility(true)}
                        disabled={selectedWaveIds.length === 0 || bulkHideBusy}
                        className="rounded-lg border border-av-orange/30 bg-av-orange/10 px-2.5 py-1 text-[11px] text-av-orange disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {bulkHideBusy ? "Hiding..." : "Hide Selected"}
                      </button>
                      <button
                        onClick={() => void handleBulkVisibility(false)}
                        disabled={selectedWaveIds.length === 0 || bulkUnhideBusy}
                        className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {bulkUnhideBusy ? "Restoring..." : "Unhide Selected"}
                      </button>
                      <button
                        onClick={() => void handleBulkDelete()}
                        disabled={selectedWaveIds.length === 0 || bulkDeleteBusy}
                        className="rounded-lg border border-red-300/35 bg-red-400/10 px-2.5 py-1 text-[11px] text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {bulkDeleteBusy ? "Deleting..." : `Delete Selected (${selectedWaveIds.length})`}
                      </button>
                    </div>
                  )}
                </div>

                {waveActionMessage && (
                  <div className="rounded-lg border border-av-orange/30 bg-av-orange/10 px-3 py-2 text-xs text-av-orange">
                    {waveActionMessage}
                  </div>
                )}

                {channelWavesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
                  </div>
                ) : channelWavesLoaded && visibleChannelWaves.length === 0 ? (
                  <div className="text-center py-16 rounded-xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-3xl mb-2">⚡</p>
                    <p className="text-sm text-av-light-orange">No waves published yet</p>
                  </div>
                ) : (
                  <div className="max-h-[72vh] min-h-[28rem] overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {visibleChannelWaves.map((wave) => {
                        const deleting = !!waveDeleteBusy[wave.id];
                        const timelineBusy = !!waveTimelineBusy[wave.id];
                        const isHidden = wave.status === "hidden";
                        const selected = selectedWaveIds.includes(wave.id);
                        return (
                          <button
                            key={wave.id}
                            onClick={() => handleOpenWaveViewer(wave.id)}
                            className="group rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden text-left hover:border-av-orange/40 transition-all"
                          >
                            <div className="relative aspect-[9/16] bg-av-input-fill/40">
                              {wave.thumbnail_url ? (
                                <img
                                  src={wave.thumbnail_url}
                                  alt={wave.title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <video
                                  src={`${wave.video_url}#t=0.1`}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              )}

                              {canManageChannel && (
                                <label
                                  className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 text-[10px] text-av-white"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => handleToggleWaveSelection(wave.id)}
                                    className="h-3 w-3 accent-av-orange"
                                  />
                                  Select
                                </label>
                              )}

                              {isHidden && (
                                <span className="absolute right-1.5 top-1.5 rounded-md border border-av-orange/40 bg-av-orange/20 px-1.5 py-0.5 text-[10px] font-semibold text-av-orange">
                                  Hidden
                                </span>
                              )}
                            </div>

                            <div className="p-2.5">
                              <p className="text-[11px] font-semibold text-av-white leading-snug line-clamp-2">{wave.title}</p>
                              <p className="mt-1 text-[10px] text-av-light-orange">
                                ⚡ {formatNumber(wave.pulse_count || 0)}
                                {wave.duration > 0 ? ` · ${formatClock(wave.duration)}` : ""}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-av-light-orange">
                                <span className="inline-flex items-center gap-1">
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
                                  {formatNumber(wave.views_count ?? wave.views ?? wave.total_views ?? 0)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                                  {formatNumber(wave.repeat_play_count || 0)}
                                </span>
                              </div>

                              {canManageChannel && (
                                <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                                  <button
                                    onClick={() => void handleSetWaveHidden(wave.id, !isHidden)}
                                    disabled={timelineBusy || deleting}
                                    className="rounded-md border border-av-orange/30 bg-av-orange/10 px-2 py-1 text-[10px] text-av-orange disabled:opacity-50"
                                  >
                                    {timelineBusy ? "..." : isHidden ? "Unhide" : "Hide"}
                                  </button>
                                  <button
                                    onClick={() => void handleDeleteWave(wave.id)}
                                    disabled={deleting || timelineBusy}
                                    className="rounded-md border border-red-300/35 bg-red-400/10 px-2 py-1 text-[10px] text-red-300 disabled:opacity-50"
                                  >
                                    {deleting ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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

            {/* Manage tab (owner/admin only) */}
            {activeTab === "manage" && canManageChannel && channel && (
              <ChannelCreatorPanel
                channelId={id}
                channel={channel}
                onChannelUpdated={(updated) => setChannel(updated)}
              />
            )}

            {/* Library tab (exclusive channels only) */}
            {activeTab === "library" && isExclusive && (
              <div className="space-y-5">
                {/* Library header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-av-white tracking-tight">Exclusive Library</h2>
                    {libraryLoaded && libraryItems.length > 0 && (
                      <p className="text-xs text-av-light-orange mt-0.5">
                        {libraryItems.length} title{libraryItems.length !== 1 ? "s" : ""} available
                      </p>
                    )}
                  </div>
                  {(newLibraryItemsCount > 0 || libraryUnreadCount > 0) && (
                    <button
                      type="button"
                      onClick={() => void handleMarkLibraryViewed()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-av-orange/15 border border-av-orange/35 px-3 py-1.5 text-xs font-semibold text-av-orange hover:bg-av-orange/25 transition-all"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-av-orange animate-pulse" />
                      {Math.max(newLibraryItemsCount, libraryUnreadCount)} new · Mark viewed
                    </button>
                  )}
                </div>

                {!hasAccess ? (
                  <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-4xl mb-3">🔒</p>
                    <p className="text-sm font-semibold text-av-white mb-1">Exclusive Access Required</p>
                    <p className="text-xs text-av-light-orange mb-5">Subscribe to unlock this channel&apos;s full library</p>
                    <button
                      onClick={() => router.push(`/channel/${id}/exclusive-access`)}
                      className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
                    >
                      Open Exclusive Access
                    </button>
                  </div>
                ) : !libraryLoaded ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden animate-pulse">
                        <div className="aspect-[2/3] bg-av-input-fill/60" />
                        <div className="p-3 space-y-2">
                          <div className="h-3.5 w-4/5 rounded bg-av-input-fill/60" />
                          <div className="h-2.5 w-3/5 rounded bg-av-input-fill/60" />
                          <div className="h-2 w-2/5 rounded bg-av-input-fill/40" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : libraryItems.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl bg-av-card/50 border border-av-input-border/20">
                    <p className="text-4xl mb-3">📚</p>
                    <p className="text-sm font-semibold text-av-white mb-1">Library Coming Soon</p>
                    <p className="text-xs text-av-light-orange">No titles have been published yet — check back soon</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {libraryItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void openLibraryDetail(item.id)}
                        className="group text-left rounded-xl bg-av-card border border-av-input-border/20 hover:border-av-orange/40 hover:shadow-xl hover:shadow-av-orange/10 transition-all duration-200 overflow-hidden"
                      >
                        {/* Portrait cover — book/comic aspect ratio */}
                        <div className="relative aspect-[2/3] bg-gradient-to-br from-av-light-blue/25 to-av-dark-blue/80 overflow-hidden">
                          {item.coverAssetUrl ? (
                            <img
                              src={item.coverAssetUrl}
                              alt={item.title}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <span className="text-4xl">📘</span>
                              <span className="text-[10px] text-av-light-orange/50 font-medium px-2 text-center">{item.title}</span>
                            </div>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-av-dark-blue/0 group-hover:bg-av-dark-blue/30 transition-all duration-200 flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-bold text-white bg-av-orange rounded-full px-3 py-1.5 shadow-lg">
                              Read
                            </span>
                          </div>
                          {/* Page count badge */}
                          {item.totalPages > 0 && (
                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                              {item.totalPages}p
                            </div>
                          )}
                        </div>
                        {/* Card info */}
                        <div className="p-3">
                          <p className="text-xs font-semibold text-av-white leading-snug line-clamp-2 group-hover:text-av-orange transition-colors">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-av-light-orange truncate">{item.author}</p>
                          {item.estimatedReadMinutes > 0 && (
                            <p className="mt-1 text-[10px] text-av-light-orange/60">
                              {item.estimatedReadMinutes} min read
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar — hidden on manage tab */}
          <div className={`space-y-4${activeTab === "manage" ? " hidden" : ""}`}>
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

      {waveViewerOpen && activeModalWave && (
        <div className="fixed inset-0 z-[75] bg-black/95 backdrop-blur-sm">
          <button
            onClick={() => setWaveViewerOpen(false)}
            className="absolute right-4 top-4 z-20 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-sm text-white hover:bg-black/70"
          >
            Close
          </button>

          <div className="absolute left-4 top-4 z-20 flex items-center gap-2 text-xs text-av-light-orange">
            <Link href="/wave" className="rounded-md border border-av-input-border/30 bg-av-card/60 px-2 py-1 hover:text-av-orange transition-colors">
              Open Waves Page
            </Link>
            <span className="rounded-md border border-av-input-border/30 bg-av-card/60 px-2 py-1">
              {activeWaveIndex + 1} / {visibleChannelWaves.length}
            </span>
          </div>

          <div className="flex h-full w-full items-center justify-center px-16 py-10">
            <div className="relative h-full max-h-[92vh] w-full max-w-md rounded-2xl border border-av-input-border/30 bg-av-dark-blue/80 p-3">
              <video
                key={activeModalWave.id}
                ref={waveViewerRef}
                src={activeModalWave.video_url}
                controls
                autoPlay
                playsInline
                className="h-full w-full rounded-xl bg-black object-contain"
              />

              <div className="pointer-events-none absolute inset-x-4 bottom-5 rounded-xl bg-black/60 p-3 text-white backdrop-blur-sm">
                <p className="line-clamp-2 text-sm font-semibold">{activeModalWave.title}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
                    {formatNumber(activeModalWave.views_count ?? activeModalWave.views ?? activeModalWave.total_views ?? 0)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                    {formatNumber(activeModalWave.repeat_play_count || 0)} replays
                  </span>
                  <span>{activeModalWave.duration > 0 ? formatClock(activeModalWave.duration) : ""}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setWaveViewerAt(activeWaveIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/50 p-3 text-white hover:bg-black/70"
            aria-label="Previous wave"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>

          <button
            onClick={() => setWaveViewerAt(activeWaveIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/50 p-3 text-white hover:bg-black/70"
            aria-label="Next wave"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="m8.59 16.59 1.41 1.41L16 12 10 6 8.59 7.41 13.17 12z"/></svg>
          </button>
        </div>
      )}

      {libraryModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-av-card border border-av-input-border/30 overflow-hidden shadow-2xl relative">
            {/* Close button */}
            <button
              onClick={() => {
                setLibraryModalOpen(false);
                setLibraryDetail(null);
                setLibraryDetailError(null);
                setSelectedLibraryItemId(null);
              }}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-av-light-orange hover:text-av-white hover:bg-black/60 transition-all"
            >
              ✕
            </button>

            {libraryModalLoading ? (
              <div className="py-24 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
              </div>
            ) : libraryDetailError ? (
              <div className="p-6 text-center">
                <p className="text-base font-semibold text-av-white">Unable to open this item</p>
                <p className="mt-2 text-sm text-av-light-orange">{libraryDetailError}</p>
                <button
                  onClick={() => void openLibraryDetail(selectedLibraryItemId || "")}
                  disabled={!selectedLibraryItemId}
                  className="mt-5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-40"
                >
                  Retry
                </button>
              </div>
            ) : !libraryDetail ? (
              <div className="p-6 text-center">
                <p className="text-sm text-av-light-orange">No item details are available.</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row">
                {/* Cover panel */}
                <div className="sm:w-44 flex-shrink-0 bg-gradient-to-br from-av-light-blue/20 to-av-dark-blue/80">
                  {libraryDetail.item.coverAssetUrl ? (
                    <img
                      src={libraryDetail.item.coverAssetUrl}
                      alt={libraryDetail.item.title}
                      className="w-full h-56 sm:h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-56 sm:h-full flex items-center justify-center text-5xl">📘</div>
                  )}
                </div>

                {/* Detail panel */}
                <div className="flex-1 min-w-0 p-5 flex flex-col">
                  <p className="text-lg font-bold text-av-white leading-snug pr-6">{libraryDetail.item.title}</p>
                  <p className="mt-1 text-sm text-av-orange font-medium">{libraryDetail.item.author}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {libraryDetail.item.totalPages > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-av-input-fill/60 border border-av-input-border/20 text-av-light-orange font-medium">
                        {libraryDetail.item.totalPages} pages
                      </span>
                    )}
                    {libraryDetail.item.estimatedReadMinutes > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-av-input-fill/60 border border-av-input-border/20 text-av-light-orange font-medium">
                        {libraryDetail.item.estimatedReadMinutes} min read
                      </span>
                    )}
                    {libraryDetail.item.contentType && (
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-av-orange/10 border border-av-orange/20 text-av-orange font-medium capitalize">
                        {libraryDetail.item.contentType}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {libraryDetail.item.description && (
                    <p className="mt-3 text-xs text-av-light-orange leading-relaxed line-clamp-4">
                      {libraryDetail.item.description}
                    </p>
                  )}

                  {/* Tags */}
                  {(libraryDetail.item.tags || []).length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {(libraryDetail.item.tags || []).slice(0, 5).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-av-input-border/30 text-av-light-orange/70">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-auto pt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => router.push(`/channel/${id}/library/${libraryDetail.item.id}`)}
                      className="flex-1 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2.5 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Read Now
                    </button>
                    <button
                      onClick={() => void handleLibraryFavoriteToggle()}
                      className="flex-1 rounded-xl border border-av-input-border/30 px-4 py-2.5 text-xs font-semibold text-av-white hover:border-av-orange/35 hover:bg-av-orange/5 transition-all"
                    >
                      {libraryFavoriteItemIds[libraryDetail.item.id] ? "✓ Saved" : "Save"}
                    </button>
                    <button
                      disabled={!libraryDetail.navigation.nextItemId}
                      onClick={() => void handleLibrarySeeNext()}
                      className="flex-1 rounded-xl border border-av-input-border/30 px-4 py-2.5 text-xs font-semibold text-av-white disabled:opacity-40 hover:border-av-orange/35 hover:bg-av-orange/5 transition-all disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
