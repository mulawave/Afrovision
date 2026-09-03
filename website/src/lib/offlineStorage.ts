"use client";

const DB_NAME = "afrovision_offline";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const SEGMENT_STORE = "segment_cache";

export type MediaType = "movie" | "episode";

export interface OfflineVideoMeta {
  id: string;
  mediaType: MediaType;
  mediaId: string;
  title: string;
  poster_url?: string;
  video_source_mode: string;
  manifest_url?: string;
  duration: number;
  downloaded_at: number;
  total_size: number;
  series_id?: string;
  episode_number?: number;
  season_number?: number;
}

export interface OfflineVideoRecord extends OfflineVideoMeta {
  video_blob?: Blob;
  manifest_text?: string;
  segments?: { url: string; blob: Blob; sequence: number }[];
  encryption_key?: Blob;
  encryption_iv?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SEGMENT_STORE)) {
        db.createObjectStore(SEGMENT_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function makeId(mediaType: MediaType, mediaId: string): string {
  return `${mediaType}_${mediaId}`;
}

export async function saveDirectVideo(
  meta: Omit<OfflineVideoMeta, "id" | "downloaded_at" | "total_size">,
  blob: Blob,
): Promise<void> {
  const db = await openDB();
  const id = makeId(meta.mediaType, meta.mediaId);
  const record: OfflineVideoRecord = {
    ...meta,
    id,
    downloaded_at: Date.now(),
    total_size: blob.size,
    video_blob: blob,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveHlsStream(
  meta: Omit<OfflineVideoMeta, "id" | "downloaded_at" | "total_size">,
  manifestText: string,
  segments: { url: string; blob: Blob; sequence: number }[],
  encryptionKey?: Blob,
  encryptionIv?: string,
): Promise<void> {
  const db = await openDB();
  const id = makeId(meta.mediaType, meta.mediaId);
  const totalSize = manifestText.length + segments.reduce((sum, s) => sum + s.blob.size, 0) + (encryptionKey?.size ?? 0);
  const record: OfflineVideoRecord = {
    ...meta,
    id,
    downloaded_at: Date.now(),
    total_size: totalSize,
    manifest_text: manifestText,
    segments,
    encryption_key: encryptionKey,
    encryption_iv: encryptionIv,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVideo(mediaType: MediaType, mediaId: string): Promise<OfflineVideoRecord | null> {
  const db = await openDB();
  const id = makeId(mediaType, mediaId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readonly");
    const req = tx.objectStore(VIDEO_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function isDownloaded(mediaType: MediaType, mediaId: string): Promise<boolean> {
  const record = await getVideo(mediaType, mediaId);
  return !!record;
}

export async function deleteVideo(mediaType: MediaType, mediaId: string): Promise<void> {
  const db = await openDB();
  const id = makeId(mediaType, mediaId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listDownloaded(): Promise<OfflineVideoMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readonly");
    const req = tx.objectStore(VIDEO_STORE).getAll();
    req.onsuccess = () => {
      const records = (req.result as OfflineVideoRecord[]).map((r) => {
        const { video_blob, manifest_text, segments, encryption_key, encryption_iv, ...meta } = r;
        return meta as OfflineVideoMeta;
      });
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDownloadSize(mediaType: MediaType, mediaId: string): Promise<number> {
  const record = await getVideo(mediaType, mediaId);
  return record?.total_size ?? 0;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}

export async function getDownloadCount(): Promise<number> {
  const list = await listDownloaded();
  return list.length;
}

// Segment cache for progressive download
export async function cacheSegment(key: string, blob: Blob, meta: { mediaType: MediaType; mediaId: string; sequence: number; url: string }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENT_STORE, "readwrite");
    tx.objectStore(SEGMENT_STORE).put({ key, blob, ...meta });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedSegment(key: string): Promise<{ blob: Blob; url: string; sequence: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENT_STORE, "readonly");
    const req = tx.objectStore(SEGMENT_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSegmentCache(mediaType: MediaType, mediaId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENT_STORE, "readwrite");
    const store = tx.objectStore(SEGMENT_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result as { key: string; mediaType: MediaType; mediaId: string }[];
      for (const r of records) {
        if (r.mediaType === mediaType && r.mediaId === mediaId) {
          store.delete(r.key);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
