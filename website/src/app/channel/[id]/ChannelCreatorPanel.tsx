"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  deleteVideoApi,
  getChannelScheduleApi,
  getMyVideosApi,
  cancelVideoUploadSessionApi,
  deleteVideoUploadSessionApi,
  getMyVideoUploadSessionsApi,
  getVideoUploadUrlApi,
  uploadFileToGCS,
  registerUploadedVideoApi,
  uploadVideoApi,
  scheduleProgramApi,
  scheduleSequentialApi,
  resolveSourceApi,
  uploadChannelMediaApi,
  updateChannelApi,
  updateExternalSourceApi,
  recheckStreamHealthApi,
  deleteProgramApi,
  deleteChannelApi,
  type Channel,
  type ChannelVideo,
  type ScheduleProgram,
  type VideoUploadSession,
} from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import { useRouter } from "next/navigation";
import { WaveUploadPanel } from "@/components/WaveUploadPanel";

/* ── helpers ──────────────────────────────────────────────────────── */

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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
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

const SUPPORTED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);

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

function parseDurationInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

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

const ITEMS_PER_PAGE = 6;

/* ── types ─────────────────────────────────────────────────────────── */

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
}

/* ── component ─────────────────────────────────────────────────────── */

interface ChannelCreatorPanelProps {
  channelId: string;
  channel: Channel;
  onChannelUpdated?: (updated: Channel) => void;
}

