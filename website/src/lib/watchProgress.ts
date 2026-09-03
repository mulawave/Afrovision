"use client";

import { getToken, saveWatchProgressApi, getWatchProgressApi } from "@/lib/api";

const LS_KEY = "av_watch_progress";

type MediaType = "movie" | "episode";

interface LocalProgress {
  position: number;
  duration: number;
  updatedAt: number;
}

function lsGetAll(): Record<string, LocalProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function lsSetAll(data: Record<string, LocalProgress>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

function key(mediaType: MediaType, mediaId: string) {
  return `${mediaType}_${mediaId}`;
}

export async function saveProgress(
  mediaType: MediaType,
  mediaId: string,
  position: number,
  duration: number,
) {
  // Always save to localStorage as fallback
  const all = lsGetAll();
  all[key(mediaType, mediaId)] = { position, duration, updatedAt: Date.now() };
  lsSetAll(all);

  // If logged in, also save to server
  if (getToken()) {
    try {
      await saveWatchProgressApi(mediaType, mediaId, position, duration);
    } catch {
      // network error — localStorage already has it
    }
  }
}

export async function loadProgress(
  mediaType: MediaType,
  mediaId: string,
): Promise<{ position: number; duration: number } | null> {
  // If logged in, try server first
  if (getToken()) {
    try {
      const res = await getWatchProgressApi(mediaType, mediaId);
      if (res.ok && "data" in res.data && res.data.data) {
        return {
          position: res.data.data.position_seconds,
          duration: res.data.data.duration_seconds,
        };
      }
    } catch {
      // fall through to localStorage
    }
  }

  // Fallback to localStorage
  const all = lsGetAll();
  const local = all[key(mediaType, mediaId)];
  if (local) {
    return { position: local.position, duration: local.duration };
  }

  return null;
}

export function clearProgress(mediaType: MediaType, mediaId: string) {
  const all = lsGetAll();
  delete all[key(mediaType, mediaId)];
  lsSetAll(all);
}

export function shouldResume(
  position: number,
  duration: number,
): boolean {
  if (!position || position < 5) return false;
  if (!duration || duration <= 0) return false;
  if (position / duration >= 0.95) return false;
  return true;
}
