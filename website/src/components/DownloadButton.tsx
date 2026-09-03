"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type DownloadMeta,
  type DownloadProgress,
  downloadVideo,
  getDownloadSize,
  cancelDownload,
  removeDownload,
  formatBytes,
} from "@/lib/downloadManager";
import { isDownloaded, getStorageEstimate, requestPersistentStorage } from "@/lib/offlineStorage";

interface DownloadButtonProps {
  meta: DownloadMeta;
  className?: string;
}

type State = "idle" | "fetching-size" | "confirming" | "downloading" | "downloaded" | "error";

export function DownloadButton({ meta, className = "" }: DownloadButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadSize, setDownloadSize] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);

  const checkDownloaded = useCallback(async () => {
    const exists = await isDownloaded(meta.mediaType, meta.mediaId);
    if (exists) {
      setState("downloaded");
    } else {
      setState("idle");
    }
  }, [meta.mediaType, meta.mediaId]);

  useEffect(() => {
    void checkDownloaded();
  }, [checkDownloaded]);

  const handleDownloadClick = useCallback(async () => {
    setState("fetching-size");
    setErrorMsg("");

    // Fetch size estimate
    const size = await getDownloadSize(meta);
    setDownloadSize(size);

    // Get storage info
    const storage = await getStorageEstimate();
    setStorageInfo(storage);

    // Request persistent storage
    await requestPersistentStorage();

    if (size === 0) {
      // Can't determine size — proceed anyway with a warning
      setState("confirming");
    } else {
      setState("confirming");
    }
  }, [meta]);

  const handleConfirmDownload = useCallback(async () => {
    setState("downloading");
    setProgress({ percent: 0, downloadedBytes: 0, totalBytes: downloadSize });

    try {
      await downloadVideo(meta, (p) => {
        setProgress(p);
      });
      setState("downloaded");
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        setState("idle");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Download failed");
        setState("error");
      }
    }
  }, [meta, downloadSize]);

  const handleCancelDownload = useCallback(() => {
    cancelDownload(meta.mediaType, meta.mediaId);
    setState("idle");
    setProgress(null);
  }, [meta.mediaType, meta.mediaId]);

  const handleDelete = useCallback(async () => {
    await removeDownload(meta.mediaType, meta.mediaId);
    setState("idle");
    setProgress(null);
  }, [meta.mediaType, meta.mediaId]);

  const handleDismissError = useCallback(() => {
    setState("idle");
    setErrorMsg("");
  }, []);

  // Don't render for embed content
  if (meta.video_source_mode === "embed") {
    return null;
  }

  if (state === "idle") {
    return (
      <button
        onClick={handleDownloadClick}
        className={`inline-flex items-center gap-2 rounded-lg bg-av-card border border-av-input-border/30 px-4 py-2 text-sm font-semibold text-av-white hover:bg-white/5 transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download for offline
      </button>
    );
  }

  if (state === "fetching-size") {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 rounded-lg bg-av-card border border-av-input-border/30 px-4 py-2 text-sm font-semibold text-av-light-orange ${className}`}
      >
        <div className="w-4 h-4 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        Checking size...
      </button>
    );
  }

  if (state === "confirming") {
    return (
      <div className={`inline-flex flex-col gap-3 rounded-xl bg-av-card border border-av-input-border/30 p-4 ${className}`}>
        <div className="text-sm text-av-white">
          {downloadSize > 0 ? (
            <>
              <p className="font-bold">Download size: {formatBytes(downloadSize)}</p>
              {storageInfo && storageInfo.quota > 0 && (
                <p className="text-xs text-av-light-orange mt-1">
                  Storage: {formatBytes(storageInfo.usage)} used of {formatBytes(storageInfo.quota)} available
                </p>
              )}
              {storageInfo && storageInfo.quota > 0 && downloadSize > (storageInfo.quota - storageInfo.usage) && (
                <p className="text-xs text-red-400 mt-1">Warning: This may exceed available storage.</p>
              )}
            </>
          ) : (
            <p className="font-bold">Unable to determine download size.</p>
          )}
          <p className="text-xs text-av-light-orange mt-2">The video will be stored in your browser for offline viewing. You cannot access the file directly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirmDownload}
            className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue font-bold text-xs hover:bg-av-light-orange transition-colors"
          >
            Confirm & Download
          </button>
          <button
            onClick={() => setState("idle")}
            className="px-4 py-2 rounded-lg border border-av-input-border/30 text-av-white text-xs hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === "downloading") {
    const pct = Math.round(progress?.percent ?? 0);
    return (
      <div className={`inline-flex items-center gap-3 rounded-lg bg-av-card border border-av-input-border/30 px-4 py-2 ${className}`}>
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center justify-between text-xs text-av-light-orange mb-1">
            <span>Downloading... {pct}%</span>
            {progress && progress.totalBytes > 0 && (
              <span>{formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-av-input-fill/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-av-orange to-av-light-orange transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleCancelDownload}
          className="text-xs text-red-400 hover:text-red-300 transition-colors font-semibold"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state === "downloaded") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-2 rounded-lg bg-green-600/20 border border-green-600/40 px-4 py-2 text-sm font-semibold text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Downloaded for offline
        </span>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-av-input-border/30 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-600/10 transition-colors"
          title="Remove download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={`inline-flex flex-col gap-3 rounded-xl bg-av-card border border-red-600/40 p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-red-400 font-semibold">{errorMsg}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadClick}
            className="px-4 py-2 rounded-lg bg-av-orange text-av-dark-blue font-bold text-xs hover:bg-av-light-orange transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleDismissError}
            className="px-4 py-2 rounded-lg border border-av-input-border/30 text-av-white text-xs hover:bg-white/5 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
