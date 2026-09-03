"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  deleteProgramApi,
  deleteChannelApi,
  deleteVideoApi,
  getChannelScheduleApi,
  getMyChannelsApi,
  getMyVideosApi,
  cancelVideoUploadSessionApi,
  deleteVideoUploadSessionApi,
  getMyVideoUploadSessionsApi,
  getVideoUploadUrlApi,
  uploadFileToGCS,
  registerUploadedVideoApi,
  uploadVideoApi,
  createVideoResumableSessionApi,
  completeVideoResumableSessionApi,
  scheduleProgramApi,
  scheduleSequentialApi,
  resolveSourceApi,
  uploadChannelMediaApi,
  updateChannelApi,
  updateExternalSourceApi,
  recheckStreamHealthApi,
  getNowPlayingApi,
  updateVideoContentRatingApi,
  retryVideoTranscodeApi,
  type Channel,
  type ChannelVideo,
  type ScheduleProgram,
  type VideoUploadSession,
  type NowPlaying,
} from "@/lib/api";
import { ResumableUploader, saveUploadSession, removeUploadSession, getStoredUploadSessions } from "@/lib/resumable-upload";
import {
  CLASSIFICATION_OPTIONS,
  PUBLIC_CLASSIFICATION_OPTIONS,
  GENERAL_CONTENT_FIELDS,
  ADULT_SENSITIVE_FIELDS,
  getClassificationMeta,
  type AgeClassification,
} from "@/lib/content-rating";
import { useAuth } from "@/lib/AuthContext";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import { WaveUploadPanel } from "@/components/WaveUploadPanel";

/** Thin wrapper so the panel uses the studio's already-selected channel. */
function WaveUploadPanelInStudio({ selectedChannelId }: { selectedChannelId: string }) {
  return <WaveUploadPanel channelId={selectedChannelId || undefined} />;
}

/* ── helpers ─────────────────────────────────────────── */

function formatTimestamp(value: number | string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function titleFromFilename(name: string) {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(value: string | number | null | undefined): string {
  if (!value) return "never";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
]);

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
]);

function isSupportedVideoFile(file: File): boolean {
  const type = String(file.type || "").toLowerCase();
  if (type && SUPPORTED_VIDEO_MIME_TYPES.has(type)) return true;
  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? file.name.toLowerCase().slice(dotIndex) : "";
  return SUPPORTED_VIDEO_EXTENSIONS.has(ext);
}

function getVideoContentType(file: File): string {
  const type = String(file.type || "").toLowerCase();
  if (SUPPORTED_VIDEO_MIME_TYPES.has(type)) return type;
  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? file.name.toLowerCase().slice(dotIndex) : "";
  if (ext === ".webm") return "video/webm";
  return "video/mp4";
}

const ITEMS_PER_PAGE = 6;

/**
 * Read video duration from a File using a hidden <video> element.
 */
function detectDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      const dur = Math.round(vid.duration);
      URL.revokeObjectURL(url);
      resolve(isFinite(dur) && dur > 0 ? dur : 0);
    };
    vid.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    vid.src = url;
  });
}

/* ── upload-entry type ───────────────────────────────── */

interface UploadEntry {
  id: string;
  file: File;
  title: string;
  description: string;
  duration: number;
  detecting: boolean;
  progress: number; // -1 = pending, 0-100 = uploading, 101 = registered
  error: string | null;
  registeredVideoId: string | null;
  sessionId: string | null;
  paused: boolean;
  retrying: boolean;
  uploadSpeed: number;
  ageClassification: AgeClassification;
  hasExplicitLanguage: boolean;
  hasNudity: boolean;
  hasViolence: boolean;
  hasRevealingClothes: boolean;
  hasPartialNudity: boolean;
  hasExplicitContent: boolean;
  hasParentalGuidance: boolean;
  hasEroticDancing: boolean;
  hasSexualNature: boolean;
  hasSex: boolean;
}

function parseDurationInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function Spinner({ size = "sm" }: { size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── page component ──────────────────────────────────── */

export default function CreatorStudioPage() {
  const router = useRouter();
  const { isAuthenticated, user, isMinor } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleProgram[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [playbackState, setPlaybackState] = useState<{
    nowPlaying: NowPlaying | null;
    schedulerState: { reason: string; program_id?: string; video_missing?: boolean } | null;
    serverTime: number;
    loading: boolean;
  }>({ nowPlaying: null, schedulerState: null, serverTime: 0, loading: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDescription, setEditChannelDescription] = useState("");
  const [editChannelCategory, setEditChannelCategory] = useState("");
  const [editChannelLogoFile, setEditChannelLogoFile] = useState<File | null>(null);
  const [editChannelBannerFile, setEditChannelBannerFile] = useState<File | null>(null);
  const [savingChannelEdit, setSavingChannelEdit] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  // ── Multi-upload state
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [recentUploadSessions, setRecentUploadSessions] = useState<VideoUploadSession[]>([]);
  const [loadingUploadSessions, setLoadingUploadSessions] = useState(false);
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploaderRefs = useRef<Map<string, ResumableUploader>>(new Map());
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const resumeTargetRef = useRef<{ sessionId: string; sessionUrl: string; fileName: string; fileSize: number; channelId: string; title: string } | null>(null);
  const [interruptedSessions, setInterruptedSessions] = useState<Array<{ sessionId: string; sessionUrl: string; fileName: string; fileSize: number; channelId: string; title: string; createdAt: number }>>([]);

  // ── Auto-schedule state
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [autoScheduleStart, setAutoScheduleStart] = useState("");
  const [schedulingBulk, setSchedulingBulk] = useState(false);

  // ── Single schedule state (kept for scheduling existing library videos)
  const [scheduleVideoId, setScheduleVideoId] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");

  // ── Library auto-schedule state
  const [libraryAutoStart, setLibraryAutoStart] = useState("");
  const [schedulingLibrary, setSchedulingLibrary] = useState(false);

  // ── Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // ── Selection state for bulk operations
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [channelsPage, setChannelsPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  const [channelsPaging, setChannelsPaging] = useState<"prev" | "next" | null>(null);
  const [navPendingKey, setNavPendingKey] = useState<string | null>(null);

  // ── External stream source state (AV-STR-003)
  const [extSourceMode, setExtSourceMode] = useState<string>("native");
  const [extSourceUrl, setExtSourceUrl] = useState("");
  const [extValidating, setExtValidating] = useState(false);
  const [extUrlValidation, setExtUrlValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const [extSaving, setExtSaving] = useState(false);
  const [extRechecking, setExtRechecking] = useState(false);

  // ── Content rating editor for legacy videos
  const [ratingEditorVideo, setRatingEditorVideo] = useState<ChannelVideo | null>(null);
  const [ratingEditorAge, setRatingEditorAge] = useState<AgeClassification>("teen");
  const [ratingEditorFields, setRatingEditorFields] = useState<Record<string, boolean>>({});
  const [ratingEditorSaving, setRatingEditorSaving] = useState(false);
  const [batchRatingSaving, setBatchRatingSaving] = useState(false);
  const [retryingTranscodeId, setRetryingTranscodeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { type: "single"; videoId: string; title: string } |
    { type: "selected"; count: number } |
    { type: "all"; count: number } |
    null
  >(null);
  const [deletingConfirmed, setDeletingConfirmed] = useState(false);

  const handleSelectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setSelectedVideoIds(new Set());
    setSelectedProgramIds(new Set());
    setSchedulePage(1);
  }, []);

  const loadStudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [channelsRes, videosRes] = await Promise.all([
      getMyChannelsApi(),
      getMyVideosApi(),
    ]);

    if (channelsRes.ok && "channels" in channelsRes.data) {
      setChannels(channelsRes.data.channels);
      const nextChannelId =
        selectedChannelId || channelsRes.data.channels[0]?.id || "";
      handleSelectChannel(nextChannelId);
    } else {
      setError("Failed to load your channels.");
    }

    if (videosRes.ok && "videos" in videosRes.data) {
      setVideos(videosRes.data.videos);
    }

    setLoading(false);
  }, [handleSelectChannel, selectedChannelId]);

  const loadSchedule = useCallback(async (channelId: string) => {
    if (!channelId) {
      setSchedule([]);
      return;
    }
    const res = await getChannelScheduleApi(channelId);
    if (res.ok && "schedule" in res.data) {
      setSchedule(res.data.schedule);
    }
  }, []);

  const loadPlaybackState = useCallback(async (channelId: string) => {
    if (!channelId) {
      setPlaybackState({ nowPlaying: null, schedulerState: null, serverTime: 0, loading: false });
      return;
    }
    setPlaybackState((prev) => ({ ...prev, loading: true }));
    const res = await getNowPlayingApi(channelId);
    if (res.ok && "now_playing" in res.data) {
      setPlaybackState({
        nowPlaying: (res.data.now_playing as NowPlaying | null) ?? null,
        schedulerState: res.data.scheduler_state && typeof res.data.scheduler_state === "object"
          ? (res.data.scheduler_state as { reason: string; program_id?: string; video_missing?: boolean })
          : null,
        serverTime: typeof res.data.server_time === "number" ? res.data.server_time : 0,
        loading: false,
      });
    } else {
      setPlaybackState({ nowPlaying: null, schedulerState: null, serverTime: 0, loading: false });
    }
  }, []);

  const loadUploadSessions = useCallback(async (channelId?: string) => {
    setLoadingUploadSessions(true);
    const res = await getMyVideoUploadSessionsApi(channelId);
    if (res.ok && "sessions" in res.data) {
      setRecentUploadSessions(res.data.sessions);
    }
    setLoadingUploadSessions(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutId = window.setTimeout(() => {
      void loadStudio();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, loadStudio]);

  useEffect(() => {
    if (!selectedChannelId) return;
    const timeoutId = window.setTimeout(() => {
      void loadSchedule(selectedChannelId);
      void loadUploadSessions(selectedChannelId);
      void loadPlaybackState(selectedChannelId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedChannelId, loadSchedule, loadUploadSessions, loadPlaybackState]);

  // Refresh live playback state every 30 seconds for the selected channel.
  useEffect(() => {
    if (!selectedChannelId) return;
    const intervalId = window.setInterval(() => {
      void loadPlaybackState(selectedChannelId);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [selectedChannelId, loadPlaybackState]);

  useEffect(() => {
    if (!selectedChannelId) return;
    const hasActiveSessions = recentUploadSessions.some((session) =>
      ["initiated", "uploading", "paused", "failed"].includes(session.status),
    );
    if (!uploadingAll && !hasActiveSessions) return;

    const intervalId = window.setInterval(() => {
      void loadUploadSessions(selectedChannelId);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [selectedChannelId, uploadingAll, recentUploadSessions, loadUploadSessions]);

  // ── Phase 3: Scan localStorage for interrupted upload sessions on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const stored = getStoredUploadSessions();
    const now = Date.now();
    const valid = stored.filter((s) => now - s.createdAt < 24 * 60 * 60 * 1000);
    const expired = stored.filter((s) => now - s.createdAt >= 24 * 60 * 60 * 1000);
    for (const ex of expired) {
      removeUploadSession(ex.sessionId);
    }
    if (valid.length > 0) {
      setInterruptedSessions(valid);
    }
  }, [isAuthenticated]);

  // ── Phase 3: Handle re-selecting file for interrupted upload resume
  async function handleResumeFileSelected(files: FileList | null) {
    if (!files || files.length === 0 || !resumeTargetRef.current) return;
    const target = resumeTargetRef.current;
    resumeTargetRef.current = null;

    const file = files[0];
    if (!isSupportedVideoFile(file)) {
      setError("Unsupported file format for resume.");
      return;
    }

    const entryId = `${Date.now()}-resume`;
    const newEntry: UploadEntry = {
      id: entryId,
      file,
      title: target.title,
      description: "",
      duration: 0,
      detecting: true,
      progress: 0,
      error: null,
      registeredVideoId: null,
      sessionId: target.sessionId,
      paused: false,
      retrying: false,
      uploadSpeed: 0,
      ageClassification: "teen",
      hasExplicitLanguage: false,
      hasNudity: false,
      hasViolence: false,
      hasRevealingClothes: false,
      hasPartialNudity: false,
      hasExplicitContent: false,
      hasParentalGuidance: false,
      hasEroticDancing: false,
      hasSexualNature: false,
      hasSex: false,
    };

    setUploadEntries((prev) => [...prev, newEntry]);
    setInterruptedSessions((prev) => prev.filter((s) => s.sessionId !== target.sessionId));

    const dur = await detectDuration(file);
    setUploadEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, duration: dur, detecting: false } : e));

    setUploadingAll(true);
    try {
      const uploader = new ResumableUploader({
        file,
        sessionId: target.sessionId,
        sessionUrl: target.sessionUrl,
        onProgress: (pct) => updateEntry(entryId, { progress: pct, error: null }),
        onPaused: () => updateEntry(entryId, { paused: true }),
        onError: (errMsg) => updateEntry(entryId, { error: errMsg, retrying: false }),
        onRetrying: (attempt, maxAttempts) => updateEntry(entryId, { retrying: true, error: `Retrying… attempt ${attempt}/${maxAttempts}` }),
        onSpeedUpdate: (bps) => updateEntry(entryId, { uploadSpeed: bps }),
      });

      uploaderRefs.current.set(entryId, uploader);
      await uploader.start();

      if (uploader.getOffset() >= file.size) {
        const completeRes = await completeVideoResumableSessionApi(target.sessionId);
        if (completeRes.ok && "video" in completeRes.data) {
          removeUploadSession(target.sessionId);
          updateEntry(entryId, { progress: 101, registeredVideoId: completeRes.data.video.id, error: null, sessionId: null });
        }
      }
    } catch {
      updateEntry(entryId, { error: "Resume failed. Please try uploading again.", progress: -1 });
    }
    setUploadingAll(false);
  }

  // Sync stream source fields when selected channel changes
  useEffect(() => {
    const ch = channels.find((c) => c.id === selectedChannelId);
    if (!ch) return;
    const timeoutId = window.setTimeout(() => {
      setExtSourceMode(ch.stream_source_mode ?? "native");
      setExtSourceUrl(ch.external_url ?? "");
      setExtUrlValidation(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedChannelId, channels]);

  const selectedChannelVideos = useMemo(
    () => videos.filter((video) => video.channel_id === selectedChannelId),
    [videos, selectedChannelId],
  );

  const channelsPageCount = Math.max(1, Math.ceil(channels.length / ITEMS_PER_PAGE));
  const clampedChannelsPage = Math.min(channelsPage, channelsPageCount);
  const pagedChannels = useMemo(() => {
    const start = (clampedChannelsPage - 1) * ITEMS_PER_PAGE;
    return channels.slice(start, start + ITEMS_PER_PAGE);
  }, [channels, clampedChannelsPage]);

  const schedulePageCount = Math.max(1, Math.ceil(schedule.length / ITEMS_PER_PAGE));
  const clampedSchedulePage = Math.min(schedulePage, schedulePageCount);
  const pagedSchedule = useMemo(() => {
    const start = (clampedSchedulePage - 1) * ITEMS_PER_PAGE;
    return schedule.slice(start, start + ITEMS_PER_PAGE);
  }, [schedule, clampedSchedulePage]);

  const totalHours = useMemo(
    () => videos.reduce((sum, video) => sum + video.duration, 0) / 3600,
    [videos],
  );

  useEffect(() => {
    if (!navPendingKey) return;
    const timeoutId = window.setTimeout(() => setNavPendingKey(null), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [navPendingKey]);

  function handleStudioNavigation(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    key: string,
  ) {
    if (navPendingKey) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setNavPendingKey(key);
    router.push(href);
  }

  /* ── Multi-file picker ─────────────────────────────── */

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newEntries: UploadEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const supported = isSupportedVideoFile(file);
      newEntries.push({
        id: `${Date.now()}-${i}`,
        file,
        title: titleFromFilename(file.name),
        description: "",
        duration: 0,
        detecting: supported,
        progress: -1,
        error: supported ? null : "Unsupported format. Upload MP4 (H.264/AAC) or WebM (VP9/Opus).",
        registeredVideoId: null,
        sessionId: null,
        paused: false,
        retrying: false,
        uploadSpeed: 0,
        ageClassification: "teen",
        hasExplicitLanguage: false,
        hasNudity: false,
        hasViolence: false,
        hasRevealingClothes: false,
        hasPartialNudity: false,
        hasExplicitContent: false,
        hasParentalGuidance: false,
        hasEroticDancing: false,
        hasSexualNature: false,
        hasSex: false,
      });
    }
    setUploadEntries((prev) => [...prev, ...newEntries]);

    // Detect durations in parallel
    for (const entry of newEntries) {
      if (!isSupportedVideoFile(entry.file)) {
        continue;
      }
      detectDuration(entry.file).then((dur) => {
        setUploadEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, duration: dur, detecting: false } : e,
          ),
        );
      });
    }
  }

  function updateEntry(id: string, patch: Partial<UploadEntry>) {
    setUploadEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  function removeEntry(id: string) {
    setUploadEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function retryFailedEntries() {
    setUploadEntries((prev) =>
      prev.map((entry) =>
        entry.error
          ? {
              ...entry,
              error: null,
              progress: -1,
            }
          : entry,
      ),
    );
  }

  function clearCompletedEntries() {
    setUploadEntries((prev) => prev.filter((entry) => entry.progress !== 101));
  }

  /* ── Drag to reorder ───────────────────────────────── */

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...uploadEntries];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    setUploadEntries(items);
    dragItem.current = null;
    dragOverItem.current = null;
  }

  /* ── Upload all sequentially ───────────────────────── */

  async function handleUploadAll() {
    if (!selectedChannelId) {
      setError("Select a channel first.");
      return;
    }

    const pending = uploadEntries.filter((e) => e.progress === -1);
    if (pending.length === 0) return;

    setUploadingAll(true);
    setError(null);
    setUploadNotice(
      "We are processing your uploads now. You can continue other activities; once each upload completes, you will receive a notification.",
    );

    for (const entry of pending) {
      if (!isSupportedVideoFile(entry.file)) {
        updateEntry(entry.id, {
          error: "Unsupported format. Upload MP4 (H.264/AAC) or WebM (VP9/Opus).",
          progress: -1,
          detecting: false,
        });
        continue;
      }
      let resolvedDuration = entry.duration;
      if (resolvedDuration <= 0 || entry.detecting) {
        updateEntry(entry.id, { detecting: true });
        resolvedDuration = await detectDuration(entry.file);
        updateEntry(entry.id, { duration: resolvedDuration, detecting: false });
      }

      if (!Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
        updateEntry(entry.id, {
          error: "Duration detection failed. Set a duration manually before uploading.",
          progress: -1,
          detecting: false,
        });
        continue;
      }

      const title = entry.title.trim() || titleFromFilename(entry.file.name);
      const description = entry.description.trim();
      const fallbackToLegacyUpload = async () => {
        const directRes = await uploadVideoApi({
          channelId: selectedChannelId,
          title,
          description,
          duration: resolvedDuration,
          file: entry.file,
        });

        if (!directRes.ok || !("video" in directRes.data)) {
          updateEntry(entry.id, {
            error:
              "error" in directRes.data
                ? directRes.data.error
                : "Direct upload failed",
            progress: -1,
          });
          return;
        }

        updateEntry(entry.id, {
          progress: 101,
          registeredVideoId: directRes.data.video.id,
          error: null,
        });
      };

      const fallbackToSignedUrlUpload = async () => {
        updateEntry(entry.id, { progress: 0, error: null });
        const signedRes = await getVideoUploadUrlApi({
          contentType: getVideoContentType(entry.file),
          fileName: entry.file.name,
        });
        if (!signedRes.ok || !("signed_url" in signedRes.data)) {
          await fallbackToLegacyUpload();
          return;
        }
        await uploadFileToGCS(signedRes.data.signed_url, entry.file, (pct) => {
          updateEntry(entry.id, { progress: pct, error: null });
        });
        const registerRes = await registerUploadedVideoApi({
          channelId: selectedChannelId,
          title,
          description,
          duration: resolvedDuration,
          videoUrl: signedRes.data.public_url,
          ageClassification: entry.ageClassification,
          hasExplicitLanguage: entry.hasExplicitLanguage,
          hasNudity: entry.hasNudity,
          hasViolence: entry.hasViolence,
          hasRevealingClothes: entry.hasRevealingClothes,
          hasPartialNudity: entry.hasPartialNudity,
          hasExplicitContent: entry.hasExplicitContent,
          hasParentalGuidance: entry.hasParentalGuidance,
          hasEroticDancing: entry.hasEroticDancing,
          hasSexualNature: entry.hasSexualNature,
          hasSex: entry.hasSex,
        });
        if (!registerRes.ok || !("video" in registerRes.data)) {
          updateEntry(entry.id, {
            error: "error" in registerRes.data ? registerRes.data.error : "Registration failed",
            progress: -1,
          });
          return;
        }
        updateEntry(entry.id, {
          progress: 101,
          registeredVideoId: registerRes.data.video.id,
          error: null,
        });
      };

      try {
        updateEntry(entry.id, { progress: 0, error: null, retrying: false });

        const sessionRes = await createVideoResumableSessionApi({
          channelId: selectedChannelId,
          title,
          description,
          duration: resolvedDuration,
          fileName: entry.file.name,
          fileSize: entry.file.size,
          contentType: getVideoContentType(entry.file),
          ageClassification: entry.ageClassification,
          hasExplicitLanguage: entry.hasExplicitLanguage,
          hasNudity: entry.hasNudity,
          hasViolence: entry.hasViolence,
          hasRevealingClothes: entry.hasRevealingClothes,
          hasPartialNudity: entry.hasPartialNudity,
          hasExplicitContent: entry.hasExplicitContent,
          hasParentalGuidance: entry.hasParentalGuidance,
          hasEroticDancing: entry.hasEroticDancing,
          hasSexualNature: entry.hasSexualNature,
          hasSex: entry.hasSex,
        });

        if (!sessionRes.ok || !("session" in sessionRes.data)) {
          await fallbackToSignedUrlUpload();
          continue;
        }

        const session = sessionRes.data.session;
        if (!session.upload_url) {
          await fallbackToSignedUrlUpload();
          continue;
        }

        updateEntry(entry.id, { sessionId: session.id });

        saveUploadSession({
          sessionId: session.id,
          sessionUrl: session.upload_url,
          fileName: entry.file.name,
          fileSize: entry.file.size,
          uploadedBytes: 0,
          channelId: selectedChannelId,
          title,
          createdAt: Date.now(),
        });

        const uploader = new ResumableUploader({
          file: entry.file,
          sessionId: session.id,
          sessionUrl: session.upload_url,
          onProgress: (pct) => {
            updateEntry(entry.id, { progress: pct, error: null });
          },
          onPaused: () => {
            updateEntry(entry.id, { paused: true });
          },
          onError: (errMsg) => {
            updateEntry(entry.id, { error: errMsg, retrying: false });
          },
          onRetrying: (attempt, maxAttempts) => {
            updateEntry(entry.id, { retrying: true, error: `Retrying… attempt ${attempt}/${maxAttempts}` });
          },
          onSpeedUpdate: (bps) => {
            updateEntry(entry.id, { uploadSpeed: bps });
          },
        });

        uploaderRefs.current.set(entry.id, uploader);
        await uploader.start();

        if (uploader.getOffset() >= entry.file.size) {
          const completeRes = await completeVideoResumableSessionApi(session.id);
          if (!completeRes.ok || !("video" in completeRes.data)) {
            updateEntry(entry.id, {
              error: "error" in completeRes.data ? completeRes.data.error : "Failed to complete upload session",
              progress: -1,
            });
            continue;
          }
          removeUploadSession(session.id);
          updateEntry(entry.id, {
            progress: 101,
            registeredVideoId: completeRes.data.video.id,
            error: null,
            sessionId: null,
          });
        }
      } catch {
        uploaderRefs.current.delete(entry.id);
        await fallbackToSignedUrlUpload();
      }
    }

    await loadStudio();
    await loadSchedule(selectedChannelId);
    await loadUploadSessions(selectedChannelId);
    setUploadingAll(false);
    setUploadNotice(null);

    // Check if any succeeded — offer auto-schedule
    const updated = uploadEntries.filter(
      (e) => e.progress === 101 && e.registeredVideoId,
    );
    if (updated.length > 0) {
      setShowAutoSchedule(true);
    }
  }

  /* ── Pause / Resume individual uploads ─────────────── */

  function handlePauseUpload(entryId: string) {
    const uploader = uploaderRefs.current.get(entryId);
    if (uploader) {
      uploader.pause();
      updateEntry(entryId, { paused: true });
    }
  }

  async function handleResumeUpload(entryId: string) {
    const uploader = uploaderRefs.current.get(entryId);
    if (!uploader) return;
    updateEntry(entryId, { paused: false, error: null });
    try {
      await uploader.resume();
      const entry = uploadEntries.find((e) => e.id === entryId);
      if (entry && uploader.getOffset() >= entry.file.size) {
        const completeRes = await completeVideoResumableSessionApi(entry.sessionId!);
        if (completeRes.ok && "video" in completeRes.data) {
          removeUploadSession(entry.sessionId!);
          updateEntry(entryId, {
            progress: 101,
            registeredVideoId: completeRes.data.video.id,
            error: null,
            sessionId: null,
          });
        }
      }
    } catch {
      updateEntry(entryId, { error: "Resume failed. Please retry.", progress: -1 });
    }
  }

  /* ── Auto-schedule uploaded videos ─────────────────── */

  async function handleAutoSchedule() {
    const videoIds = uploadEntries
      .filter((e) => e.progress === 101 && e.registeredVideoId)
      .map((e) => e.registeredVideoId!);

    if (videoIds.length === 0 || !autoScheduleStart || !selectedChannelId) {
      setError("Pick a start time and make sure videos are uploaded.");
      return;
    }

    setSchedulingBulk(true);
    setError(null);

    const res = await scheduleSequentialApi({
      channelId: selectedChannelId,
      videoIds,
      startTime: new Date(autoScheduleStart).getTime(),
    });

    if (!res.ok) {
      setError(
        "error" in res.data ? res.data.error : "Auto-scheduling failed.",
      );
    } else {
      setShowAutoSchedule(false);
      setUploadEntries([]);
      await loadSchedule(selectedChannelId);
    }
    setSchedulingBulk(false);
  }

  /* ── Auto-schedule entire library ────────────────── */

  async function handleAutoScheduleLibrary() {
    if (
      selectedChannelVideos.length === 0 ||
      !libraryAutoStart ||
      !selectedChannelId
    ) {
      setError("Pick a start time and make sure the library has videos.");
      return;
    }

    setSchedulingLibrary(true);
    setError(null);

    const videoIds = selectedChannelVideos.map((v) => v.id);
    const res = await scheduleSequentialApi({
      channelId: selectedChannelId,
      videoIds,
      startTime: new Date(libraryAutoStart).getTime(),
    });

    if (!res.ok) {
      setError(
        "error" in res.data ? res.data.error : "Auto-scheduling failed.",
      );
    } else {
      setLibraryAutoStart("");
      await loadSchedule(selectedChannelId);
    }
    setSchedulingLibrary(false);
  }

  /* ── Single schedule (for existing library videos) ── */

  async function handleSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedChannelId || !scheduleVideoId || !scheduleStart) {
      setError("Select a channel, a video, and a start time.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await scheduleProgramApi({
      channelId: selectedChannelId,
      videoId: scheduleVideoId,
      startTime: new Date(scheduleStart).getTime(),
    });

    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Scheduling failed.");
    } else {
      await loadSchedule(selectedChannelId);
      setScheduleStart("");
    }
    setBusy(false);
  }

  function handleDeleteVideo(videoId: string, title: string) {
    setDeleteConfirm({ type: "single", videoId, title });
  }
  async function confirmDeleteVideo() {
    if (!deleteConfirm) return;
    setDeletingConfirmed(true);
    setError(null);
    if (deleteConfirm.type === "single") {
      const res = await deleteVideoApi(deleteConfirm.videoId);
      if (!res.ok) {
        setError("error" in res.data ? res.data.error : "Could not delete video.");
      }
    } else if (deleteConfirm.type === "selected") {
      let failed = 0;
      for (const id of selectedVideoIds) {
        const res = await deleteVideoApi(id);
        if (!res.ok) failed++;
      }
      if (failed > 0) setError(`${failed} video(s) could not be deleted.`);
      setSelectedVideoIds(new Set());
    } else if (deleteConfirm.type === "all") {
      let failed = 0;
      for (const v of selectedChannelVideos) {
        const res = await deleteVideoApi(v.id);
        if (!res.ok) failed++;
      }
      if (failed > 0) setError(`${failed} video(s) could not be deleted.`);
      setSelectedVideoIds(new Set());
    }
    await loadStudio();
    await loadSchedule(selectedChannelId);
    setDeletingConfirmed(false);
    setDeleteConfirm(null);
  }

  async function handleDeleteProgram(programId: string) {
    setBusy(true);
    setError(null);
    const res = await deleteProgramApi(programId);
    if (!res.ok) {
      setError(
        "error" in res.data
          ? res.data.error
          : "Could not remove scheduled program.",
      );
    } else {
      await loadSchedule(selectedChannelId);
    }
    setBusy(false);
  }

  /* ── Bulk selection & delete — Video Library ───────── */

  function toggleVideoSelection(id: string) {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVideos() {
    if (selectedVideoIds.size === selectedChannelVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(selectedChannelVideos.map((v) => v.id)));
    }
  }

  function handleDeleteSelectedVideos() {
    if (selectedVideoIds.size === 0) return;
    setDeleteConfirm({ type: "selected", count: selectedVideoIds.size });
  }

  function handleDeleteAllVideos() {
    if (selectedChannelVideos.length === 0) return;
    setDeleteConfirm({ type: "all", count: selectedChannelVideos.length });
  }

  /* ── Content rating editor for legacy videos ─────────── */

  function openRatingEditor(video: ChannelVideo) {
    setRatingEditorVideo(video);
    setRatingEditorAge((video.age_classification as AgeClassification) ?? "teen");
    setRatingEditorFields({
      has_explicit_language: video.has_explicit_language ?? false,
      has_violence: video.has_violence ?? false,
      has_parental_guidance: video.has_parental_guidance ?? false,
      has_nudity: video.has_nudity ?? false,
      has_partial_nudity: video.has_partial_nudity ?? false,
      has_explicit_content: video.has_explicit_content ?? false,
      has_erotic_dancing: video.has_erotic_dancing ?? false,
      has_sexual_nature: video.has_sexual_nature ?? false,
      has_sex: video.has_sex ?? false,
      has_revealing_clothes: video.has_revealing_clothes ?? false,
    });
  }

  function closeRatingEditor() {
    setRatingEditorVideo(null);
    setRatingEditorSaving(false);
  }

  async function handleSaveContentRating() {
    if (!ratingEditorVideo) return;
    setRatingEditorSaving(true);
    setError(null);
    const res = await updateVideoContentRatingApi(ratingEditorVideo.id, {
      age_classification: ratingEditorAge,
      has_explicit_language: ratingEditorFields.has_explicit_language ?? false,
      has_nudity: ratingEditorFields.has_nudity ?? false,
      has_violence: ratingEditorFields.has_violence ?? false,
      has_revealing_clothes: ratingEditorFields.has_revealing_clothes ?? false,
      has_partial_nudity: ratingEditorFields.has_partial_nudity ?? false,
      has_explicit_content: ratingEditorFields.has_explicit_content ?? false,
      has_parental_guidance: ratingEditorFields.has_parental_guidance ?? false,
      has_erotic_dancing: ratingEditorFields.has_erotic_dancing ?? false,
      has_sexual_nature: ratingEditorFields.has_sexual_nature ?? false,
      has_sex: ratingEditorFields.has_sex ?? false,
    });
    setRatingEditorSaving(false);
    if (!res.ok || !("video" in res.data)) {
      setError("error" in res.data ? res.data.error : "Failed to update content rating");
      return;
    }
    closeRatingEditor();
    await loadStudio();
  }

  async function handleBatchSetContentRating() {
    const unrated = selectedChannelVideos.filter(
      (v) => selectedVideoIds.has(v.id) && (!v.age_classification || v.age_classification === null),
    );
    if (unrated.length === 0) {
      setError("No unrated videos selected.");
      return;
    }
    setBatchRatingSaving(true);
    setError(null);
    let failed = 0;
    for (const v of unrated) {
      const res = await updateVideoContentRatingApi(v.id, {
        age_classification: "teen",
        has_explicit_language: false,
        has_nudity: false,
        has_violence: false,
        has_revealing_clothes: false,
        has_partial_nudity: false,
        has_explicit_content: false,
        has_parental_guidance: false,
        has_erotic_dancing: false,
        has_sexual_nature: false,
        has_sex: false,
      });
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} video(s) could not be updated.`);
    setSelectedVideoIds(new Set());
    await loadStudio();
    setBatchRatingSaving(false);
  }

  async function handleRetryTranscode(videoId: string) {
    setRetryingTranscodeId(videoId);
    setError(null);
    const res = await retryVideoTranscodeApi(videoId);
    setRetryingTranscodeId(null);
    if (!res.ok || !("video" in res.data)) {
      setError("error" in res.data ? res.data.error : "Failed to retry transcoding.");
      return;
    }
    await loadStudio();
  }

  /* ── Bulk selection & delete — Scheduled Lineup ────── */

  function toggleProgramSelection(id: string) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPrograms() {
    if (selectedProgramIds.size === schedule.length) {
      setSelectedProgramIds(new Set());
    } else {
      setSelectedProgramIds(new Set(schedule.map((p) => p.id)));
    }
  }

  async function handleDeleteSelectedPrograms() {
    if (selectedProgramIds.size === 0) return;
    if (
      !window.confirm(
        `Remove ${selectedProgramIds.size} selected program${selectedProgramIds.size > 1 ? "s" : ""} from the schedule?`,
      )
    )
      return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const id of selectedProgramIds) {
      const res = await deleteProgramApi(id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} program(s) could not be removed.`);
    setSelectedProgramIds(new Set());
    await loadSchedule(selectedChannelId);
    setDeletingBulk(false);
  }

  async function handleDeleteAllPrograms() {
    if (schedule.length === 0) return;
    if (
      !window.confirm(
        `Remove ALL ${schedule.length} programs from the schedule? This cannot be undone.`,
      )
    )
      return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const p of schedule) {
      const res = await deleteProgramApi(p.id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} program(s) could not be removed.`);
    setSelectedProgramIds(new Set());
    await loadSchedule(selectedChannelId);
    setDeletingBulk(false);
  }

  async function handleCancelUploadSession(sessionId: string) {
    setCancelingSessionId(sessionId);
    const res = await cancelVideoUploadSessionApi(sessionId);
    setCancelingSessionId(null);

    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Failed to cancel upload session.");
      return;
    }

    await loadUploadSessions(selectedChannelId || undefined);
  }

  async function handleDeleteUploadSession(sessionId: string) {
    setDeletingSessionId(sessionId);
    const res = await deleteVideoUploadSessionApi(sessionId);
    setDeletingSessionId(null);

    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Failed to delete upload session.");
      return;
    }

    await loadUploadSessions(selectedChannelId || undefined);
  }

  /* ── derived ───────────────────────────────────────── */

  const pendingUploads = uploadEntries.filter((e) => e.progress === -1);
  const completedUploads = uploadEntries.filter((e) => e.progress === 101);
  const failedUploads = uploadEntries.filter((e) => !!e.error);
  const totalUploadDuration = uploadEntries.reduce(
    (s, e) => s + e.duration,
    0,
  );

  // ── Populate stream source fields when selectedChannelId changes ──
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const isContinuousUrlChannel = selectedChannel?.stream_source_mode === "external_url";

  /* ── External source handlers ──────────────────────── */

  async function handleExtValidateUrl() {
    const url = extSourceUrl.trim();
    if (extSourceMode === "native") {
      setExtUrlValidation({ ok: true, message: "Uploads mode is active. External URL is disabled." });
      return;
    }
    if (!url) return;
    if (extSourceMode === "external_url") {
      setExtUrlValidation({ ok: true, message: "URL accepted. Validation is not required for External URL mode." });
      return;
    }
    setExtValidating(true);
    setExtUrlValidation(null);
    const res = await resolveSourceApi(url);
    setExtValidating(false);
    if (res.ok && "stream_source_mode" in res.data) {
      setExtSourceMode(res.data.stream_source_mode);
      setExtUrlValidation({ ok: true, message: `Valid · ${res.data.stream_source_mode.replace("external_", "").toUpperCase()} · Status: ${res.data.stream_status}` });
    } else {
      const msg = "error" in res.data ? res.data.error : "URL could not be resolved.";
      setExtUrlValidation({ ok: false, message: msg });
    }
  }

  async function handleExtSave() {
    if (!selectedChannelId) return;
    setExtSaving(true);
    setError(null);
    const res = await updateExternalSourceApi(
      selectedChannelId,
      extSourceMode === "native"
        ? {
            stream_source_mode: "native",
            external_url: null,
            external_provider: null,
            resolved_playback_url: null,
            stream_status: "unknown",
            last_checked_at: null,
            provider_metadata: null,
          }
        : {
            stream_source_mode: extSourceMode,
            external_url: extSourceUrl.trim(),
          },
    );
    setExtSaving(false);
    if (res.ok && "channel" in res.data) {
      const updatedChannel = res.data.channel;
      setChannels((prev) => prev.map((c) => c.id === selectedChannelId ? updatedChannel : c));
      setExtUrlValidation({ ok: true, message: "Stream source saved successfully." });
    } else {
      setError("error" in res.data ? res.data.error : "Failed to save stream source.");
    }
  }

  async function handleExtRecheck() {
    if (!selectedChannelId) return;
    setExtRechecking(true);
    const res = await recheckStreamHealthApi(selectedChannelId);
    setExtRechecking(false);
    if (res.ok && "channel" in res.data) {
      const updatedChannel = res.data.channel;
      setChannels((prev) => prev.map((c) => c.id === selectedChannelId ? updatedChannel : c));
      const status = updatedChannel.stream_status ?? "unknown";
      setExtUrlValidation({ ok: true, message: `Stream health checked · Status: ${status}` });
    } else {
      setExtUrlValidation({ ok: false, message: "Health check failed. Try again." });
    }
  }

  function startChannelEdit(channel: Channel) {
    setEditingChannelId(channel.id);
    setEditChannelName(channel.name ?? "");
    setEditChannelDescription(channel.description ?? "");
    setEditChannelCategory(channel.category ?? "");
    setEditChannelLogoFile(null);
    setEditChannelBannerFile(null);
  }

  function cancelChannelEdit() {
    setEditingChannelId(null);
    setEditChannelName("");
    setEditChannelDescription("");
    setEditChannelCategory("");
    setEditChannelLogoFile(null);
    setEditChannelBannerFile(null);
  }

  async function saveChannelEdit(channelId: string) {
    const name = editChannelName.trim();
    const description = editChannelDescription.trim();
    const category = editChannelCategory.trim();

    if (!name || !description || !category) {
      setError("Channel name, description, and category are required.");
      return;
    }

    setSavingChannelEdit(true);
    setError(null);
    const res = await updateChannelApi(channelId, { name, description, category });

    if (!res.ok || !("channel" in res.data)) {
      setSavingChannelEdit(false);
      setError("error" in res.data ? res.data.error : "Failed to update channel details.");
      return;
    }

    let latestChannel = (res.data as { channel: Channel }).channel;

    if (editChannelLogoFile) {
      const logoRes = await uploadChannelMediaApi(channelId, "logo", editChannelLogoFile);
      if (!logoRes.ok || !('channel' in logoRes.data)) {
        setSavingChannelEdit(false);
        setError("error" in logoRes.data ? logoRes.data.error : "Saved text but failed to upload logo.");
        return;
      }
      latestChannel = logoRes.data.channel;
    }

    if (editChannelBannerFile) {
      const bannerRes = await uploadChannelMediaApi(channelId, "banner", editChannelBannerFile);
      if (!bannerRes.ok || !('channel' in bannerRes.data)) {
        setSavingChannelEdit(false);
        setError("error" in bannerRes.data ? bannerRes.data.error : "Saved channel but failed to upload cover image.");
        return;
      }
      latestChannel = bannerRes.data.channel;
    }

    setSavingChannelEdit(false);
    setChannels((prev) => prev.map((c) => (c.id === channelId ? latestChannel : c)));
    cancelChannelEdit();
  }

  async function handleDeleteChannel(channelId: string, channelName: string) {
    const confirmed = window.confirm(
      `Delete channel "${channelName}"? This will disable the channel and hide it from discovery.`,
    );
    if (!confirmed) return;

    setDeletingChannelId(channelId);
    setError(null);
    const res = await deleteChannelApi(channelId);
    setDeletingChannelId(null);

    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Failed to delete channel.");
      return;
    }

    const remaining = channels.filter((c) => c.id !== channelId);
    setChannels(remaining);

    if (selectedChannelId === channelId) {
      const nextChannelId = remaining[0]?.id ?? "";
      handleSelectChannel(nextChannelId);
      if (nextChannelId) {
        await loadSchedule(nextChannelId);
      } else {
        setSchedule([]);
      }
    }
  }

  /* ── guards ────────────────────────────────────────── */

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">
            Sign in to access Creator Studio.
          </p>
          <Link
            href="/login?redirect=/creator-studio"
            className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange"
          >
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (isMinor) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Creator Studio
          </p>
          <h1 className="mt-3 text-2xl font-bold text-av-white">
            Not available for minors
          </h1>
          <p className="mt-4 text-sm text-av-light-orange">
            Creator tools are restricted to users aged 18 and above. You can still enjoy general content and subscribe to viewer plans.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (user?.role === "viewer") {
    return (
      <main className="min-h-screen px-6 pb-16 pt-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Creator Studio
          </p>
          <h1 className="mt-3 text-3xl font-bold text-av-white">
            Creator access required
          </h1>
          <p className="mt-4 text-sm text-av-light-orange">
            Creator Studio is available to creator and admin accounts. Upgrade
            first, then come back here to publish channels and schedule
            broadcasts.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
            >
              Open profile
            </Link>
            <Link
              href="/create-channel"
              className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
            >
              Review channel setup
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── main UI ───────────────────────────────────────── */

  return (
    <>
      <title>Creator Studio — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
                Creator Studio
              </p>
              <h1 className="mt-2 text-3xl font-bold text-av-white">
                Broadcast Operations
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-av-light-orange">
                Manage channels, upload playback videos, and assemble the next
                scheduled stream block from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/creator-studio/ai-video"
                onClick={(event) =>
                  handleStudioNavigation(event, "/creator-studio/ai-video", "header-ai-video")
                }
                aria-disabled={navPendingKey !== null}
                className="inline-flex items-center gap-2 rounded-full border border-av-light-orange/35 bg-av-light-orange/10 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-light-orange/60 hover:text-av-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {navPendingKey === "header-ai-video" ? (
                  <>
                    <Spinner />
                    Opening...
                  </>
                ) : (
                  "AI Video Generator"
                )}
              </Link>
              <Link
                href="/creator-studio/library"
                onClick={(event) =>
                  handleStudioNavigation(event, "/creator-studio/library", "header-library")
                }
                aria-disabled={navPendingKey !== null}
                className="inline-flex items-center gap-2 rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {navPendingKey === "header-library" ? (
                  <>
                    <Spinner />
                    Opening...
                  </>
                ) : (
                  "Library Studio"
                )}
              </Link>
              <Link
                href="/create-channel"
                onClick={(event) =>
                  handleStudioNavigation(event, "/create-channel", "header-create")
                }
                aria-disabled={navPendingKey !== null}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {navPendingKey === "header-create" ? (
                  <>
                    <Spinner />
                    Opening...
                  </>
                ) : (
                  "Create channel"
                )}
              </Link>
              <Link
                href="/channels"
                onClick={(event) =>
                  handleStudioNavigation(event, "/channels", "header-discovery")
                }
                aria-disabled={navPendingKey !== null}
                className="inline-flex items-center gap-2 rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {navPendingKey === "header-discovery" ? (
                  <>
                    <Spinner />
                    Opening...
                  </>
                ) : (
                  "Discovery"
                )}
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-av-error/30 bg-av-error/5 p-4 text-sm text-av-error">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-10 text-center">
              <h2 className="text-2xl font-semibold text-av-white">
                No channels yet
              </h2>
              <p className="mt-3 text-sm text-av-light-orange">
                Start by creating your first channel, then return here to upload
                content and schedule programs.
              </p>
              <Link
                href="/create-channel"
                className="mt-6 inline-flex rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
              >
                Create your first channel
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="Channels" value={String(channels.length)} />
                <StatCard label="Videos" value={String(videos.length)} />
                <StatCard
                  label="Scheduled Slots"
                  value={String(schedule.length)}
                />
                <StatCard
                  label="Library Hours"
                  value={`${totalHours.toFixed(1)}h`}
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* ════ LEFT COLUMN — Channels & Upload ════ */}
                <section className="flex flex-col gap-6">
                  {/* Channel selector */}
                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Your channels
                      </h2>
                      <select
                        value={selectedChannelId}
                        onChange={(event) =>
                          handleSelectChannel(event.target.value)
                        }
                        className="h-10 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                      >
                        {channels.map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4 space-y-3">
                      {pagedChannels.map((channel) => (
                        <div
                          key={channel.id}
                          className={`rounded-2xl border p-4 ${channel.id === selectedChannelId ? "border-av-orange/40 bg-av-input-fill/60" : "border-av-input-border/20 bg-av-input-fill/20"}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-av-white">
                                {channel.name}
                              </p>
                              <p className="mt-1 text-xs text-av-light-orange">
                                #{channel.channel_number} · {channel.type} ·{" "}
                                {channel.category}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startChannelEdit(channel)}
                                disabled={deletingChannelId === channel.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {editingChannelId === channel.id ? "Editing" : "Edit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(channel.id, channel.name)}
                                disabled={deletingChannelId === channel.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                {deletingChannelId === channel.id ? (
                                  <>
                                    <Spinner size="xs" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete"
                                )}
                              </button>
                              <Link
                                href={`/channel/${channel.id}`}
                                onClick={(event) =>
                                  handleStudioNavigation(event, `/channel/${channel.id}`, `channel-link-${channel.id}`)
                                }
                                aria-disabled={navPendingKey !== null}
                                className="inline-flex items-center gap-1.5 rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange aria-disabled:pointer-events-none aria-disabled:opacity-60"
                              >
                                {navPendingKey === `channel-link-${channel.id}` ? (
                                  <>
                                    <Spinner size="xs" />
                                    Opening...
                                  </>
                                ) : (
                                  "Channel"
                                )}
                              </Link>
                              <Link
                                href={`/live/${channel.id}`}
                                onClick={(event) =>
                                  handleStudioNavigation(event, `/live/${channel.id}`, `live-link-${channel.id}`)
                                }
                                aria-disabled={navPendingKey !== null}
                                className="inline-flex items-center gap-1.5 rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1.5 text-xs font-semibold text-av-orange aria-disabled:pointer-events-none aria-disabled:opacity-60"
                              >
                                {navPendingKey === `live-link-${channel.id}` ? (
                                  <>
                                    <Spinner size="xs" />
                                    Opening...
                                  </>
                                ) : (
                                  "Live page"
                                )}
                              </Link>
                              <Link
                                href={`/channel-analytics?channel_id=${channel.id}`}
                                onClick={(event) =>
                                  handleStudioNavigation(
                                    event,
                                    `/channel-analytics?channel_id=${channel.id}`,
                                    `analytics-link-${channel.id}`,
                                  )
                                }
                                aria-disabled={navPendingKey !== null}
                                className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400 aria-disabled:pointer-events-none aria-disabled:opacity-60"
                              >
                                {navPendingKey === `analytics-link-${channel.id}` ? (
                                  <>
                                    <Spinner size="xs" />
                                    Opening...
                                  </>
                                ) : (
                                  "Analytics"
                                )}
                              </Link>
                            </div>
                          </div>

                          {editingChannelId === channel.id && (
                            <div className="mt-4 space-y-3 rounded-xl border border-av-input-border/20 bg-av-input-fill/20 p-3">
                              <input
                                value={editChannelName}
                                onChange={(e) => setEditChannelName(e.target.value)}
                                maxLength={100}
                                placeholder="Channel name"
                                className="h-10 w-full rounded-lg border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                              />
                              <textarea
                                value={editChannelDescription}
                                onChange={(e) => setEditChannelDescription(e.target.value)}
                                rows={3}
                                maxLength={2000}
                                placeholder="Description"
                                className="w-full rounded-lg border border-av-input-border/30 bg-av-input-fill px-3 py-2 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                              />
                              <input
                                value={editChannelCategory}
                                onChange={(e) => setEditChannelCategory(e.target.value)}
                                placeholder="Category"
                                className="h-10 w-full rounded-lg border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                              />
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="rounded-lg border border-av-input-border/30 bg-av-input-fill/20 p-3 text-xs text-av-light-orange">
                                  <p className="mb-2 font-semibold text-av-white">Channel logo</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditChannelLogoFile(e.target.files?.[0] ?? null)}
                                    className="w-full text-[11px]"
                                  />
                                  {channel.logo_url ? (
                                    <Image
                                      src={resolveWebsiteMediaUrl(channel.logo_url)}
                                      alt={`${channel.name} logo`}
                                      width={56}
                                      height={56}
                                      unoptimized
                                      className="mt-2 h-14 w-14 rounded-md border border-av-input-border/30 object-cover"
                                    />
                                  ) : null}
                                  {editChannelLogoFile ? <p className="mt-1 text-[10px] text-cyan-300">New file: {editChannelLogoFile.name}</p> : null}
                                </label>

                                <label className="rounded-lg border border-av-input-border/30 bg-av-input-fill/20 p-3 text-xs text-av-light-orange">
                                  <p className="mb-2 font-semibold text-av-white">Cover image</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditChannelBannerFile(e.target.files?.[0] ?? null)}
                                    className="w-full text-[11px]"
                                  />
                                  {channel.banner_url ? (
                                    <Image
                                      src={resolveWebsiteMediaUrl(channel.banner_url)}
                                      alt={`${channel.name} cover`}
                                      width={320}
                                      height={56}
                                      unoptimized
                                      className="mt-2 h-14 w-full rounded-md border border-av-input-border/30 object-cover"
                                    />
                                  ) : null}
                                  {editChannelBannerFile ? <p className="mt-1 text-[10px] text-cyan-300">New file: {editChannelBannerFile.name}</p> : null}
                                </label>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelChannelEdit}
                                  className="rounded-lg border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveChannelEdit(channel.id)}
                                  disabled={savingChannelEdit}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-av-orange to-av-light-orange px-3 py-1.5 text-xs font-semibold text-av-dark-blue disabled:opacity-60"
                                >
                                  {savingChannelEdit ? (
                                    <>
                                      <Spinner size="xs" />
                                      Saving...
                                    </>
                                  ) : (
                                    "Save changes"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {channels.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between rounded-2xl border border-av-input-border/20 bg-av-input-fill/20 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setChannelsPaging("prev");
                              setChannelsPage((prev) => Math.max(1, prev - 1));
                              window.setTimeout(() => setChannelsPaging(null), 250);
                            }}
                            disabled={clampedChannelsPage === 1 || channelsPaging !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange transition-colors hover:border-av-orange/40 hover:text-av-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {channelsPaging === "prev" ? (
                              <>
                                <Spinner size="xs" />
                                Loading...
                              </>
                            ) : (
                              "Previous"
                            )}
                          </button>
                          <p className="text-xs text-av-light-orange">
                            Page {clampedChannelsPage} of {channelsPageCount}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setChannelsPaging("next");
                              setChannelsPage((prev) => Math.min(channelsPageCount, prev + 1));
                              window.setTimeout(() => setChannelsPaging(null), 250);
                            }}
                            disabled={clampedChannelsPage === channelsPageCount || channelsPaging !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange transition-colors hover:border-av-orange/40 hover:text-av-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {channelsPaging === "next" ? (
                              <>
                                <Spinner size="xs" />
                                Loading...
                              </>
                            ) : (
                              "Next"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Stream source editor (AV-STR-003) ── */}
                  {selectedChannelId && (
                    <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                      <h2 className="mb-4 text-lg font-semibold text-av-white">Stream Source</h2>

                      {/* Current status badge */}
                      {selectedChannel?.stream_source_mode && selectedChannel.stream_source_mode !== "native" && (
                        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                          selectedChannel.stream_status === "live" ? "border-green-500/40 bg-green-500/10 text-green-400"
                          : selectedChannel.stream_status === "offline" || selectedChannel.stream_status === "invalid" ? "border-red-500/40 bg-red-500/10 text-red-400"
                          : "border-av-orange/30 bg-av-orange/10 text-av-orange"
                        }`}>
                          <span className="uppercase tracking-wide">{selectedChannel.stream_status ?? "UNKNOWN"}</span>
                          <span className="text-av-light-orange">·</span>
                          <span className="text-av-light-orange">{selectedChannel.stream_source_mode.replace("external_", "").toUpperCase()}</span>
                          {selectedChannel.last_checked_at && (
                            <><span className="text-av-light-orange">·</span><span className="text-av-light-orange opacity-60">checked {formatTimeAgo(selectedChannel.last_checked_at)}</span></>
                          )}
                        </div>
                      )}

                      {/* Source mode selector */}
                      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {(["native", "external_url", "external_youtube", "external_hls", "external_dash"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setExtSourceMode(mode);
                              if (mode === "native") setExtSourceUrl("");
                              setExtUrlValidation(null);
                            }}
                            className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                              extSourceMode === mode
                                ? "border-av-orange/60 bg-av-orange/10 text-av-white font-bold"
                                : "border-av-input-border/30 text-av-light-orange hover:border-av-orange/30"
                            }`}
                          >
                            {mode === "native" ? "Uploads" : mode === "external_url" ? "External URL" : mode === "external_youtube" ? "YouTube Live" : mode === "external_hls" ? "HLS Stream" : "DASH Stream"}
                          </button>
                        ))}
                      </div>

                      {/* URL input */}
                      <div className="mb-4">
                        {extSourceMode === "native" ? (
                          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
                            Uploads mode selected. External link source will be cleared when you save.
                          </div>
                        ) : (
                          <>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-av-light-orange">
                              {extSourceMode === "external_url" ? "External URL" : extSourceMode === "external_youtube" ? "YouTube URL" : extSourceMode === "external_hls" ? "HLS Manifest URL (.m3u8)" : "DASH Manifest URL (.mpd)"}
                            </p>
                            <div className="flex gap-2">
                              <input
                                value={extSourceUrl}
                                onChange={(e) => { setExtSourceUrl(e.target.value); setExtUrlValidation(null); }}
                                placeholder={extSourceMode === "external_url" ? "https://example.com/live/channel-link" : extSourceMode === "external_youtube" ? "https://www.youtube.com/watch?v=..." : "https://example.com/stream.m3u8"}
                                className="h-10 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                              />
                              {extSourceMode !== "external_url" && (
                                <button
                                  type="button"
                                  onClick={handleExtValidateUrl}
                                  disabled={extValidating || !extSourceUrl.trim()}
                                  className="h-10 rounded-xl border border-av-orange/30 bg-av-orange/10 px-3 text-xs font-bold text-av-orange hover:bg-av-orange/20 disabled:opacity-40"
                                >
                                  {extValidating ? "…" : "Validate"}
                                </button>
                              )}
                            </div>
                            {extUrlValidation && (
                              <p className={`mt-1.5 text-xs ${extUrlValidation.ok ? "text-green-400" : "text-red-400"}`}>
                                {extUrlValidation.ok ? "✓" : "✗"} {extUrlValidation.message}
                              </p>
                            )}
                            <p className="mt-1.5 text-[10px] text-av-light-orange/60">
                              {extSourceMode === "external_url"
                                ? "External URL mode accepts simple links directly with no strict validation."
                                : "Use Validate to classify and check source health before saving."}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleExtSave}
                          disabled={extSaving}
                          className="flex-1 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-50"
                        >
                          {extSaving ? "Saving…" : "Save stream source"}
                        </button>
                        {selectedChannel?.stream_source_mode && selectedChannel.stream_source_mode !== "native" && (
                          <button
                            type="button"
                            onClick={handleExtRecheck}
                            disabled={extRechecking}
                            className="rounded-xl border border-av-input-border/30 px-4 py-2.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white disabled:opacity-40"
                          >
                            {extRechecking ? "Checking…" : "Recheck"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Multi-upload form ── */}
                  <div className="flex-1 rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Upload videos
                      </h2>
                      {uploadEntries.length > 0 && (
                        <span className="text-xs text-av-light-orange">
                          {uploadEntries.length} file
                          {uploadEntries.length > 1 ? "s" : ""} ·{" "}
                          {formatDuration(totalUploadDuration)}
                        </span>
                      )}
                    </div>

                    {isContinuousUrlChannel && (
                      <div className="mb-4 rounded-2xl border border-av-orange/25 bg-av-orange/8 p-4">
                        <p className="text-sm font-semibold text-av-white">Continuous External URL mode is active</p>
                        <p className="mt-1 text-xs text-av-light-orange">
                          Uploads and storage-backed scheduling are disabled for this channel. The stream runs directly from your external URL.
                        </p>
                      </div>
                    )}

                    {uploadNotice && (
                      <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
                        <p className="text-xs text-green-300">{uploadNotice}</p>
                      </div>
                    )}

                    {recentUploadSessions.length > 0 && (
                      <div className="mb-4 rounded-2xl border border-av-input-border/25 bg-av-input-fill/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-av-light-orange">
                            Upload Session Status
                          </p>
                          <button
                            type="button"
                            onClick={() => void loadUploadSessions(selectedChannelId)}
                            disabled={loadingUploadSessions}
                            className="rounded-lg border border-av-input-border/30 px-2.5 py-1 text-[10px] font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white disabled:opacity-40"
                          >
                            {loadingUploadSessions ? "Refreshing..." : "Refresh"}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {recentUploadSessions.slice(0, 6).map((session) => (
                            <div key={session.id} className="flex items-center justify-between rounded-xl border border-av-input-border/20 bg-av-input-fill/20 px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-av-white">{session.title}</p>
                                <p className="text-[10px] text-av-light-orange/70">
                                  {session.total_bytes > 0
                                    ? `${Math.round((session.uploaded_bytes / session.total_bytes) * 100)}% uploaded`
                                    : "Processing"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  session.status === "completed"
                                    ? "bg-green-500/15 text-green-400"
                                    : session.status === "failed"
                                      ? "bg-red-500/15 text-red-300"
                                      : session.status === "canceled"
                                        ? "bg-slate-500/20 text-slate-300"
                                        : session.status === "finalizing"
                                          ? "bg-cyan-500/20 text-cyan-300"
                                          : "bg-av-orange/15 text-av-orange"
                                }`}>
                                  {session.status}
                                </span>
                                {session.status !== "completed" && session.status !== "canceled" && session.status !== "finalizing" ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleCancelUploadSession(session.id)}
                                    disabled={cancelingSessionId === session.id}
                                    className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                                  >
                                    {cancelingSessionId === session.id ? "..." : "Cancel"}
                                  </button>
                                ) : null}
                                {session.status === "failed" || session.status === "canceled" || session.status === "completed" ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteUploadSession(session.id)}
                                    disabled={deletingSessionId === session.id}
                                    className="rounded-md border border-av-input-border/35 bg-av-input-fill/30 px-2 py-0.5 text-[10px] font-semibold text-av-light-orange hover:border-av-orange/35 hover:text-av-white disabled:opacity-50"
                                  >
                                    {deletingSessionId === session.id ? "..." : "Delete"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interrupted upload sessions — resume banner */}
                    {interruptedSessions.length > 0 && (
                      <div className="mb-4 rounded-2xl border border-av-orange/30 bg-av-orange/10 p-4">
                        <p className="text-sm font-semibold text-av-white">Interrupted uploads detected</p>
                        <p className="mt-1 text-xs text-av-light-orange">Re-select the original file to resume from where it left off.</p>
                        <div className="mt-3 space-y-2">
                          {interruptedSessions.map((s) => (
                            <div key={s.sessionId} className="flex items-center justify-between rounded-lg border border-av-input-border/20 bg-av-input-fill/30 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-av-white">{s.title || s.fileName}</p>
                                <p className="text-[10px] text-av-light-orange/70">{(s.fileSize / 1024 / 1024).toFixed(1)} MB · {new Date(s.createdAt).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    resumeTargetRef.current = s;
                                    resumeFileInputRef.current?.click();
                                  }}
                                  className="rounded-md bg-av-orange/20 px-3 py-1 text-[11px] font-semibold text-av-orange transition-all hover:bg-av-orange/30"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeUploadSession(s.sessionId);
                                    setInterruptedSessions((prev) => prev.filter((x) => x.sessionId !== s.sessionId));
                                  }}
                                  className="rounded-md bg-av-error/10 px-2 py-1 text-[11px] text-av-error transition-all hover:bg-av-error/20"
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <input
                          ref={resumeFileInputRef}
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={(e) => handleResumeFileSelected(e.target.files)}
                        />
                      </div>
                    )}

                    {/* File picker */}
                    {!isContinuousUrlChannel && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/webm"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFilesSelected(e.target.files)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAll}
                          className="w-full rounded-2xl border-2 border-dashed border-av-input-border/40 bg-av-input-fill/20 py-8 text-center transition-all hover:border-av-orange/40 hover:bg-av-input-fill/30 disabled:opacity-50"
                        >
                          <svg
                            className="mx-auto mb-2 h-8 w-8 text-av-light-orange"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.467 3.856A4.498 4.498 0 0118 19.5H6.75z"
                            />
                          </svg>
                          <p className="text-sm font-semibold text-av-white">
                            Select video files
                          </p>
                          <p className="mt-1 text-xs text-av-light-orange">
                            Choose multiple files at once · MP4 or WebM only · Duration auto-detected
                          </p>
                          <p className="mt-1 text-[11px] text-av-light-orange/80">
                            Re-selecting the same file resumes its existing upload session when available.
                          </p>
                        </button>
                      </>
                    )}

                    {/* File list — drag to reorder */}
                    {!isContinuousUrlChannel && uploadEntries.length > 0 && (
                      <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                        {uploadEntries.map((entry, index) => (
                          <div
                            key={entry.id}
                            draggable={!uploadingAll}
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={`rounded-2xl border p-4 transition-all ${
                              entry.progress === 101
                                ? "border-green-500/30 bg-green-500/5"
                                : entry.error
                                  ? "border-av-error/30 bg-av-error/5"
                                  : "border-av-input-border/20 bg-av-input-fill/30"
                            } ${!uploadingAll ? "cursor-grab active:cursor-grabbing" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Drag handle */}
                              <div className="flex-shrink-0 pt-1 text-av-light-orange">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <circle cx="8" cy="4" r="2" />
                                  <circle cx="16" cy="4" r="2" />
                                  <circle cx="8" cy="12" r="2" />
                                  <circle cx="16" cy="12" r="2" />
                                  <circle cx="8" cy="20" r="2" />
                                  <circle cx="16" cy="20" r="2" />
                                </svg>
                              </div>

                              {/* Order number */}
                              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-av-orange/20 text-xs font-bold text-av-orange">
                                {index + 1}
                              </span>

                              {/* Content */}
                              <div className="min-w-0 flex-1">
                                <input
                                  value={entry.title}
                                  onChange={(e) =>
                                    updateEntry(entry.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  disabled={entry.progress > -1}
                                  className="w-full bg-transparent text-sm font-semibold text-av-white placeholder:text-av-light-orange focus:outline-none disabled:opacity-80"
                                  placeholder="Video title"
                                />
                                <textarea
                                  value={entry.description}
                                  onChange={(e) =>
                                    updateEntry(entry.id, {
                                      description: e.target.value,
                                    })
                                  }
                                  disabled={entry.progress > -1}
                                  rows={2}
                                  className="mt-1.5 w-full resize-none rounded-lg border border-av-input-border/20 bg-av-input-fill/30 px-2.5 py-1.5 text-xs text-av-white placeholder:text-av-light-orange focus:border-av-orange/40 focus:outline-none disabled:opacity-80"
                                  placeholder="Brief description (required)"
                                />
                                <div className="mt-1 flex items-center gap-3">
                                  <span className="text-xs text-av-light-orange">
                                    {entry.detecting ? (
                                      <span className="animate-pulse">
                                        Detecting duration...
                                      </span>
                                    ) : (
                                      formatDuration(entry.duration)
                                    )}
                                  </span>
                                  <span className="text-xs text-av-light-orange">
                                    {(
                                      entry.file.size /
                                      (1024 * 1024)
                                    ).toFixed(1)}{" "}
                                    MB
                                  </span>
                                  {entry.progress === 101 && (
                                    <span className="text-xs font-semibold text-green-400">
                                      ✓ Uploaded
                                    </span>
                                  )}
                                  {entry.error && (
                                    <span className="text-xs text-av-error">
                                      {entry.error}
                                    </span>
                                  )}
                                </div>

                                {entry.progress === -1 && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <label className="text-[11px] text-av-light-orange/90">Duration (seconds)</label>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={entry.duration > 0 ? String(entry.duration) : ""}
                                      onChange={(e) =>
                                        updateEntry(entry.id, {
                                          duration: parseDurationInput(e.target.value),
                                          error: null,
                                        })
                                      }
                                      className="h-8 w-28 rounded-md border border-av-input-border/35 bg-av-input-fill/40 px-2 text-xs text-av-white focus:border-av-orange/40 focus:outline-none"
                                      placeholder="e.g. 540"
                                    />
                                    <span className="text-[11px] text-av-light-orange/70">Required for auto scheduling</span>
                                  </div>
                                )}

                                {/* Content rating */}
                                {entry.progress === -1 && (
                                  <div className="mt-2 rounded-lg border border-av-input-border/20 bg-av-input-fill/20 p-2.5">
                                    <label className="text-[11px] font-semibold text-av-light-orange/90">Content Rating</label>
                                    <select
                                      value={entry.ageClassification}
                                      onChange={(e) => {
                                        const newAc = e.target.value as AgeClassification;
                                        updateEntry(entry.id, { ageClassification: newAc });
                                        if (newAc !== "adult") {
                                          updateEntry(entry.id, {
                                            ageClassification: newAc,
                                            hasNudity: false,
                                            hasPartialNudity: false,
                                            hasExplicitContent: false,
                                            hasEroticDancing: false,
                                            hasSexualNature: false,
                                            hasSex: false,
                                            hasRevealingClothes: false,
                                          });
                                        }
                                      }}
                                      className="mt-1 h-8 w-full rounded-md border border-av-input-border/35 bg-av-input-fill/40 px-2 text-xs text-av-white focus:border-av-orange/40 focus:outline-none"
                                    >
                                      {(selectedChannel?.type === "public" ? PUBLIC_CLASSIFICATION_OPTIONS : CLASSIFICATION_OPTIONS).map((opt) => (
                                        <option key={opt.value} value={opt.value} style={{ background: "#050A30" }}>
                                          {opt.label} - {opt.hint}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedChannel?.type === "public" && (
                                      <p className="mt-1 text-[10px] text-av-light-orange/60">
                                        Public channels cannot upload 18+ content.
                                      </p>
                                    )}
                                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                      {GENERAL_CONTENT_FIELDS.map((field) => {
                                        const keyMap: Record<string, keyof UploadEntry> = {
                                          has_explicit_language: "hasExplicitLanguage",
                                          has_violence: "hasViolence",
                                          has_parental_guidance: "hasParentalGuidance",
                                        };
                                        const entryKey = keyMap[field.key] ?? (field.key as keyof UploadEntry);
                                        return (
                                        <label key={String(field.key)} className="flex items-center gap-1.5 text-[11px] text-av-white/70">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(entry[entryKey])}
                                            onChange={(e) => updateEntry(entry.id, { [entryKey]: e.target.checked } as Partial<UploadEntry>)}
                                            className="h-3 w-3 accent-av-orange"
                                          />
                                          {field.label}
                                        </label>
                                        );
                                      })}
                                      {entry.ageClassification === "adult" &&
                                        ADULT_SENSITIVE_FIELDS.map((field) => {
                                          const keyMap: Record<string, keyof UploadEntry> = {
                                            has_nudity: "hasNudity",
                                            has_partial_nudity: "hasPartialNudity",
                                            has_explicit_content: "hasExplicitContent",
                                            has_erotic_dancing: "hasEroticDancing",
                                            has_sexual_nature: "hasSexualNature",
                                            has_sex: "hasSex",
                                            has_revealing_clothes: "hasRevealingClothes",
                                          };
                                          const entryKey = keyMap[field.key] ?? (field.key as keyof UploadEntry);
                                          return (
                                          <label key={String(field.key)} className="flex items-center gap-1.5 text-[11px] text-av-white/70">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(entry[entryKey])}
                                              onChange={(e) => updateEntry(entry.id, { [entryKey]: e.target.checked } as Partial<UploadEntry>)}
                                              className="h-3 w-3 accent-av-orange"
                                            />
                                            {field.label}
                                          </label>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}

                                {/* Progress bar */}
                                {entry.progress >= 0 &&
                                  entry.progress <= 100 && (
                                    <div className="mt-2">
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-av-input-fill">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-200 ease-out"
                                          style={{
                                            width: `${entry.progress}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="mt-1 flex items-center justify-between">
                                        <p className="text-[10px] text-av-light-orange">
                                          {entry.paused
                                            ? "Paused"
                                            : entry.retrying
                                              ? entry.error
                                              : entry.progress < 100
                                                ? `Uploading ${entry.progress}%${entry.uploadSpeed > 0 ? ` · ${(entry.uploadSpeed / 1024 / 1024).toFixed(1)} MB/s` : ""}`
                                                : "Registering..."}
                                        </p>
                                        {entry.sessionId && (
                                          <div className="flex items-center gap-1.5">
                                            {entry.paused ? (
                                              <button
                                                onClick={() => handleResumeUpload(entry.id)}
                                                className="rounded-md bg-av-orange/20 px-2 py-0.5 text-[10px] font-semibold text-av-orange transition-all hover:bg-av-orange/30"
                                              >
                                                Resume
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() => handlePauseUpload(entry.id)}
                                                className="rounded-md bg-av-input-fill/40 px-2 py-0.5 text-[10px] font-semibold text-av-light-orange transition-all hover:bg-av-input-fill/60"
                                              >
                                                Pause
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>

                              {/* Remove button */}
                              {entry.progress === -1 && (
                                <button
                                  onClick={() => removeEntry(entry.id)}
                                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-av-error/10 text-av-error transition-all hover:bg-av-error/20"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Upload all button */}
                        {pendingUploads.length > 0 && (
                          <button
                            type="button"
                            onClick={handleUploadAll}
                            disabled={uploadingAll || !selectedChannelId || pendingUploads.some((e) => !e.description.trim() || e.detecting || e.duration <= 0)}
                            className="mt-3 w-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                          >
                            {uploadingAll ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                Uploading...
                              </span>
                            ) : (
                              `Upload ${pendingUploads.length} video${pendingUploads.length > 1 ? "s" : ""} to library`
                            )}
                          </button>
                        )}

                        {(failedUploads.length > 0 || completedUploads.length > 0) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {failedUploads.length > 0 && (
                              <button
                                type="button"
                                onClick={retryFailedEntries}
                                disabled={uploadingAll}
                                className="rounded-full border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-xs font-semibold text-av-orange hover:bg-av-orange/20 disabled:opacity-50"
                              >
                                Retry failed ({failedUploads.length})
                              </button>
                            )}
                            {completedUploads.length > 0 && (
                              <button
                                type="button"
                                onClick={clearCompletedEntries}
                                disabled={uploadingAll}
                                className="rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white disabled:opacity-50"
                              >
                                Clear completed ({completedUploads.length})
                              </button>
                            )}
                          </div>
                        )}

                        {/* Auto-schedule panel (appears after uploads complete) */}
                        {showAutoSchedule && completedUploads.length > 0 && (
                          <div className="mt-3 rounded-2xl border border-av-orange/30 bg-av-orange/5 p-5">
                            <h3 className="mb-1 text-sm font-semibold text-av-white">
                              Auto-schedule uploads
                            </h3>
                            <p className="mb-4 text-xs text-av-light-orange">
                              Schedule all {completedUploads.length} uploaded
                              video
                              {completedUploads.length > 1
                                ? "s"
                                : ""}{" "}
                              back-to-back. Total runtime:{" "}
                              {formatDuration(
                                completedUploads.reduce(
                                  (s, e) => s + e.duration,
                                  0,
                                ),
                              )}
                              .
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <input
                                type="datetime-local"
                                value={autoScheduleStart}
                                min={toDateTimeLocal(
                                  new Date().toISOString(),
                                )}
                                onChange={(e) =>
                                  setAutoScheduleStart(e.target.value)
                                }
                                className="h-11 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleAutoSchedule}
                                disabled={schedulingBulk || !autoScheduleStart}
                                className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                              >
                                {schedulingBulk
                                  ? "Scheduling..."
                                  : "Schedule all"}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAutoSchedule(false);
                                setUploadEntries([]);
                              }}
                              className="mt-2 text-xs text-av-light-orange transition-colors hover:text-av-white"
                            >
                              Skip — I&apos;ll schedule manually
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* ════ RIGHT COLUMN — Playback State + Broadcast Schedule ════ */}
                <section className="flex flex-col gap-6">
                  <PlaybackStateCard
                    playbackState={playbackState}
                    selectedChannel={selectedChannel}
                    schedule={schedule}
                  />

                  <div className="flex flex-1 flex-col rounded-3xl border border-av-input-border/30 bg-av-card">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-av-input-border/15 px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-av-light-orange/15">
                          <svg className="h-5 w-5 text-av-light-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-av-white">
                            Broadcast Schedule
                          </h2>
                          <p className="text-xs text-av-light-orange">
                            {isContinuousUrlChannel
                              ? "Continuous URL mode does not use schedule"
                              : `${schedule.length} scheduled slot${schedule.length !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Schedule Form */}
                    {isContinuousUrlChannel ? (
                      <div className="border-b border-av-input-border/10 px-6 py-4">
                        <p className="text-xs text-av-light-orange">
                          This channel streams continuously from an external URL. Video program scheduling is disabled.
                        </p>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleSchedule}
                        className="border-b border-av-input-border/10 px-6 py-4"
                      >
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange">
                          Add to schedule
                        </p>
                        <div className="space-y-2">
                          <select
                            value={scheduleVideoId}
                            onChange={(event) =>
                              setScheduleVideoId(event.target.value)
                            }
                            className="h-10 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                          >
                            <option value="">Select video</option>
                            {selectedChannelVideos.map((video) => (
                              <option key={video.id} value={video.id}>
                                {video.title} ({formatDuration(video.duration)})
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="datetime-local"
                              value={scheduleStart}
                              min={toDateTimeLocal(new Date().toISOString())}
                              onChange={(event) =>
                                setScheduleStart(event.target.value)
                              }
                              className="h-10 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={busy || selectedChannelVideos.length === 0}
                              className="h-10 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                            >
                              {busy ? "..." : "Add"}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Management Toolbar */}
                    {!isContinuousUrlChannel && schedule.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 border-b border-av-input-border/10 px-6 py-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-av-light-orange transition-colors hover:text-av-white">
                          <input
                            type="checkbox"
                            checked={selectedProgramIds.size === schedule.length && schedule.length > 0}
                            onChange={toggleAllPrograms}
                            className="h-4 w-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange accent-[#F49617]"
                          />
                          Select all
                        </label>
                        <div className="mx-1 h-4 w-px bg-av-input-border/20" />
                        {selectedProgramIds.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteSelectedPrograms}
                            disabled={deletingBulk}
                            className="rounded-lg border border-av-error/30 bg-av-error/10 px-3 py-1 text-[11px] font-semibold text-av-error transition-all hover:bg-av-error/20 disabled:opacity-50"
                          >
                            Remove selected ({selectedProgramIds.size})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDeleteAllPrograms}
                          disabled={deletingBulk}
                          className="rounded-lg border border-av-error/20 bg-av-error/5 px-3 py-1 text-[11px] font-semibold text-av-error/70 transition-all hover:bg-av-error/15 hover:text-av-error disabled:opacity-50"
                        >
                          Clear all
                        </button>
                        {deletingBulk && (
                          <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
                        )}
                      </div>
                    )}

                    {/* Schedule list */}
                    <div className="flex-1 px-6 py-4">
                      {isContinuousUrlChannel ? (
                        <p className="py-6 text-center text-sm text-av-light-orange">
                          Continuous External URL channels do not have broadcast slots.
                        </p>
                      ) : schedule.length === 0 ? (
                        <p className="py-6 text-center text-sm text-av-light-orange">
                          No programs scheduled for this channel yet.
                        </p>
                      ) : (
                        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                          {pagedSchedule.map((item, idx) => {
                            const videoMissing = !selectedChannelVideos.some(
                              (v) => v.id === item.video_id,
                            );
                            return (
                              <div
                                key={item.id}
                                className={`group rounded-2xl border p-4 transition-all ${
                                  selectedProgramIds.has(item.id)
                                    ? "border-av-light-orange/40 bg-av-light-orange/5"
                                    : videoMissing
                                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500/60"
                                      : "border-av-input-border/20 bg-av-input-fill/30 hover:border-av-input-border/40"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedProgramIds.has(item.id)}
                                    onChange={() =>
                                      toggleProgramSelection(item.id)
                                    }
                                    className="h-4 w-4 flex-shrink-0 rounded border-av-input-border/40 bg-av-input-fill text-av-orange accent-[#F49617]"
                                  />
                                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-av-light-orange/20 text-[10px] font-bold text-av-light-orange">
                                    {(clampedSchedulePage - 1) * ITEMS_PER_PAGE + idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-av-white">
                                      {item.video_title}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-av-light-orange">
                                      {formatTimestamp(item.start_time)} →{" "}
                                      {formatTimestamp(item.end_time)}
                                    </p>
                                    {videoMissing && (
                                      <p className="mt-1 text-[11px] font-semibold text-red-400">
                                        Scheduled video missing — upload or re-schedule
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteProgram(item.id)}
                                    disabled={busy || deletingBulk}
                                    className="flex-shrink-0 rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error opacity-0 transition-all hover:bg-av-error/20 group-hover:opacity-100 disabled:opacity-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {schedule.length > ITEMS_PER_PAGE && (
                            <div className="mt-3 flex items-center justify-between rounded-2xl border border-av-input-border/20 bg-av-input-fill/20 px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setSchedulePage((prev) => Math.max(1, prev - 1))}
                                disabled={clampedSchedulePage === 1}
                                className="rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange transition-colors hover:border-av-orange/40 hover:text-av-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Previous
                              </button>
                              <p className="text-xs text-av-light-orange">
                                Page {clampedSchedulePage} of {schedulePageCount}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setSchedulePage((prev) => Math.min(schedulePageCount, prev + 1))
                                }
                                disabled={clampedSchedulePage === schedulePageCount}
                                className="rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange transition-colors hover:border-av-orange/40 hover:text-av-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* ════ FULL-WIDTH ROW — Content Library ════ */}
              <div className="mt-6 rounded-3xl border border-av-input-border/30 bg-av-card">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-av-input-border/15 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-av-orange/15">
                      <svg className="h-5 w-5 text-av-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5a1.125 1.125 0 01-1.125-1.125m8.625-12.75h-17.25" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-av-white">
                        Content Library
                      </h2>
                      <p className="text-xs text-av-light-orange">
                        {selectedChannelVideos.length} video{selectedChannelVideos.length !== 1 ? "s" : ""} for this channel
                      </p>
                    </div>
                  </div>

                  {/* Auto-schedule library trigger */}
                  {selectedChannelVideos.length >= 2 && (
                    <div className="flex items-center gap-3">
                      <p className="hidden text-xs text-av-light-orange sm:block">
                        {selectedChannelVideos.length} videos ·{" "}
                        {formatDuration(
                          selectedChannelVideos.reduce(
                            (s, v) => s + v.duration,
                            0,
                          ),
                        )}
                      </p>
                      <input
                        type="datetime-local"
                        value={libraryAutoStart}
                        min={toDateTimeLocal(new Date().toISOString())}
                        onChange={(e) => setLibraryAutoStart(e.target.value)}
                        className="h-9 rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 text-xs text-av-white focus:border-av-orange/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAutoScheduleLibrary}
                        disabled={schedulingLibrary || !libraryAutoStart}
                        className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-xs font-semibold text-av-dark-blue disabled:opacity-60"
                      >
                        {schedulingLibrary
                          ? "Scheduling..."
                          : "Auto-schedule all"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Management Toolbar */}
                {selectedChannelVideos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-av-input-border/10 px-6 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-av-light-orange transition-colors hover:text-av-white">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.size === selectedChannelVideos.length && selectedChannelVideos.length > 0}
                        onChange={toggleAllVideos}
                        className="h-4 w-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange accent-[#F49617]"
                      />
                      Select all
                    </label>
                    <div className="mx-1 h-4 w-px bg-av-input-border/20" />
                    {selectedVideoIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteSelectedVideos}
                        disabled={deletingBulk}
                        className="rounded-lg border border-av-error/30 bg-av-error/10 px-3 py-1 text-[11px] font-semibold text-av-error transition-all hover:bg-av-error/20 disabled:opacity-50"
                      >
                        Delete selected ({selectedVideoIds.size})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeleteAllVideos}
                      disabled={deletingBulk}
                      className="rounded-lg border border-av-error/20 bg-av-error/5 px-3 py-1 text-[11px] font-semibold text-av-error/70 transition-all hover:bg-av-error/15 hover:text-av-error disabled:opacity-50"
                    >
                      Delete all
                    </button>
                    {selectedVideoIds.size > 0 && selectedChannelVideos.some((v) => selectedVideoIds.has(v.id) && !v.age_classification) && (
                      <button
                        type="button"
                        onClick={handleBatchSetContentRating}
                        disabled={batchRatingSaving || deletingBulk}
                        className="rounded-lg border border-av-orange/30 bg-av-orange/10 px-3 py-1 text-[11px] font-semibold text-av-orange transition-all hover:bg-av-orange/20 disabled:opacity-50"
                      >
                        {batchRatingSaving ? "Setting…" : "Set unrated to TEEN"}
                      </button>
                    )}
                    {(deletingBulk || batchRatingSaving) && (
                      <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
                    )}
                  </div>
                )}

                {/* Video grid — full width */}
                <div className="px-6 py-4">
                  {selectedChannelVideos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-av-light-orange">
                      Upload a video to start building this channel&apos;s
                      broadcast library.
                    </p>
                  ) : (
                    <div className="grid max-h-[400px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedChannelVideos.map((video) => (
                        <div
                          key={video.id}
                          className={`group rounded-2xl border p-4 transition-all ${
                            selectedVideoIds.has(video.id)
                              ? "border-av-orange/40 bg-av-orange/5"
                              : "border-av-input-border/20 bg-av-input-fill/30 hover:border-av-input-border/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedVideoIds.has(video.id)}
                              onChange={() => toggleVideoSelection(video.id)}
                              className="h-4 w-4 flex-shrink-0 rounded border-av-input-border/40 bg-av-input-fill text-av-orange accent-[#F49617]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-av-white">
                                {video.title}
                              </p>
                              <p className="mt-0.5 text-xs text-av-light-orange">
                                {formatDuration(video.duration)} · Added{" "}
                                {formatTimestamp(video.created_at)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  video.transcoding_status === "ready"
                                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                    : video.transcoding_status === "failed"
                                      ? "border-av-error/30 bg-av-error/10 text-av-error"
                                      : "border-av-orange/30 bg-av-orange/10 text-av-orange"
                                }`}>
                                  {video.transcoding_status === "ready"
                                    ? "Adaptive ready"
                                    : video.transcoding_status === "failed"
                                      ? "Adaptive failed"
                                      : video.transcoding_status === "unavailable"
                                        ? "Original quality"
                                        : "Preparing adaptive quality"}
                                </span>
                                {video.transcoding_status === "failed" && (
                                  <button
                                    onClick={() => handleRetryTranscode(video.id)}
                                    disabled={retryingTranscodeId === video.id || busy || deletingBulk}
                                    className="rounded-full border border-av-orange/40 bg-av-orange/10 px-2 py-0.5 text-[10px] font-bold text-av-orange transition-all hover:bg-av-orange/20 disabled:opacity-50"
                                  >
                                    {retryingTranscodeId === video.id ? "Retrying…" : "↻ Retry transcode"}
                                  </button>
                                )}
                                {video.transcoding_status === "failed" && video.transcoding_error && (
                                  <span className="w-full text-[10px] text-av-error/70 truncate" title={video.transcoding_error}>
                                    {video.transcoding_error}
                                  </span>
                                )}
                                {video.available_renditions?.map((height) => (
                                  <span key={height} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-av-light-orange">
                                    {height}p
                                  </span>
                                ))}
                                {video.age_classification ? (
                                  <span
                                    className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                    style={{
                                      background: getClassificationMeta(video.age_classification as AgeClassification).bg,
                                      border: getClassificationMeta(video.age_classification as AgeClassification).border,
                                      color: getClassificationMeta(video.age_classification as AgeClassification).color,
                                    }}
                                  >
                                    {getClassificationMeta(video.age_classification as AgeClassification).label}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openRatingEditor(video)}
                                    className="rounded-full border border-av-orange/40 bg-av-orange/10 px-2 py-0.5 text-[10px] font-bold text-av-orange transition-all hover:bg-av-orange/20"
                                  >
                                    ⚠ Set Content Rating
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 flex-col items-end gap-1">
                              {video.age_classification && (
                                <button
                                  onClick={() => openRatingEditor(video)}
                                  disabled={busy || deletingBulk}
                                  className="rounded-full border border-av-input-border/30 bg-av-input-fill/30 px-2.5 py-1 text-[10px] font-semibold text-av-light-orange opacity-0 transition-all hover:bg-av-input-fill/50 group-hover:opacity-100 disabled:opacity-50"
                                >
                                  Edit Rating
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteVideo(video.id, video.title)}
                                disabled={busy || deletingBulk || deletingConfirmed}
                                className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error opacity-0 transition-all hover:bg-av-error/20 group-hover:opacity-100 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ════ FULL-WIDTH ROW — Afrovision Wave ════ */}
              <div className="mt-6 rounded-3xl border border-av-input-border/30 bg-av-card">
                <div className="flex items-center gap-3 border-b border-av-input-border/15 px-6 py-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(249,150,23,0.15)" }}>
                    <span className="text-lg">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-av-white">Afrovision Wave</h2>
                    <p className="text-xs text-av-light-orange">Upload short clips to the Wave feed</p>
                  </div>
                  <a
                    href="/wave"
                    className="ml-auto text-xs text-av-orange hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Wave feed ↗
                  </a>
                </div>
                <div className="p-6">
                  <WaveUploadPanelInStudio selectedChannelId={selectedChannelId} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Content Rating Editor Modal ── */}
      {ratingEditorVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeRatingEditor}>
          <div
            className="w-full max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-av-white">Set Content Rating</h3>
              <button onClick={closeRatingEditor} className="text-av-light-orange hover:text-av-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </button>
            </div>
            <p className="mb-3 truncate text-xs text-av-light-orange">{ratingEditorVideo.title}</p>
            <label className="text-[11px] font-semibold text-av-light-orange/90">Audience Classification</label>
            <select
              value={ratingEditorAge}
              onChange={(e) => setRatingEditorAge(e.target.value as AgeClassification)}
              className="mt-1 h-9 w-full rounded-md border border-av-input-border/35 bg-av-input-fill/40 px-2 text-xs text-av-white focus:border-av-orange/40 focus:outline-none"
            >
              {(selectedChannel?.type === "public" ? PUBLIC_CLASSIFICATION_OPTIONS : CLASSIFICATION_OPTIONS).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {GENERAL_CONTENT_FIELDS.map((field) => (
                <label key={String(field.key)} className="flex items-center gap-1.5 text-[11px] text-av-white/70">
                  <input
                    type="checkbox"
                    checked={ratingEditorFields[field.key] ?? false}
                    onChange={(e) => setRatingEditorFields((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                    className="h-3 w-3 accent-av-orange"
                  />
                  {field.label}
                </label>
              ))}
              {ratingEditorAge === "adult" &&
                ADULT_SENSITIVE_FIELDS.map((field) => (
                  <label key={String(field.key)} className="flex items-center gap-1.5 text-[11px] text-av-white/70">
                    <input
                      type="checkbox"
                      checked={ratingEditorFields[field.key] ?? false}
                      onChange={(e) => setRatingEditorFields((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                      className="h-3 w-3 accent-av-orange"
                    />
                    {field.label}
                  </label>
                ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeRatingEditor}
                className="rounded-lg border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange transition-all hover:bg-av-input-fill/30"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContentRating}
                disabled={ratingEditorSaving}
                className="rounded-lg bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-1.5 text-xs font-semibold text-av-dark-blue disabled:opacity-50"
              >
                {ratingEditorSaving ? "Saving…" : "Save Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deletingConfirmed && setDeleteConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-4 max-w-md rounded-2xl border border-av-error/20 bg-av-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-av-error/10">
                <svg className="h-5 w-5 text-av-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-av-white">
                  {deleteConfirm.type === "single"
                    ? "Delete this video?"
                    : deleteConfirm.type === "selected"
                      ? `Delete ${deleteConfirm.count} selected video${deleteConfirm.count > 1 ? "s" : ""}?`
                      : `Delete ALL ${deleteConfirm.count} videos?`}
                </h3>
                {deleteConfirm.type === "single" && (
                  <p className="mt-1 text-sm text-av-light-orange">
                    &ldquo;{deleteConfirm.title}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-av-error/20 bg-av-error/5 p-3">
              <p className="text-xs leading-relaxed text-av-error/80">
                <strong className="font-bold text-av-error">Warning:</strong> Deleted content can never be seen or used again. It will be permanently deleted from our servers forever. This action cannot be undone.
              </p>
            </div>

            <p className="mt-3 text-xs text-av-light-orange/60">
              If this was a mistake, simply close this dialog.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingConfirmed}
                className="rounded-lg border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange transition-all hover:bg-av-input-fill/30 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteVideo}
                disabled={deletingConfirmed}
                className="rounded-lg bg-av-error px-4 py-2 text-xs font-bold text-white transition-all hover:bg-av-error/90 disabled:opacity-50"
              >
                {deletingConfirmed ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting…
                  </span>
                ) : (
                  "Yes, delete forever"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlaybackStateCard({
  playbackState,
  selectedChannel,
  schedule,
}: {
  playbackState: {
    nowPlaying: NowPlaying | null;
    schedulerState: { reason: string; program_id?: string; video_missing?: boolean } | null;
    serverTime: number;
    loading: boolean;
  };
  selectedChannel: Channel | undefined;
  schedule: ScheduleProgram[];
}) {
  const now = playbackState.serverTime;
  const nowPlaying = playbackState.nowPlaying;
  const reason = playbackState.schedulerState?.reason;
  const isNative = !selectedChannel || selectedChannel.stream_source_mode === "native";

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!isNative) {
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
          <p className="text-sm font-semibold text-av-white">
            External {(selectedChannel?.stream_source_mode ?? "url").replace("external_", "").toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-av-light-orange">
            Status: <span className="font-semibold text-av-orange">{selectedChannel?.stream_status ?? "unknown"}</span>
          </p>
          <p className="mt-1 text-xs text-av-light-orange truncate">
            {selectedChannel?.resolved_playback_url ?? selectedChannel?.external_url ?? "No external URL configured"}
          </p>
        </div>
      </div>
    );
  }

  if (playbackState.loading) {
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
        </div>
      </div>
    );
  }

  const currentProgram = schedule.find((p) => p.start_time <= now && p.end_time > now);
  const upcomingProgram = schedule.find((p) => p.start_time > now);

  if (reason === "current" && nowPlaying) {
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-full w-2 rounded-full bg-green-500" />
            </span>
            Live · {nowPlaying.video_title}
          </p>
          <p className="mt-1 text-xs text-av-light-orange">
            Video URL: {nowPlaying.video_url ? "Valid signed URL" : <span className="text-red-400">Missing</span>}
          </p>
          <p className="mt-1 text-xs text-av-light-orange">
            Position: {Math.floor(nowPlaying.position / 60)}m {nowPlaying.position % 60}s
            {nowPlaying.is_loop ? " (loop)" : ""}
          </p>
          {upcomingProgram && (
            <p className="mt-1 text-xs text-av-light-orange">
              Next: {upcomingProgram.video_title} at {formatTime(upcomingProgram.start_time)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (reason === "current" && playbackState.schedulerState?.video_missing) {
    const program = currentProgram ?? schedule.find((p) => p.id === playbackState.schedulerState?.program_id);
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-400">Scheduled video is missing or not uploaded yet</p>
          {program && (
            <p className="mt-1 text-xs text-av-light-orange">
              Program: {program.video_title} ({formatTime(program.start_time)} – {formatTime(program.end_time)})
            </p>
          )}
          <p className="mt-2 text-xs text-av-light-orange">
            Upload the video to the library and re-schedule it, or fix the existing video URL.
          </p>
        </div>
      </div>
    );
  }

  if (reason === "upcoming" && upcomingProgram) {
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="rounded-xl border border-av-orange/30 bg-av-orange/10 p-4">
          <p className="text-sm font-semibold text-av-white">Starting soon</p>
          <p className="mt-1 text-xs text-av-light-orange">
            {upcomingProgram.video_title} begins at {formatTime(upcomingProgram.start_time)}
          </p>
        </div>
      </div>
    );
  }

  if (reason === "loop" && nowPlaying) {
    return (
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
        <div className="rounded-xl border border-av-orange/30 bg-av-orange/10 p-4">
          <p className="text-sm font-semibold text-av-white">Looping last program</p>
          <p className="mt-1 text-xs text-av-light-orange">
            {nowPlaying.video_title} (no upcoming schedule)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-av-white">Current Playback State</h2>
      <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
        <p className="text-sm font-semibold text-av-white">Offline</p>
        <p className="mt-1 text-xs text-av-light-orange">
          No active or upcoming program. Schedule a video to go live.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-av-light-orange">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-av-white">{value}</p>
    </div>
  );
}
