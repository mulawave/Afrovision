"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  getMyChannelsApi,
  getWaveUploadUrlApi,
  registerWaveApi,
  createWaveResumableSessionApi,
  completeWaveResumableSessionApi,
  type Channel,
  type Wave,
  type WaveAgeClassification,
} from "@/lib/api";
import { ResumableUploader, saveUploadSession, removeUploadSession } from "@/lib/resumable-upload";
import {
  CLASSIFICATION_OPTIONS as SHARED_CLASSIFICATION_OPTIONS,
  PUBLIC_CLASSIFICATION_OPTIONS,
  GENERAL_CONTENT_FIELDS,
  ADULT_SENSITIVE_FIELDS,
} from "@/lib/content-rating";

// ── Helpers ────────────────────────────────────────────────────────────────

function guessContentType(file: File): string {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "video/mp4";
}

async function detectDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(vid.duration) || 0); };
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    vid.src = url;
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ALL_CLASSIFICATION_OPTIONS = SHARED_CLASSIFICATION_OPTIONS as Array<{ value: WaveAgeClassification; label: string; hint: string }>;
const PUBLIC_OPTIONS = PUBLIC_CLASSIFICATION_OPTIONS as Array<{ value: WaveAgeClassification; label: string; hint: string }>;

// ── Types ──────────────────────────────────────────────────────────────────

