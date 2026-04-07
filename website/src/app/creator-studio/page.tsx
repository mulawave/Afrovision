"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  deleteProgramApi,
  deleteVideoApi,
  getChannelScheduleApi,
  getMyChannelsApi,
  getMyVideosApi,
  getVideoUploadUrlApi,
  uploadFileToGCS,
  registerUploadedVideoApi,
  scheduleProgramApi,
  scheduleSequentialApi,
  type Channel,
  type ChannelVideo,
  type ScheduleProgram,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

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
  duration: number;
  detecting: boolean;
  progress: number; // -1 = pending, 0-100 = uploading, 101 = registered
  error: string | null;
  registeredVideoId: string | null;
}

/* ── page component ──────────────────────────────────── */

export default function CreatorStudioPage() {
  const { isAuthenticated, user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleProgram[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Multi-upload state
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-schedule state
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [autoScheduleStart, setAutoScheduleStart] = useState("");
  const [schedulingBulk, setSchedulingBulk] = useState(false);

  // ── Single schedule state (kept for scheduling existing library videos)
  const [scheduleVideoId, setScheduleVideoId] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");

  // ── Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
      setSelectedChannelId(nextChannelId);
    } else {
      setError("Failed to load your channels.");
    }

    if (videosRes.ok && "videos" in videosRes.data) {
      setVideos(videosRes.data.videos);
    }

    setLoading(false);
  }, [selectedChannelId]);

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
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedChannelId, loadSchedule]);

  const selectedChannelVideos = useMemo(
    () => videos.filter((video) => video.channel_id === selectedChannelId),
    [videos, selectedChannelId],
  );

  const totalHours = useMemo(
    () => videos.reduce((sum, video) => sum + video.duration, 0) / 3600,
    [videos],
  );

  /* ── Multi-file picker ─────────────────────────────── */

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newEntries: UploadEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newEntries.push({
        id: `${Date.now()}-${i}`,
        file,
        title: titleFromFilename(file.name),
        duration: 0,
        detecting: true,
        progress: -1,
        error: null,
        registeredVideoId: null,
      });
    }
    setUploadEntries((prev) => [...prev, ...newEntries]);

    // Detect durations in parallel
    for (const entry of newEntries) {
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

    for (const entry of pending) {
      try {
        // Step 1: Get signed URL
        updateEntry(entry.id, { progress: 0 });
        const urlRes = await getVideoUploadUrlApi({
          contentType: entry.file.type || "video/mp4",
          fileName: entry.file.name,
        });
        if (!urlRes.ok || !("signed_url" in urlRes.data)) {
          updateEntry(entry.id, {
            error: "Failed to get upload URL",
            progress: -1,
          });
          continue;
        }

        const { signed_url, public_url } = urlRes.data;

        // Step 2: Upload to GCS
        await uploadFileToGCS(signed_url, entry.file, (pct) => {
          updateEntry(entry.id, { progress: pct });
        });

        // Step 3: Register
        const regRes = await registerUploadedVideoApi({
          channelId: selectedChannelId,
          title: entry.title.trim() || titleFromFilename(entry.file.name),
          duration: entry.duration,
          videoUrl: public_url,
        });

        if (!regRes.ok) {
          updateEntry(entry.id, {
            error:
              "error" in regRes.data
                ? regRes.data.error
                : "Registration failed",
            progress: -1,
          });
        } else {
          const vid = "video" in regRes.data ? regRes.data.video : null;
          updateEntry(entry.id, {
            progress: 101,
            registeredVideoId: vid?.id ?? null,
          });
        }
      } catch (err: unknown) {
        updateEntry(entry.id, {
          error: err instanceof Error ? err.message : "Upload failed",
          progress: -1,
        });
      }
    }

    await loadStudio();
    await loadSchedule(selectedChannelId);
    setUploadingAll(false);

    // Check if any succeeded — offer auto-schedule
    const updated = uploadEntries.filter(
      (e) => e.progress === 101 && e.registeredVideoId,
    );
    if (updated.length > 0) {
      setShowAutoSchedule(true);
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

  async function handleDeleteVideo(videoId: string) {
    setBusy(true);
    setError(null);
    const res = await deleteVideoApi(videoId);
    if (!res.ok) {
      setError(
        "error" in res.data ? res.data.error : "Could not delete video.",
      );
    } else {
      await loadStudio();
      await loadSchedule(selectedChannelId);
    }
    setBusy(false);
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

  /* ── derived ───────────────────────────────────────── */

  const pendingUploads = uploadEntries.filter((e) => e.progress === -1);
  const completedUploads = uploadEntries.filter((e) => e.progress === 101);
  const totalUploadDuration = uploadEntries.reduce(
    (s, e) => s + e.duration,
    0,
  );

  /* ── guards ────────────────────────────────────────── */

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-hint">
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
          <p className="mt-4 text-sm text-av-hint">
            Creator Studio is available to creator and admin accounts. Upgrade
            first, then come back here to publish channels and schedule
            broadcasts.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white"
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
              <p className="mt-2 max-w-2xl text-sm text-av-hint">
                Manage channels, upload playback videos, and assemble the next
                scheduled stream block from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/create-channel"
                className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
              >
                Create channel
              </Link>
              <Link
                href="/channels"
                className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white"
              >
                Discovery
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
              <p className="mt-3 text-sm text-av-hint">
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

              <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                {/* ════ LEFT COLUMN ════ */}
                <section className="space-y-6">
                  {/* Channel selector */}
                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Your channels
                      </h2>
                      <select
                        value={selectedChannelId}
                        onChange={(event) =>
                          setSelectedChannelId(event.target.value)
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
                      {channels.map((channel) => (
                        <div
                          key={channel.id}
                          className={`rounded-2xl border p-4 ${channel.id === selectedChannelId ? "border-av-orange/40 bg-av-input-fill/60" : "border-av-input-border/20 bg-av-input-fill/20"}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-av-white">
                                {channel.name}
                              </p>
                              <p className="mt-1 text-xs text-av-hint">
                                #{channel.channel_number} · {channel.type} ·{" "}
                                {channel.category}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/channel/${channel.id}`}
                                className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-white/80"
                              >
                                Channel
                              </Link>
                              <Link
                                href={`/live/${channel.id}`}
                                className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1.5 text-xs font-semibold text-av-orange"
                              >
                                Live page
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Multi-upload form ── */}
                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Upload videos
                      </h2>
                      {uploadEntries.length > 0 && (
                        <span className="text-xs text-av-hint">
                          {uploadEntries.length} file
                          {uploadEntries.length > 1 ? "s" : ""} ·{" "}
                          {formatDuration(totalUploadDuration)}
                        </span>
                      )}
                    </div>

                    {/* File picker */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
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
                        className="mx-auto mb-2 h-8 w-8 text-av-hint"
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
                      <p className="mt-1 text-xs text-av-hint">
                        Choose multiple files at once · Duration auto-detected
                      </p>
                    </button>

                    {/* File list — drag to reorder */}
                    {uploadEntries.length > 0 && (
                      <div className="mt-4 space-y-2">
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
                              <div className="flex-shrink-0 pt-1 text-av-hint/40">
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
                                  className="w-full bg-transparent text-sm font-semibold text-av-white placeholder:text-av-hint/60 focus:outline-none disabled:opacity-80"
                                  placeholder="Video title"
                                />
                                <div className="mt-1 flex items-center gap-3">
                                  <span className="text-xs text-av-hint">
                                    {entry.detecting ? (
                                      <span className="animate-pulse">
                                        Detecting duration...
                                      </span>
                                    ) : (
                                      formatDuration(entry.duration)
                                    )}
                                  </span>
                                  <span className="text-xs text-av-hint/50">
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
                                      <p className="mt-1 text-[10px] text-av-hint">
                                        {entry.progress < 100
                                          ? `Uploading ${entry.progress}%`
                                          : "Registering..."}
                                      </p>
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
                            disabled={uploadingAll || !selectedChannelId}
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

                        {/* Auto-schedule panel (appears after uploads complete) */}
                        {showAutoSchedule && completedUploads.length > 0 && (
                          <div className="mt-3 rounded-2xl border border-av-orange/30 bg-av-orange/5 p-5">
                            <h3 className="mb-1 text-sm font-semibold text-av-white">
                              Auto-schedule uploads
                            </h3>
                            <p className="mb-4 text-xs text-av-hint">
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
                              className="mt-2 text-xs text-av-hint transition-colors hover:text-av-white"
                            >
                              Skip — I&apos;ll schedule manually
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* ════ RIGHT COLUMN ════ */}
                <section className="space-y-6">
                  <form
                    onSubmit={handleSchedule}
                    className="rounded-3xl border border-av-input-border/30 bg-av-card p-6"
                  >
                    <h2 className="text-lg font-semibold text-av-white">
                      Schedule next program
                    </h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <select
                        value={scheduleVideoId}
                        onChange={(event) =>
                          setScheduleVideoId(event.target.value)
                        }
                        className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none md:col-span-2"
                      >
                        <option value="">
                          Select a video from this channel
                        </option>
                        {selectedChannelVideos.map((video) => (
                          <option key={video.id} value={video.id}>
                            {video.title} ({video.duration}s)
                          </option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={scheduleStart}
                        min={toDateTimeLocal(new Date().toISOString())}
                        onChange={(event) =>
                          setScheduleStart(event.target.value)
                        }
                        className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none md:col-span-2"
                      />
                      <button
                        type="submit"
                        disabled={busy || selectedChannelVideos.length === 0}
                        className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60 md:col-span-2"
                      >
                        {busy ? "Scheduling..." : "Add to schedule"}
                      </button>
                    </div>
                  </form>

                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Scheduled lineup
                      </h2>
                      <span className="text-xs text-av-hint">
                        {schedule.length} slots
                      </span>
                    </div>
                    {schedule.length === 0 ? (
                      <p className="mt-4 text-sm text-av-hint">
                        No programs scheduled for this channel yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {schedule.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-av-white">
                                  {item.video_title}
                                </p>
                                <p className="mt-1 text-xs text-av-hint">
                                  Starts {formatTimestamp(item.start_time)} ·
                                  Ends {formatTimestamp(item.end_time)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteProgram(item.id)}
                                disabled={busy}
                                className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-av-white">
                        Video library
                      </h2>
                      <span className="text-xs text-av-hint">
                        {selectedChannelVideos.length} for this channel
                      </span>
                    </div>
                    {selectedChannelVideos.length === 0 ? (
                      <p className="mt-4 text-sm text-av-hint">
                        Upload a video to start building this channel&apos;s
                        broadcast library.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {selectedChannelVideos.map((video) => (
                          <div
                            key={video.id}
                            className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-av-white">
                                  {video.title}
                                </p>
                                <p className="mt-1 text-xs text-av-hint">
                                  {video.duration}s · Added{" "}
                                  {formatTimestamp(video.created_at)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                disabled={busy}
                                className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
      <p className="text-[11px] uppercase tracking-wider text-av-hint">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-av-white">{value}</p>
    </div>
  );
}