export function ChannelCreatorPanel({ channelId, channel, onChannelUpdated }: ChannelCreatorPanelProps) {
  const router = useRouter();

  /* ── data state ─────────────────────────────────────── */
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleProgram[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── upload state ───────────────────────────────────── */
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [recentUploadSessions, setRecentUploadSessions] = useState<VideoUploadSession[]>([]);
  const [loadingUploadSessions, setLoadingUploadSessions] = useState(false);
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── auto-schedule state ─────────────────────────────── */
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [autoScheduleStart, setAutoScheduleStart] = useState("");
  const [schedulingBulk, setSchedulingBulk] = useState(false);
  const [scheduleVideoId, setScheduleVideoId] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [libraryAutoStart, setLibraryAutoStart] = useState("");
  const [schedulingLibrary, setSchedulingLibrary] = useState(false);

  /* ── drag state ─────────────────────────────────────── */
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  /* ── selection state ─────────────────────────────────── */
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [schedulePage, setSchedulePage] = useState(1);

  /* ── stream source state ─────────────────────────────── */
  const [extSourceMode, setExtSourceMode] = useState<string>(channel.stream_source_mode ?? "native");
  const [extSourceUrl, setExtSourceUrl] = useState(channel.external_url ?? "");
  const [extValidating, setExtValidating] = useState(false);
  const [extUrlValidation, setExtUrlValidation] = useState<{ ok: boolean; message: string } | null>(null);
  const [extSaving, setExtSaving] = useState(false);
  const [extRechecking, setExtRechecking] = useState(false);

  /* ── channel edit state ──────────────────────────────── */
  const [editingChannel, setEditingChannel] = useState(false);
  const [editChannelName, setEditChannelName] = useState(channel.name ?? "");
  const [editChannelDescription, setEditChannelDescription] = useState(channel.description ?? "");
  const [editChannelCategory, setEditChannelCategory] = useState(channel.category ?? "");
  const [editChannelLogoFile, setEditChannelLogoFile] = useState<File | null>(null);
  const [editChannelBannerFile, setEditChannelBannerFile] = useState<File | null>(null);
  const [savingChannelEdit, setSavingChannelEdit] = useState(false);

  /* ── derived ─────────────────────────────────────────── */
  const isContinuousUrlChannel = channel.stream_source_mode === "external_url";
  const channelVideos = useMemo(
    () => videos.filter((v) => v.channel_id === channelId),
    [videos, channelId],
  );
  const totalHours = useMemo(
    () => channelVideos.reduce((s, v) => s + v.duration, 0) / 3600,
    [channelVideos],
  );
  const schedulePageCount = Math.max(1, Math.ceil(schedule.length / ITEMS_PER_PAGE));
  const clampedSchedulePage = Math.min(schedulePage, schedulePageCount);
  const pagedSchedule = useMemo(() => {
    const start = (clampedSchedulePage - 1) * ITEMS_PER_PAGE;
    return schedule.slice(start, start + ITEMS_PER_PAGE);
  }, [schedule, clampedSchedulePage]);
  const pendingUploads = uploadEntries.filter((e) => e.progress === -1);
  const completedUploads = uploadEntries.filter((e) => e.progress === 101);
  const failedUploads = uploadEntries.filter((e) => !!e.error);
  const totalUploadDuration = uploadEntries.reduce((s, e) => s + e.duration, 0);

  /* ── loaders ─────────────────────────────────────────── */
  const loadVideos = useCallback(async () => {
    const res = await getMyVideosApi();
    if (res.ok && "videos" in res.data) setVideos(res.data.videos);
  }, []);

  const loadSchedule = useCallback(async () => {
    const res = await getChannelScheduleApi(channelId);
    if (res.ok && "schedule" in res.data) setSchedule(res.data.schedule);
  }, [channelId]);

  const loadUploadSessions = useCallback(async () => {
    setLoadingUploadSessions(true);
    const res = await getMyVideoUploadSessionsApi(channelId);
    if (res.ok && "sessions" in res.data) setRecentUploadSessions(res.data.sessions);
    setLoadingUploadSessions(false);
  }, [channelId]);

  /* ── initial load ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingData(true);
      await Promise.all([loadVideos(), loadSchedule(), loadUploadSessions()]);
      if (!cancelled) setLoadingData(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [loadVideos, loadSchedule, loadUploadSessions]);

  /* ── auto-refresh upload sessions ───────────────────── */
  useEffect(() => {
    const hasActiveSessions = recentUploadSessions.some((s) =>
      ["initiated", "uploading", "paused", "failed"].includes(s.status),
    );
    if (!uploadingAll && !hasActiveSessions) return;
    const id = window.setInterval(() => void loadUploadSessions(), 8000);
    return () => window.clearInterval(id);
  }, [uploadingAll, recentUploadSessions, loadUploadSessions]);

  /* ── upload file helpers ─────────────────────────────── */
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
      });
    }
    setUploadEntries((prev) => [...prev, ...newEntries]);
    for (const entry of newEntries) {
      if (!isSupportedVideoFile(entry.file)) continue;
      detectDuration(entry.file).then((dur) => {
        setUploadEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, duration: dur, detecting: false } : e),
        );
      });
    }
  }

  function updateEntry(id: string, patch: Partial<UploadEntry>) {
    setUploadEntries((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
  }

  function removeEntry(id: string) {
    setUploadEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function retryFailedEntries() {
    setUploadEntries((prev) =>
      prev.map((entry) => entry.error ? { ...entry, error: null, progress: -1 } : entry),
    );
  }

  function clearCompletedEntries() {
    setUploadEntries((prev) => prev.filter((e) => e.progress !== 101));
  }

  /* ── drag to reorder ─────────────────────────────────── */
  function handleDragStart(index: number) { dragItem.current = index; }
  function handleDragEnter(index: number) { dragOverItem.current = index; }
  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...uploadEntries];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    setUploadEntries(items);
    dragItem.current = null;
    dragOverItem.current = null;
  }

  /* ── upload all ──────────────────────────────────────── */
  async function handleUploadAll() {
    const pending = uploadEntries.filter((e) => e.progress === -1);
    if (pending.length === 0) return;
    setUploadingAll(true);
    setError(null);
    setUploadNotice("We are processing your uploads now. You can continue other activities; once each upload completes, you will receive a notification.");

    for (const entry of pending) {
      if (!isSupportedVideoFile(entry.file)) {
        updateEntry(entry.id, { error: "Unsupported format. Upload MP4 (H.264/AAC) or WebM (VP9/Opus).", progress: -1, detecting: false });
        continue;
      }
      let resolvedDuration = entry.duration;
      if (resolvedDuration <= 0 || entry.detecting) {
        updateEntry(entry.id, { detecting: true });
        resolvedDuration = await detectDuration(entry.file);
        updateEntry(entry.id, { duration: resolvedDuration, detecting: false });
      }
      if (!Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
        updateEntry(entry.id, { error: "Duration detection failed. Set a duration manually before uploading.", progress: -1, detecting: false });
        continue;
      }
      const title = entry.title.trim() || titleFromFilename(entry.file.name);
      const description = entry.description.trim();

      const fallbackToLegacyUpload = async () => {
        const directRes = await uploadVideoApi({ channelId, title, description, duration: resolvedDuration, file: entry.file });
        if (!directRes.ok || !("video" in directRes.data)) {
          updateEntry(entry.id, { error: "error" in directRes.data ? directRes.data.error : "Direct upload failed", progress: -1 });
          return;
        }
        updateEntry(entry.id, { progress: 101, registeredVideoId: directRes.data.video.id, error: null });
      };

      try {
        updateEntry(entry.id, { progress: 0, error: null });
        const signedRes = await getVideoUploadUrlApi({ contentType: getVideoContentType(entry.file), fileName: entry.file.name });
        if (!signedRes.ok || !("signed_url" in signedRes.data)) {
          await fallbackToLegacyUpload();
          continue;
        }
        await uploadFileToGCS(signedRes.data.signed_url, entry.file, (pct) => {
          updateEntry(entry.id, { progress: pct, error: null });
        });
        const registerRes = await registerUploadedVideoApi({ channelId, title, description, duration: resolvedDuration, videoUrl: signedRes.data.public_url });
        if (!registerRes.ok || !("video" in registerRes.data)) {
          updateEntry(entry.id, { error: "error" in registerRes.data ? registerRes.data.error : "Registration failed", progress: -1 });
          continue;
        }
        updateEntry(entry.id, { progress: 101, registeredVideoId: registerRes.data.video.id, error: null });
      } catch {
        await fallbackToLegacyUpload();
      }
    }

    await loadVideos();
    await loadSchedule();
    await loadUploadSessions();
    setUploadingAll(false);
    setUploadNotice(null);

    const updated = uploadEntries.filter((e) => e.progress === 101 && e.registeredVideoId);
    if (updated.length > 0) setShowAutoSchedule(true);
  }

  /* ── auto-schedule uploads ───────────────────────────── */
  async function handleAutoSchedule() {
    const videoIds = uploadEntries.filter((e) => e.progress === 101 && e.registeredVideoId).map((e) => e.registeredVideoId!);
    if (videoIds.length === 0 || !autoScheduleStart) {
      setError("Pick a start time and make sure videos are uploaded.");
      return;
    }
    setSchedulingBulk(true);
    setError(null);
    const res = await scheduleSequentialApi({ channelId, videoIds, startTime: new Date(autoScheduleStart).getTime() });
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Auto-scheduling failed.");
    } else {
      setShowAutoSchedule(false);
      setUploadEntries([]);
      await loadSchedule();
    }
    setSchedulingBulk(false);
  }

  /* ── auto-schedule library ───────────────────────────── */
  async function handleAutoScheduleLibrary() {
    if (channelVideos.length === 0 || !libraryAutoStart) {
      setError("Pick a start time and make sure the library has videos.");
      return;
    }
    setSchedulingLibrary(true);
    setError(null);
    const videoIds = channelVideos.map((v) => v.id);
    const res = await scheduleSequentialApi({ channelId, videoIds, startTime: new Date(libraryAutoStart).getTime() });
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Auto-scheduling failed.");
    } else {
      setLibraryAutoStart("");
      await loadSchedule();
    }
    setSchedulingLibrary(false);
  }

  /* ── single schedule ──────────────────────────────────── */
  async function handleSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!scheduleVideoId || !scheduleStart) {
      setError("Select a video and a start time.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await scheduleProgramApi({ channelId, videoId: scheduleVideoId, startTime: new Date(scheduleStart).getTime() });
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Scheduling failed.");
    } else {
      await loadSchedule();
      setScheduleStart("");
    }
    setBusy(false);
  }

  /* ── delete video ─────────────────────────────────────── */
  async function handleDeleteVideo(videoId: string) {
    setBusy(true);
    setError(null);
    const res = await deleteVideoApi(videoId);
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Could not delete video.");
    } else {
      await loadVideos();
      await loadSchedule();
    }
    setBusy(false);
  }

  /* ── delete program ──────────────────────────────────── */
  async function handleDeleteProgram(programId: string) {
    setBusy(true);
    setError(null);
    const res = await deleteProgramApi(programId);
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Could not remove scheduled program.");
    } else {
      await loadSchedule();
    }
    setBusy(false);
  }

  /* ── bulk video operations ───────────────────────────── */
  function toggleVideoSelection(id: string) {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllVideos() {
    if (selectedVideoIds.size === channelVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(channelVideos.map((v) => v.id)));
    }
  }
  async function handleDeleteSelectedVideos() {
    if (selectedVideoIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedVideoIds.size} selected video${selectedVideoIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const id of selectedVideoIds) {
      const res = await deleteVideoApi(id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} video(s) could not be deleted.`);
    setSelectedVideoIds(new Set());
    await loadVideos();
    await loadSchedule();
    setDeletingBulk(false);
  }
  async function handleDeleteAllVideos() {
    if (channelVideos.length === 0) return;
    if (!window.confirm(`Delete ALL ${channelVideos.length} videos in this channel? This cannot be undone.`)) return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const v of channelVideos) {
      const res = await deleteVideoApi(v.id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} video(s) could not be deleted.`);
    setSelectedVideoIds(new Set());
    await loadVideos();
    await loadSchedule();
    setDeletingBulk(false);
  }

  /* ── bulk program operations ─────────────────────────── */
  function toggleProgramSelection(id: string) {
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    if (!window.confirm(`Remove ${selectedProgramIds.size} selected program${selectedProgramIds.size > 1 ? "s" : ""} from the schedule?`)) return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const id of selectedProgramIds) {
      const res = await deleteProgramApi(id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} program(s) could not be removed.`);
    setSelectedProgramIds(new Set());
    await loadSchedule();
    setDeletingBulk(false);
  }
  async function handleDeleteAllPrograms() {
    if (schedule.length === 0) return;
    if (!window.confirm(`Remove ALL ${schedule.length} programs from the schedule? This cannot be undone.`)) return;
    setDeletingBulk(true);
    setError(null);
    let failed = 0;
    for (const p of schedule) {
      const res = await deleteProgramApi(p.id);
      if (!res.ok) failed++;
    }
    if (failed > 0) setError(`${failed} program(s) could not be removed.`);
    setSelectedProgramIds(new Set());
    await loadSchedule();
    setDeletingBulk(false);
  }

  /* ── upload session operations ───────────────────────── */
  async function handleCancelUploadSession(sessionId: string) {
    setCancelingSessionId(sessionId);
    const res = await cancelVideoUploadSessionApi(sessionId);
    setCancelingSessionId(null);
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Failed to cancel upload session.");
      return;
    }
    await loadUploadSessions();
  }
  async function handleDeleteUploadSession(sessionId: string) {
    setDeletingSessionId(sessionId);
    const res = await deleteVideoUploadSessionApi(sessionId);
    setDeletingSessionId(null);
    if (!res.ok) {
      setError("error" in res.data ? res.data.error : "Failed to delete upload session.");
      return;
    }
    await loadUploadSessions();
  }

  /* ── stream source handlers ──────────────────────────── */
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
    setExtSaving(true);
    setError(null);
    const res = await updateExternalSourceApi(
      channelId,
      extSourceMode === "native"
        ? { stream_source_mode: "native", external_url: null, external_provider: null, resolved_playback_url: null, stream_status: "unknown", last_checked_at: null, provider_metadata: null }
        : { stream_source_mode: extSourceMode, external_url: extSourceUrl.trim() },
    );
    setExtSaving(false);
    if (res.ok && "channel" in res.data) {
      onChannelUpdated?.(res.data.channel);
      setExtUrlValidation({ ok: true, message: "Stream source saved successfully." });
    } else {
      setError("error" in res.data ? res.data.error : "Failed to save stream source.");
    }
  }

  async function handleExtRecheck() {
    setExtRechecking(true);
    const res = await recheckStreamHealthApi(channelId);
    setExtRechecking(false);
    if (res.ok && "channel" in res.data) {
      onChannelUpdated?.(res.data.channel);
      const status = res.data.channel.stream_status ?? "unknown";
      setExtUrlValidation({ ok: true, message: `Stream health checked · Status: ${status}` });
    } else {
      setExtUrlValidation({ ok: false, message: "Health check failed. Try again." });
    }
  }

  /* ── channel edit handlers ───────────────────────────── */
  async function saveChannelEdit() {
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
      if (!logoRes.ok || !("channel" in logoRes.data)) {
        setSavingChannelEdit(false);
        setError("error" in logoRes.data ? logoRes.data.error : "Saved text but failed to upload logo.");
        return;
      }
      latestChannel = logoRes.data.channel;
    }
    if (editChannelBannerFile) {
      const bannerRes = await uploadChannelMediaApi(channelId, "banner", editChannelBannerFile);
      if (!bannerRes.ok || !("channel" in bannerRes.data)) {
        setSavingChannelEdit(false);
        setError("error" in bannerRes.data ? bannerRes.data.error : "Saved channel but failed to upload cover image.");
        return;
      }
      latestChannel = bannerRes.data.channel;
    }

    setSavingChannelEdit(false);
    setEditingChannel(false);
    setEditChannelLogoFile(null);
    setEditChannelBannerFile(null);
    onChannelUpdated?.(latestChannel);
  }

  /* ── delete channel ──────────────────────────────────── */
  async function handleDeleteChannel() {
    const confirmed = window.confirm(`Delete channel "${channel.name}"? This will disable the channel and remove it from discovery.`);
    if (!confirmed) return;
    setDeleting(true);
    const res = await deleteChannelApi(channelId);
    setDeleting(false);
    if (res.ok) {
      router.push("/channels");
      return;
    }
    setError("error" in res.data ? res.data.error : "Failed to delete channel.");
  }

  /* ── render ──────────────────────────────────────────── */
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-av-error/30 bg-av-error/5 p-4">
          <p className="flex-1 text-sm text-av-error">{error}</p>
          <button onClick={() => setError(null)} className="flex-shrink-0 text-av-error/60 hover:text-av-error text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Videos", value: String(channelVideos.length) },
          { label: "Scheduled", value: String(schedule.length) },
          { label: "Library Hours", value: `${totalHours.toFixed(1)}h` },
          { label: "Channel #", value: `#${channel.channel_number}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-av-input-border/30 bg-av-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-av-light-orange">{stat.label}</p>
            <p className="mt-1.5 text-xl font-semibold text-av-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Quick links ── */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/live/${channelId}`} className="rounded-full border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-xs font-semibold text-av-orange hover:bg-av-orange/20 transition-colors">
          Live Page →
        </Link>
        <Link href={`/channel-analytics?channel_id=${channelId}`} className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
          Analytics →
        </Link>
        <Link href="/creator-studio" className="rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white transition-colors">
          Creator Studio →
        </Link>
        <Link href="/creator-studio/library" className="rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white transition-colors">
          Library Studio →
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── CHANNEL DETAILS EDITOR ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-av-white">Channel Details</h2>
          {!editingChannel ? (
            <button
              type="button"
              onClick={() => setEditingChannel(true)}
              className="rounded-full border border-av-input-border/30 px-4 py-1.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white transition-colors"
            >
              Edit
            </button>
          ) : null}
        </div>

        {!editingChannel ? (
          <div className="space-y-2 text-sm text-av-light-orange">
            <p><span className="text-av-white font-medium">{channel.name}</span></p>
            <p className="text-xs">{channel.category} · {channel.type}</p>
            {channel.description && <p className="text-xs leading-relaxed opacity-80">{channel.description}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={editChannelName}
              onChange={(e) => setEditChannelName(e.target.value)}
              maxLength={100}
              placeholder="Channel name"
              className="h-10 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
            />
            <textarea
              value={editChannelDescription}
              onChange={(e) => setEditChannelDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Description"
              className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 py-2.5 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
            />
            <input
              value={editChannelCategory}
              onChange={(e) => setEditChannelCategory(e.target.value)}
              placeholder="Category"
              className="h-10 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-3 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-av-input-border/30 bg-av-input-fill/20 p-3 text-xs text-av-light-orange cursor-pointer">
                <p className="mb-2 font-semibold text-av-white">Channel logo</p>
                <input type="file" accept="image/*" onChange={(e) => setEditChannelLogoFile(e.target.files?.[0] ?? null)} className="w-full text-[11px]" />
                {channel.logo_url && !editChannelLogoFile && (
                  <Image src={resolveWebsiteMediaUrl(channel.logo_url)} alt="Current logo" width={56} height={56} unoptimized className="mt-2 h-14 w-14 rounded-md border border-av-input-border/30 object-cover" />
                )}
                {editChannelLogoFile && <p className="mt-1 text-[10px] text-cyan-300">New: {editChannelLogoFile.name}</p>}
              </label>
              <label className="rounded-xl border border-av-input-border/30 bg-av-input-fill/20 p-3 text-xs text-av-light-orange cursor-pointer">
                <p className="mb-2 font-semibold text-av-white">Cover image</p>
                <input type="file" accept="image/*" onChange={(e) => setEditChannelBannerFile(e.target.files?.[0] ?? null)} className="w-full text-[11px]" />
                {channel.banner_url && !editChannelBannerFile && (
                  <Image src={resolveWebsiteMediaUrl(channel.banner_url)} alt="Current banner" width={320} height={56} unoptimized className="mt-2 h-14 w-full rounded-md border border-av-input-border/30 object-cover" />
                )}
                {editChannelBannerFile && <p className="mt-1 text-[10px] text-cyan-300">New: {editChannelBannerFile.name}</p>}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingChannel(false);
                  setEditChannelName(channel.name ?? "");
                  setEditChannelDescription(channel.description ?? "");
                  setEditChannelCategory(channel.category ?? "");
                  setEditChannelLogoFile(null);
                  setEditChannelBannerFile(null);
                }}
                className="rounded-xl border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange hover:text-av-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveChannelEdit}
                disabled={savingChannelEdit}
                className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-xs font-semibold text-av-dark-blue disabled:opacity-60"
              >
                {savingChannelEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── STREAM SOURCE ──────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-av-white">Stream Source</h2>

        {/* Status badge */}
        {channel.stream_source_mode && channel.stream_source_mode !== "native" && (
          <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            channel.stream_status === "live" ? "border-green-500/40 bg-green-500/10 text-green-400"
            : channel.stream_status === "offline" || channel.stream_status === "invalid" ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-av-orange/30 bg-av-orange/10 text-av-orange"
          }`}>
            <span className="uppercase tracking-wide">{channel.stream_status ?? "UNKNOWN"}</span>
            <span className="text-av-light-orange">·</span>
            <span className="text-av-light-orange">{channel.stream_source_mode.replace("external_", "").toUpperCase()}</span>
            {channel.last_checked_at && (
              <><span className="text-av-light-orange">·</span><span className="text-av-light-orange opacity-60">checked {formatTimeAgo(channel.last_checked_at)}</span></>
            )}
          </div>
        )}

        {/* Mode selector */}
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
          {channel.stream_source_mode && channel.stream_source_mode !== "native" && (
            <button
              type="button"
              onClick={handleExtRecheck}
              disabled={extRechecking}
              className="rounded-xl border border-av-input-border/30 px-4 py-2.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white disabled:opacity-40 transition-colors"
            >
              {extRechecking ? "Checking…" : "Recheck"}
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── MAIN TOOLS GRID ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ══ LEFT — Upload ══ */}
        <section className="flex flex-col">
          <div className="flex-1 rounded-3xl border border-av-input-border/30 bg-av-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-av-white">Upload Videos</h2>
              {uploadEntries.length > 0 && (
                <span className="text-xs text-av-light-orange">
                  {uploadEntries.length} file{uploadEntries.length > 1 ? "s" : ""} · {formatDuration(totalUploadDuration)}
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

            {/* Upload sessions */}
            {recentUploadSessions.length > 0 && (
              <div className="mb-4 rounded-2xl border border-av-input-border/25 bg-av-input-fill/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-av-light-orange">Upload Session Status</p>
                  <button
                    type="button"
                    onClick={() => void loadUploadSessions()}
                    disabled={loadingUploadSessions}
                    className="rounded-lg border border-av-input-border/30 px-2.5 py-1 text-[10px] font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white disabled:opacity-40 transition-colors"
                  >
                    {loadingUploadSessions ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
                <div className="space-y-2">
                  {recentUploadSessions.slice(0, 6).map((session) => (
                    <div key={session.id} className="flex items-center justify-between rounded-xl border border-av-input-border/20 bg-av-input-fill/20 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-av-white">{session.title}</p>
                        <p className="text-[10px] text-av-light-orange/70">
                          {session.total_bytes > 0 ? `${Math.round((session.uploaded_bytes / session.total_bytes) * 100)}% uploaded` : "Processing"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          session.status === "completed" ? "bg-green-500/15 text-green-400"
                          : session.status === "failed" ? "bg-red-500/15 text-red-300"
                          : session.status === "canceled" ? "bg-slate-500/20 text-slate-300"
                          : session.status === "finalizing" ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-av-orange/15 text-av-orange"
                        }`}>
                          {session.status}
                        </span>
                        {session.status !== "completed" && session.status !== "canceled" && session.status !== "finalizing" && (
                          <button
                            type="button"
                            onClick={() => void handleCancelUploadSession(session.id)}
                            disabled={cancelingSessionId === session.id}
                            className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {cancelingSessionId === session.id ? "…" : "Cancel"}
                          </button>
                        )}
                        {(session.status === "failed" || session.status === "canceled" || session.status === "completed") && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteUploadSession(session.id)}
                            disabled={deletingSessionId === session.id}
                            className="rounded-md border border-av-input-border/35 bg-av-input-fill/30 px-2 py-0.5 text-[10px] font-semibold text-av-light-orange hover:border-av-orange/35 hover:text-av-white disabled:opacity-50"
                          >
                            {deletingSessionId === session.id ? "…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File picker */}
            {!isContinuousUrlChannel && (
              <>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/webm" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAll}
                  className="w-full rounded-2xl border-2 border-dashed border-av-input-border/40 bg-av-input-fill/20 py-8 text-center transition-all hover:border-av-orange/40 hover:bg-av-input-fill/30 disabled:opacity-50"
                >
                  <svg className="mx-auto mb-2 h-8 w-8 text-av-light-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.467 3.856A4.498 4.498 0 0118 19.5H6.75z" />
                  </svg>
                  <p className="text-sm font-semibold text-av-white">Select video files</p>
                  <p className="mt-1 text-xs text-av-light-orange">MP4 or WebM only · Duration auto-detected</p>
                </button>
              </>
            )}

            {/* File list */}
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
                      entry.progress === 101 ? "border-green-500/30 bg-green-500/5"
                      : entry.error ? "border-av-error/30 bg-av-error/5"
                      : "border-av-input-border/20 bg-av-input-fill/30"
                    } ${!uploadingAll ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 pt-1 text-av-light-orange">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" />
                          <circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" />
                          <circle cx="8" cy="20" r="2" /><circle cx="16" cy="20" r="2" />
                        </svg>
                      </div>
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-av-orange/20 text-xs font-bold text-av-orange">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <input
                          value={entry.title}
                          onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                          disabled={entry.progress > -1}
                          className="w-full bg-transparent text-sm font-semibold text-av-white placeholder:text-av-light-orange focus:outline-none disabled:opacity-80"
                          placeholder="Video title"
                        />
                        <textarea
                          value={entry.description}
                          onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                          disabled={entry.progress > -1}
                          rows={2}
                          className="mt-1.5 w-full resize-none rounded-lg border border-av-input-border/20 bg-av-input-fill/30 px-2.5 py-1.5 text-xs text-av-white placeholder:text-av-light-orange focus:border-av-orange/40 focus:outline-none disabled:opacity-80"
                          placeholder="Brief description (required)"
                        />
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs text-av-light-orange">
                            {entry.detecting ? <span className="animate-pulse">Detecting…</span> : formatDuration(entry.duration)}
                          </span>
                          <span className="text-xs text-av-light-orange">{(entry.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                          {entry.progress === 101 && <span className="text-xs font-semibold text-green-400">✓ Uploaded</span>}
                          {entry.error && <span className="text-xs text-av-error">{entry.error}</span>}
                        </div>
                        {entry.progress === -1 && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[11px] text-av-light-orange/90">Duration (seconds)</label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={entry.duration > 0 ? String(entry.duration) : ""}
                              onChange={(e) => updateEntry(entry.id, { duration: parseDurationInput(e.target.value), error: null })}
                              className="h-8 w-28 rounded-md border border-av-input-border/35 bg-av-input-fill/40 px-2 text-xs text-av-white focus:border-av-orange/40 focus:outline-none"
                              placeholder="e.g. 540"
                            />
                            <span className="text-[11px] text-av-light-orange/70">Required for auto scheduling</span>
                          </div>
                        )}
                        {entry.progress >= 0 && entry.progress <= 100 && (
                          <div className="mt-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-av-input-fill">
                              <div className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-200 ease-out" style={{ width: `${entry.progress}%` }} />
                            </div>
                            <p className="mt-1 text-[10px] text-av-light-orange">
                              {entry.progress < 100 ? `Uploading ${entry.progress}%` : "Registering…"}
                            </p>
                          </div>
                        )}
                      </div>
                      {entry.progress === -1 && (
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-av-error/10 text-av-error transition-all hover:bg-av-error/20"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
                    disabled={uploadingAll || pendingUploads.some((e) => !e.description.trim() || e.detecting || e.duration <= 0)}
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                  >
                    {uploadingAll ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading…
                      </span>
                    ) : (
                      `Upload ${pendingUploads.length} video${pendingUploads.length > 1 ? "s" : ""} to library`
                    )}
                  </button>
                )}

                {/* Retry / clear completed */}
                {(failedUploads.length > 0 || completedUploads.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {failedUploads.length > 0 && (
                      <button type="button" onClick={retryFailedEntries} disabled={uploadingAll} className="rounded-full border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-xs font-semibold text-av-orange hover:bg-av-orange/20 disabled:opacity-50">
                        Retry failed ({failedUploads.length})
                      </button>
                    )}
                    {completedUploads.length > 0 && (
                      <button type="button" onClick={clearCompletedEntries} disabled={uploadingAll} className="rounded-full border border-av-input-border/30 px-4 py-2 text-xs font-semibold text-av-light-orange hover:border-av-orange/30 hover:text-av-white disabled:opacity-50">
                        Clear completed ({completedUploads.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-schedule panel */}
                {showAutoSchedule && completedUploads.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-av-orange/30 bg-av-orange/5 p-5">
                    <h3 className="mb-1 text-sm font-semibold text-av-white">Auto-schedule uploads</h3>
                    <p className="mb-4 text-xs text-av-light-orange">
                      Schedule all {completedUploads.length} uploaded video{completedUploads.length > 1 ? "s" : ""} back-to-back.
                      Total runtime: {formatDuration(completedUploads.reduce((s, e) => s + e.duration, 0))}.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="datetime-local"
                        value={autoScheduleStart}
                        min={toDateTimeLocal(new Date().toISOString())}
                        onChange={(e) => setAutoScheduleStart(e.target.value)}
                        className="h-11 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAutoSchedule}
                        disabled={schedulingBulk || !autoScheduleStart}
                        className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                      >
                        {schedulingBulk ? "Scheduling…" : "Schedule all"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowAutoSchedule(false); setUploadEntries([]); }}
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

        {/* ══ RIGHT — Broadcast Schedule ══ */}
        <section className="flex flex-col">
          <div className="flex flex-1 flex-col rounded-3xl border border-av-input-border/30 bg-av-card">
            <div className="flex items-center justify-between gap-3 border-b border-av-input-border/15 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-av-light-orange/15">
                  <svg className="h-5 w-5 text-av-light-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-av-white">Broadcast Schedule</h2>
                  <p className="text-xs text-av-light-orange">
                    {isContinuousUrlChannel ? "Continuous URL mode" : `${schedule.length} scheduled slot${schedule.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick schedule form */}
            {isContinuousUrlChannel ? (
              <div className="border-b border-av-input-border/10 px-6 py-4">
                <p className="text-xs text-av-light-orange">
                  This channel streams continuously from an external URL. Video program scheduling is disabled.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSchedule} className="border-b border-av-input-border/10 px-6 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange">Add to schedule</p>
                <div className="space-y-2">
                  <select
                    value={scheduleVideoId}
                    onChange={(e) => setScheduleVideoId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  >
                    <option value="">Select video</option>
                    {channelVideos.map((video) => (
                      <option key={video.id} value={video.id}>{video.title} ({formatDuration(video.duration)})</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduleStart}
                      min={toDateTimeLocal(new Date().toISOString())}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || channelVideos.length === 0}
                      className="h-10 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                    >
                      {busy ? "…" : "Add"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Schedule management toolbar */}
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
                {deletingBulk && <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />}
              </div>
            )}

            {/* Schedule list */}
            <div className="flex-1 px-6 py-4">
              {isContinuousUrlChannel ? (
                <p className="py-6 text-center text-sm text-av-light-orange">Continuous External URL channels do not have broadcast slots.</p>
              ) : schedule.length === 0 ? (
                <p className="py-6 text-center text-sm text-av-light-orange">No programs scheduled for this channel yet.</p>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {pagedSchedule.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`group rounded-2xl border p-4 transition-all ${
                        selectedProgramIds.has(item.id)
                          ? "border-av-light-orange/40 bg-av-light-orange/5"
                          : "border-av-input-border/20 bg-av-input-fill/30 hover:border-av-input-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedProgramIds.has(item.id)}
                          onChange={() => toggleProgramSelection(item.id)}
                          className="h-4 w-4 flex-shrink-0 rounded border-av-input-border/40 bg-av-input-fill text-av-orange accent-[#F49617]"
                        />
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-av-light-orange/20 text-[10px] font-bold text-av-light-orange">
                          {(clampedSchedulePage - 1) * ITEMS_PER_PAGE + idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-av-white">{item.video_title}</p>
                          <p className="mt-0.5 text-[11px] text-av-light-orange">
                            {formatTimestamp(item.start_time)} → {formatTimestamp(item.end_time)}
                          </p>
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
                  ))}

                  {schedule.length > ITEMS_PER_PAGE && (
                    <div className="mt-3 flex items-center justify-between rounded-2xl border border-av-input-border/20 bg-av-input-fill/20 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                        disabled={clampedSchedulePage === 1}
                        className="rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <p className="text-xs text-av-light-orange">Page {clampedSchedulePage} of {schedulePageCount}</p>
                      <button
                        type="button"
                        onClick={() => setSchedulePage((p) => Math.min(schedulePageCount, p + 1))}
                        disabled={clampedSchedulePage === schedulePageCount}
                        className="rounded-lg border border-av-input-border/30 px-3 py-1 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white disabled:opacity-40"
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── CONTENT LIBRARY ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card">
        <div className="flex items-center justify-between gap-3 border-b border-av-input-border/15 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-av-orange/15">
              <svg className="h-5 w-5 text-av-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5a1.125 1.125 0 01-1.125-1.125m8.625-12.75h-17.25" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-av-white">Content Library</h2>
              <p className="text-xs text-av-light-orange">
                {channelVideos.length} video{channelVideos.length !== 1 ? "s" : ""} · {totalHours.toFixed(1)}h total
              </p>
            </div>
          </div>

          {/* Auto-schedule library */}
          {channelVideos.length >= 2 && (
            <div className="flex items-center gap-3">
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
                {schedulingLibrary ? "Scheduling…" : "Auto-schedule all"}
              </button>
            </div>
          )}
        </div>

        {/* Video management toolbar */}
        {channelVideos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-av-input-border/10 px-6 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-av-light-orange transition-colors hover:text-av-white">
              <input
                type="checkbox"
                checked={selectedVideoIds.size === channelVideos.length && channelVideos.length > 0}
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
            {deletingBulk && <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />}
          </div>
        )}

        {/* Video grid */}
        <div className="px-6 py-4">
          {channelVideos.length === 0 ? (
            <p className="py-6 text-center text-sm text-av-light-orange">Upload a video to start building this channel&apos;s broadcast library.</p>
          ) : (
            <div className="grid max-h-[400px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {channelVideos.map((video) => (
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
                      <p className="truncate text-sm font-semibold text-av-white">{video.title}</p>
                      <p className="mt-0.5 text-xs text-av-light-orange">
                        {formatDuration(video.duration)} · Added {formatTimestamp(video.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      disabled={busy || deletingBulk}
                      className="flex-shrink-0 rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error opacity-0 transition-all hover:bg-av-error/20 group-hover:opacity-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── AFROVISION WAVE ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
        <div className="flex items-center gap-3 mb-5">
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
        <WaveUploadPanel channelId={channelId} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── DANGER ZONE ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
        <h2 className="mb-1 text-sm font-semibold text-red-300">Danger Zone</h2>
        <p className="mb-4 text-xs text-red-300/60">These actions are permanent and cannot be undone.</p>
        <button
          type="button"
          onClick={handleDeleteChannel}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
        >
          {deleting ? "Deleting…" : "Delete this channel"}
        </button>
      </div>
    </div>
  );
}