interface WaveUploadEntry {
  id: string;
  file: File;
  title: string;
  description: string;
  ageClassification: WaveAgeClassification;
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
  duration: number;
  detecting: boolean;
  progress: number; // -1 = pending, 0-100 uploading, 101 done
  error: string | null;
  waveId: string | null;
  sessionId: string | null;
  paused: boolean;
  retrying: boolean;
  uploadSpeed: number;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface WaveUploadPanelProps {
  /** If provided, locks the panel to this channel (channel page use case). */
  channelId?: string;
  /** Called after a wave is successfully published. */
  onPublished?: (wave: Wave) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WaveUploadPanel({ channelId: lockedChannelId, onPublished }: WaveUploadPanelProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState(lockedChannelId ?? "");
  const [entries, setEntries] = useState<WaveUploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploaderRefs = useRef<Map<string, ResumableUploader>>(new Map());

  // Load channels (always — needed for public channel restriction even when locked)
  const ensureChannels = useCallback(async () => {
    if (channelsLoaded) return;
    const res = await getMyChannelsApi();
    if (res.ok && "channels" in res.data) {
      setChannels(res.data.channels);
      if (!lockedChannelId && res.data.channels.length > 0 && !selectedChannelId) {
        setSelectedChannelId(res.data.channels[0].id);
      }
    }
    setChannelsLoaded(true);
  }, [channelsLoaded, lockedChannelId, selectedChannelId]);

  const handleChannelChange = (cid: string) => {
    setSelectedChannelId(cid);
  };

  // File picker
  const handleFilePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newEntries: WaveUploadEntry[] = [];
    for (const file of Array.from(files)) {
      const entry: WaveUploadEntry = {
        id: crypto.randomUUID(),
        file,
        title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        description: "",
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
        duration: 0,
        detecting: true,
        progress: -1,
        error: null,
        waveId: null,
        sessionId: null,
        paused: false,
        retrying: false,
        uploadSpeed: 0,
      };
      newEntries.push(entry);
    }
    setEntries((prev) => [...prev, ...newEntries]);

    // Detect durations in parallel
    for (const entry of newEntries) {
      detectDuration(entry.file).then((dur) => {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, duration: dur, detecting: false } : e))
        );
      });
    }
  };

  const updateEntry = (id: string, patch: Partial<WaveUploadEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Upload all
  const handleUploadAll = async () => {
    if (!selectedChannelId || uploading) return;
    const pending = entries.filter((e) => e.progress === -1);
    if (pending.length === 0) return;
    setUploading(true);
    setNotice(null);

    for (const entry of pending) {
      if (!entry.title.trim()) {
        updateEntry(entry.id, { error: "Title is required" });
        continue;
      }
      if (!entry.ageClassification) {
        updateEntry(entry.id, { error: "Age classification is required" });
        continue;
      }
      updateEntry(entry.id, { progress: 0, error: null, retrying: false });

      const contentType = guessContentType(entry.file);

      const fallbackToSignedUrlUpload = async () => {
        const urlRes = await getWaveUploadUrlApi(selectedChannelId, contentType);
        if (!urlRes.ok || !("signed_url" in urlRes.data)) {
          updateEntry(entry.id, { error: "Failed to get upload URL", progress: -1 });
          return null;
        }
        const { signed_url, public_url } = urlRes.data;
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              updateEntry(entry.id, { progress: Math.round((ev.loaded / ev.total) * 95) });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.open("PUT", signed_url);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.send(entry.file);
        });
        updateEntry(entry.id, { progress: 95 });
        const regRes = await registerWaveApi({
          channel_id: selectedChannelId,
          title: entry.title.trim(),
          description: entry.description.trim(),
          video_url: public_url,
          duration: entry.duration,
          age_classification: entry.ageClassification,
          has_explicit_language: entry.hasExplicitLanguage,
          has_nudity: entry.hasNudity,
          has_violence: entry.hasViolence,
          has_revealing_clothes: entry.hasRevealingClothes,
          has_partial_nudity: entry.hasPartialNudity,
          has_explicit_content: entry.hasExplicitContent,
          has_parental_guidance: entry.hasParentalGuidance,
          has_erotic_dancing: entry.hasEroticDancing,
          has_sexual_nature: entry.hasSexualNature,
          has_sex: entry.hasSex,
        });
        if (!regRes.ok || !("id" in regRes.data)) {
          updateEntry(entry.id, { error: "Failed to register wave", progress: -1 });
          return null;
        }
        const wave = regRes.data as Wave;
        updateEntry(entry.id, { progress: 101, waveId: wave.id });
        onPublished?.(wave);
        return wave;
      };

      try {
        const sessionRes = await createWaveResumableSessionApi({
          channel_id: selectedChannelId,
          title: entry.title.trim(),
          description: entry.description.trim(),
          duration: entry.duration,
          file_name: entry.file.name,
          file_size: entry.file.size,
          content_type: contentType,
          age_classification: entry.ageClassification,
          has_explicit_language: entry.hasExplicitLanguage,
          has_nudity: entry.hasNudity,
          has_violence: entry.hasViolence,
          has_revealing_clothes: entry.hasRevealingClothes,
          has_partial_nudity: entry.hasPartialNudity,
          has_explicit_content: entry.hasExplicitContent,
          has_parental_guidance: entry.hasParentalGuidance,
          has_erotic_dancing: entry.hasEroticDancing,
          has_sexual_nature: entry.hasSexualNature,
          has_sex: entry.hasSex,
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
          title: entry.title.trim(),
          createdAt: Date.now(),
        });

        const uploader = new ResumableUploader({
          file: entry.file,
          sessionId: session.id,
          sessionUrl: session.upload_url,
          onProgress: (pct) => updateEntry(entry.id, { progress: pct, error: null }),
          onPaused: () => updateEntry(entry.id, { paused: true }),
          onError: (errMsg) => updateEntry(entry.id, { error: errMsg, retrying: false }),
          onRetrying: (attempt, maxAttempts) => updateEntry(entry.id, { retrying: true, error: `Retrying… attempt ${attempt}/${maxAttempts}` }),
          onSpeedUpdate: (bps) => updateEntry(entry.id, { uploadSpeed: bps }),
        });

        uploaderRefs.current.set(entry.id, uploader);
        await uploader.start();

        if (uploader.getOffset() >= entry.file.size) {
          const completeRes = await completeWaveResumableSessionApi(session.id);
          if (!completeRes.ok || !("wave" in completeRes.data)) {
            updateEntry(entry.id, { error: "Failed to complete wave upload", progress: -1 });
            continue;
          }
          removeUploadSession(session.id);
          const wave = completeRes.data.wave;
          updateEntry(entry.id, { progress: 101, waveId: wave.id, error: null, sessionId: null });
          onPublished?.(wave);
        }
      } catch {
        uploaderRefs.current.delete(entry.id);
        await fallbackToSignedUrlUpload();
      }
    }

    setUploading(false);
    setNotice("Upload complete");
    setTimeout(() => setNotice(null), 4000);
  };

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
      const entry = entries.find((e) => e.id === entryId);
      if (entry && uploader.getOffset() >= entry.file.size) {
        const completeRes = await completeWaveResumableSessionApi(entry.sessionId!);
        if (completeRes.ok && "wave" in completeRes.data) {
          removeUploadSession(entry.sessionId!);
          updateEntry(entryId, { progress: 101, waveId: completeRes.data.wave.id, error: null, sessionId: null });
          onPublished?.(completeRes.data.wave);
        }
      }
    } catch {
      updateEntry(entryId, { error: "Resume failed. Please retry.", progress: -1 });
    }
  }

  // Load channels on first render (always — needed for public channel check)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ensureChannels();
  }, [ensureChannels]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const isPublicChannel = selectedChannel?.type === "public";
  const availableClassificationOptions = isPublicChannel ? PUBLIC_OPTIONS : ALL_CLASSIFICATION_OPTIONS;

  const allDone = entries.length > 0 && entries.every((e) => e.progress === 101 || e.error);
  const hasPending = entries.some((e) => e.progress === -1);

  return (
    <div className="flex flex-col gap-6">
      {/* Channel selector (only if not locked) */}
      {!lockedChannelId && (
        <div>
          <label className="block text-white/60 text-xs font-semibold mb-1.5 uppercase tracking-wide">
            Channel
          </label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400"
            value={selectedChannelId}
            onChange={(e) => handleChannelChange(e.target.value)}
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id} style={{ background: "#050A30" }}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-orange-400/60 transition-colors"
        style={{ background: "rgba(249,150,23,0.04)" }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFilePick(e.dataTransfer.files); }}
      >
        <span className="text-4xl">⚡</span>
        <p className="text-white/70 text-sm font-medium">Drop short videos here or click to browse</p>
        <p className="text-white/30 text-xs">MP4, WebM, MOV · Up to 3 minutes recommended</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilePick(e.target.files)}
        />
      </div>

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-white/10 p-4 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-start gap-3">
                {/* Mini video preview */}
                <video
                  src={URL.createObjectURL(entry.file)}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                  muted
                />

                <div className="flex-1 flex flex-col gap-2">
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-400"
                    placeholder="Wave title"
                    value={entry.title}
                    onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                    disabled={entry.progress > 0}
                  />
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-orange-400 resize-none"
                    placeholder="Description (optional)"
                    rows={2}
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                    disabled={entry.progress > 0}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-white/70">
                      <span>Audience Classification</span>
                      <select
                        className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-400"
                        value={entry.ageClassification}
                        onChange={(e) => {
                          const newAc = e.target.value as WaveAgeClassification;
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
                        disabled={entry.progress > 0}
                      >
                        {availableClassificationOptions.map((option) => (
                          <option key={option.value} value={option.value} style={{ background: "#050A30" }}>
                            {option.label} - {option.hint}
                          </option>
                        ))}
                      </select>
                      {isPublicChannel && (
                        <span className="text-[10px] text-white/40">Public channels cannot upload 18+ content.</span>
                      )}
                    </label>
                    <div className="grid grid-cols-1 gap-1 text-xs text-white/70">
                      {GENERAL_CONTENT_FIELDS.map((field) => {
                        const keyMap: Record<string, keyof WaveUploadEntry> = {
                          has_explicit_language: "hasExplicitLanguage",
                          has_violence: "hasViolence",
                          has_parental_guidance: "hasParentalGuidance",
                        };
                        const entryKey = keyMap[field.key] ?? (field.key as keyof WaveUploadEntry);
                        return (
                          <label key={String(field.key)} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(entry[entryKey])}
                              onChange={(e) => updateEntry(entry.id, { [entryKey]: e.target.checked } as Partial<WaveUploadEntry>)}
                              disabled={entry.progress > 0}
                            />
                            <span>{field.label}</span>
                          </label>
                        );
                      })}
                      {entry.ageClassification === "adult" && !isPublicChannel &&
                        ADULT_SENSITIVE_FIELDS.map((field) => {
                          const keyMap: Record<string, keyof WaveUploadEntry> = {
                            has_nudity: "hasNudity",
                            has_partial_nudity: "hasPartialNudity",
                            has_explicit_content: "hasExplicitContent",
                            has_erotic_dancing: "hasEroticDancing",
                            has_sexual_nature: "hasSexualNature",
                            has_sex: "hasSex",
                            has_revealing_clothes: "hasRevealingClothes",
                          };
                          const entryKey = keyMap[field.key] ?? (field.key as keyof WaveUploadEntry);
                          return (
                            <label key={String(field.key)} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(entry[entryKey])}
                                onChange={(e) => updateEntry(entry.id, { [entryKey]: e.target.checked } as Partial<WaveUploadEntry>)}
                                disabled={entry.progress > 0}
                              />
                              <span>{field.label}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    {entry.detecting ? (
                      <span>Detecting duration…</span>
                    ) : (
                      <span>Duration: {formatDuration(entry.duration)}</span>
                    )}
                    <span>·</span>
                    <span>{(entry.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                </div>

                {entry.progress !== 101 && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="text-white/30 hover:text-red-400 text-lg shrink-0 transition-colors"
                    disabled={entry.progress > 0 && entry.progress < 101}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {entry.progress >= 0 && entry.progress < 101 && (
                <div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${entry.progress}%`,
                        background: "linear-gradient(to right, #F49617, #F5C16C)",
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-white/50">
                      {entry.paused
                        ? "Paused"
                        : entry.retrying
                          ? entry.error
                          : entry.progress < 100
                            ? `Uploading ${entry.progress}%${entry.uploadSpeed > 0 ? ` · ${(entry.uploadSpeed / 1024 / 1024).toFixed(1)} MB/s` : ""}`
                            : "Publishing…"}
                    </p>
                    {entry.sessionId && (
                      <div className="flex items-center gap-1.5">
                        {entry.paused ? (
                          <button
                            onClick={() => handleResumeUpload(entry.id)}
                            className="rounded-md bg-orange-400/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400 transition-all hover:bg-orange-400/30"
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePauseUpload(entry.id)}
                            className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60 transition-all hover:bg-white/20"
                          >
                            Pause
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* States */}
              {entry.progress === 101 && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <span>✓</span>
                  <span>Published to Wave feed</span>
                  <a href="/wave" className="ml-auto text-orange-400 hover:underline">
                    View ↗
                  </a>
                </div>
              )}
              {entry.error && (
                <p className="text-xs text-red-400">{entry.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleUploadAll}
            disabled={uploading || !hasPending || !selectedChannelId}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #F49617, #F5C16C)",
              color: "#050A30",
            }}
          >
            {uploading ? "Uploading…" : allDone ? "All Published ✓" : `Publish ${entries.filter((e) => e.progress === -1).length} Wave${entries.filter((e) => e.progress === -1).length !== 1 ? "s" : ""}`}
          </button>
          {!uploading && (
            <button
              onClick={() => setEntries([])}
              className="px-4 py-3 rounded-xl text-sm text-white/50 hover:text-white transition-colors border border-white/10"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {notice && (
        <div className="rounded-xl py-3 px-4 text-sm text-green-400 border border-green-400/20 bg-green-400/5">
          {notice}
        </div>
      )}

    </div>
  );
}
