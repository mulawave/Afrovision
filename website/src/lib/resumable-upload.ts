"use client";

import {
  getGCSResumableUploadOffset,
  updateVideoUploadSessionProgressApi,
} from "./api";

export interface ResumableUploadOptions {
  file: File;
  sessionId: string;
  sessionUrl: string;
  onProgress?: (percent: number) => void;
  onPaused?: () => void;
  onError?: (error: string) => void;
  onRetrying?: (attempt: number, maxAttempts: number) => void;
  onSpeedUpdate?: (bytesPerSecond: number) => void;
  signal?: AbortSignal;
}

const MIN_CHUNK = 1 * 1024 * 1024;
const DEFAULT_CHUNK = 8 * 1024 * 1024;
const MAX_CHUNK = 16 * 1024 * 1024;
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000;
const PROGRESS_REPORT_INTERVAL_MS = 5000;

function parseResumableRangeHeader(rangeHeader: string | null): number {
  if (!rangeHeader) return 0;
  const match = /bytes=0-(\d+)/i.exec(rangeHeader);
  if (!match) return 0;
  const end = parseInt(match[1], 10);
  if (!Number.isFinite(end) || end < 0) return 0;
  return end + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StoredSession {
  sessionId: string;
  sessionUrl: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  channelId: string;
  title: string;
  createdAt: number;
}

const STORAGE_PREFIX = "afrovision-upload-";

export function saveUploadSession(data: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + data.sessionId, JSON.stringify(data));
  } catch {}
}

export function removeUploadSession(sessionId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + sessionId);
  } catch {}
}

export function getStoredUploadSessions(): StoredSession[] {
  const results: StoredSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        results.push(JSON.parse(raw) as StoredSession);
      } catch {}
    }
  } catch {}
  return results;
}

export class ResumableUploader {
  private opts: ResumableUploadOptions;
  private offset = 0;
  private chunkSize = DEFAULT_CHUNK;
  private aborted = false;
  private paused = false;
  private lastProgressReport = 0;
  private lastSpeedCheck = 0;
  private lastSpeedOffset = 0;
  private consecutiveErrors = 0;

  constructor(opts: ResumableUploadOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    this.aborted = false;
    this.paused = false;

    if (this.offset <= 0) {
      this.offset = await getGCSResumableUploadOffset(
        this.opts.sessionUrl,
        this.opts.file.size,
      );
    }

    this.emitProgress();
    await this.uploadLoop();
  }

  pause(): void {
    this.paused = true;
    this.opts.onPaused?.();
    this.reportProgressToBackend("paused").catch(() => {});
  }

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;
    this.offset = await getGCSResumableUploadOffset(
      this.opts.sessionUrl,
      this.opts.file.size,
    );
    this.emitProgress();
    await this.uploadLoop();
  }

  private async uploadLoop(): Promise<void> {
    const file = this.opts.file;

    while (this.offset < file.size && !this.paused && !this.aborted) {
      if (this.opts.signal?.aborted) {
        this.paused = true;
        return;
      }

      const endExclusive = Math.min(this.offset + this.chunkSize, file.size);
      const chunk = file.slice(this.offset, endExclusive);
      const contentRange = `bytes ${this.offset}-${endExclusive - 1}/${file.size}`;

      try {
        const res = await fetch(this.opts.sessionUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "Content-Range": contentRange,
          },
          body: chunk,
          signal: this.opts.signal,
        });

        if (res.status === 308) {
          const rangeHeader = res.headers.get("Range") ?? res.headers.get("range");
          const confirmedOffset = parseResumableRangeHeader(rangeHeader);
          this.offset = Math.max(confirmedOffset, endExclusive);
        } else if (res.status === 200 || res.status === 201) {
          this.offset = endExclusive;
        } else {
          throw new Error(`Resumable upload failed (${res.status})`);
        }

        this.consecutiveErrors = 0;
        if (this.chunkSize < MAX_CHUNK) {
          this.chunkSize = Math.min(this.chunkSize * 2, MAX_CHUNK);
        }

        this.emitProgress();
        this.maybeReportProgress();
        this.maybeUpdateSpeed();
      } catch (err) {
        if (this.paused || this.aborted) return;

        this.consecutiveErrors++;
        const attempt = this.consecutiveErrors;

        if (this.chunkSize > MIN_CHUNK) {
          this.chunkSize = Math.max(this.chunkSize / 2, MIN_CHUNK);
        }

        if (attempt > MAX_RETRIES) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.opts.onError?.(errorMsg);
          await this.reportProgressToBackend("failed", errorMsg).catch(() => {});
          throw err;
        }

        this.opts.onRetrying?.(attempt, MAX_RETRIES);

        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);

        try {
          this.offset = await getGCSResumableUploadOffset(
            this.opts.sessionUrl,
            file.size,
          );
        } catch {
          // If we can't query offset, keep the current offset and retry
        }
      }
    }

    if (this.offset >= file.size && !this.paused && !this.aborted) {
      this.opts.onProgress?.(100);
    }
  }

  private emitProgress(): void {
    if (this.opts.onProgress) {
      const pct =
        this.opts.file.size <= 0
          ? 0
          : Math.round((this.offset / this.opts.file.size) * 100);
      this.opts.onProgress(pct);
    }
  }

  private maybeReportProgress(): void {
    const now = Date.now();
    if (now - this.lastProgressReport < PROGRESS_REPORT_INTERVAL_MS) return;
    this.lastProgressReport = now;
    this.reportProgressToBackend("uploading").catch(() => {});
  }

  private async reportProgressToBackend(
    status: "uploading" | "paused" | "failed",
    error?: string,
  ): Promise<void> {
    try {
      await updateVideoUploadSessionProgressApi(this.opts.sessionId, {
        uploadedBytes: this.offset,
        status,
        error: error ?? null,
      });
    } catch {}
  }

  private maybeUpdateSpeed(): void {
    if (!this.opts.onSpeedUpdate) return;
    const now = Date.now();
    if (this.lastSpeedCheck === 0) {
      this.lastSpeedCheck = now;
      this.lastSpeedOffset = this.offset;
      return;
    }
    const elapsed = (now - this.lastSpeedCheck) / 1000;
    if (elapsed < 1) return;
    const bytesSent = this.offset - this.lastSpeedOffset;
    const bps = bytesSent / elapsed;
    this.opts.onSpeedUpdate(bps);
    this.lastSpeedCheck = now;
    this.lastSpeedOffset = this.offset;
  }

  getOffset(): number {
    return this.offset;
  }
}
