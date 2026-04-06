"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type Channel,
  type ChannelVideo,
  type ScheduleProgram,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

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

export default function CreatorStudioPage() {
  const { isAuthenticated, user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [schedule, setSchedule] = useState<ScheduleProgram[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDuration, setUploadDuration] = useState("0");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(-1);
  const [scheduleVideoId, setScheduleVideoId] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");

  const loadStudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [channelsRes, videosRes] = await Promise.all([getMyChannelsApi(), getMyVideosApi()]);

    if (channelsRes.ok && "channels" in channelsRes.data) {
      setChannels(channelsRes.data.channels);
      const nextChannelId = selectedChannelId || channelsRes.data.channels[0]?.id || "";
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
    [videos, selectedChannelId]
  );

  const totalHours = useMemo(
    () => videos.reduce((sum, video) => sum + video.duration, 0) / 3600,
    [videos]
  );

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedChannelId || !uploadTitle.trim() || !uploadFile) {
      setError("Choose a channel, title, and video file before uploading.");
      return;
    }

    setBusy(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Step 1: Get signed URL from backend
      const urlRes = await getVideoUploadUrlApi({
        contentType: uploadFile.type || "video/mp4",
        fileName: uploadFile.name,
      });
      if (!urlRes.ok || !("signed_url" in urlRes.data)) {
        const msg = "error" in urlRes.data ? urlRes.data.error : "Failed to prepare upload.";
        setError(msg);
        setBusy(false);
        setUploadProgress(-1);
        return;
      }

      const { signed_url, public_url } = urlRes.data;

      // Step 2: Upload directly to GCS (fast, no backend middleman)
      await uploadFileToGCS(signed_url, uploadFile, (percent) => {
        setUploadProgress(percent);
      });

      // Step 3: Register in backend
      const regRes = await registerUploadedVideoApi({
        channelId: selectedChannelId,
        title: uploadTitle.trim(),
        duration: Number(uploadDuration) || 0,
        videoUrl: public_url,
      });

      if (!regRes.ok) {
        setError("error" in regRes.data ? regRes.data.error : "Video uploaded but registration failed.");
      } else {
        setUploadTitle("");
        setUploadDuration("0");
        setUploadFile(null);
        await loadStudio();
        await loadSchedule(selectedChannelId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setBusy(false);
      setUploadProgress(-1);
    }
  }

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
      setError("error" in res.data ? res.data.error : "Could not delete video.");
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
      setError("error" in res.data ? res.data.error : "Could not remove scheduled program.");
    } else {
      await loadSchedule(selectedChannelId);
    }
    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-hint">Sign in to access Creator Studio.</p>
          <Link href="/login?redirect=/creator-studio" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
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
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Creator Studio</p>
          <h1 className="mt-3 text-3xl font-bold text-av-white">Creator access required</h1>
          <p className="mt-4 text-sm text-av-hint">Creator Studio is available to creator and admin accounts. Upgrade first, then come back here to publish channels and schedule broadcasts.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/profile" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white">
              Open profile
            </Link>
            <Link href="/create-channel" className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue">
              Review channel setup
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Creator Studio — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Creator Studio</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Broadcast Operations</h1>
            <p className="mt-2 max-w-2xl text-sm text-av-hint">Manage channels, upload playback videos, and assemble the next scheduled stream block from one workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/create-channel" className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue">
              Create channel
            </Link>
            <Link href="/channels" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white">
              Discovery
            </Link>
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-av-error/30 bg-av-error/5 p-4 text-sm text-av-error">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-10 text-center">
            <h2 className="text-2xl font-semibold text-av-white">No channels yet</h2>
            <p className="mt-3 text-sm text-av-hint">Start by creating your first channel, then return here to upload content and schedule programs.</p>
            <Link href="/create-channel" className="mt-6 inline-flex rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue">
              Create your first channel
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Channels" value={String(channels.length)} />
              <StatCard label="Videos" value={String(videos.length)} />
              <StatCard label="Scheduled Slots" value={String(schedule.length)} />
              <StatCard label="Library Hours" value={`${totalHours.toFixed(1)}h`} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="space-y-6">
                <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-av-white">Your channels</h2>
                    <select value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)} className="h-10 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none">
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>{channel.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 space-y-3">
                    {channels.map((channel) => (
                      <div key={channel.id} className={`rounded-2xl border p-4 ${channel.id === selectedChannelId ? "border-av-orange/40 bg-av-input-fill/60" : "border-av-input-border/20 bg-av-input-fill/20"}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-av-white">{channel.name}</p>
                            <p className="mt-1 text-xs text-av-hint">#{channel.channel_number} · {channel.type} · {channel.category}</p>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/channel/${channel.id}`} className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-white/80">
                              Channel
                            </Link>
                            <Link href={`/live/${channel.id}`} className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1.5 text-xs font-semibold text-av-orange">
                              Live page
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleUpload} className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <h2 className="text-lg font-semibold text-av-white">Upload video</h2>
                  <div className="mt-4 grid gap-4">
                    <input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="Video title" className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-hint/60 focus:border-av-orange/50 focus:outline-none" />
                    <input value={uploadDuration} onChange={(event) => setUploadDuration(event.target.value.replace(/[^\d]/g, ""))} placeholder="Duration in seconds" className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-hint/60 focus:border-av-orange/50 focus:outline-none" />
                    <input type="file" accept="video/*" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className="block w-full text-sm text-av-white file:mr-4 file:rounded-full file:border-0 file:bg-av-orange file:px-4 file:py-2 file:font-semibold file:text-av-dark-blue" />

                    {/* Progress bar */}
                    {uploadProgress >= 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-av-hint">
                            {uploadProgress < 100 ? "Uploading to cloud..." : "Registering video..."}
                          </span>
                          <span className="font-semibold text-av-light-orange">{uploadProgress}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-av-input-fill">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-200 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={busy} className="relative rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60">
                      {busy ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {uploadProgress >= 0 ? `Uploading ${uploadProgress}%` : "Saving..."}
                        </span>
                      ) : (
                        "Upload to library"
                      )}
                    </button>
                  </div>
                </form>
              </section>

              <section className="space-y-6">
                <form onSubmit={handleSchedule} className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <h2 className="text-lg font-semibold text-av-white">Schedule next program</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <select value={scheduleVideoId} onChange={(event) => setScheduleVideoId(event.target.value)} className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none md:col-span-2">
                      <option value="">Select a video from this channel</option>
                      {selectedChannelVideos.map((video) => (
                        <option key={video.id} value={video.id}>{video.title} ({video.duration}s)</option>
                      ))}
                    </select>
                    <input type="datetime-local" value={scheduleStart} min={toDateTimeLocal(new Date().toISOString())} onChange={(event) => setScheduleStart(event.target.value)} className="h-12 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none md:col-span-2" />
                    <button type="submit" disabled={busy || selectedChannelVideos.length === 0} className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60 md:col-span-2">
                      {busy ? "Scheduling..." : "Add to schedule"}
                    </button>
                  </div>
                </form>

                <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-av-white">Scheduled lineup</h2>
                    <span className="text-xs text-av-hint">{schedule.length} slots</span>
                  </div>
                  {schedule.length === 0 ? (
                    <p className="mt-4 text-sm text-av-hint">No programs scheduled for this channel yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {schedule.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-av-white">{item.video_title}</p>
                              <p className="mt-1 text-xs text-av-hint">Starts {formatTimestamp(item.start_time)} · Ends {formatTimestamp(item.end_time)}</p>
                            </div>
                            <button onClick={() => handleDeleteProgram(item.id)} disabled={busy} className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error disabled:opacity-50">
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
                    <h2 className="text-lg font-semibold text-av-white">Video library</h2>
                    <span className="text-xs text-av-hint">{selectedChannelVideos.length} for this channel</span>
                  </div>
                  {selectedChannelVideos.length === 0 ? (
                    <p className="mt-4 text-sm text-av-hint">Upload a video to start building this channel’s broadcast library.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {selectedChannelVideos.map((video) => (
                        <div key={video.id} className="rounded-2xl border border-av-input-border/20 bg-av-input-fill/30 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-av-white">{video.title}</p>
                              <p className="mt-1 text-xs text-av-hint">{video.duration}s · Added {formatTimestamp(video.created_at)}</p>
                            </div>
                            <button onClick={() => handleDeleteVideo(video.id)} disabled={busy} className="rounded-full border border-av-error/30 bg-av-error/5 px-3 py-1.5 text-xs font-semibold text-av-error disabled:opacity-50">
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
      <p className="text-[11px] uppercase tracking-wider text-av-hint">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-av-white">{value}</p>
    </div>
  );
}
