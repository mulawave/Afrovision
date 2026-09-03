import { API_BASE } from "@/lib/api";

export function resolveWebsiteMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("gs://")) {
    const stripped = url.replace(/^gs:\/\//, "");
    const firstSlash = stripped.indexOf("/");
    if (firstSlash > 0) {
      const bucket = stripped.slice(0, firstSlash);
      const objectPath = stripped.slice(firstSlash + 1);
      return `https://storage.googleapis.com/${bucket}/${objectPath}`;
    }
    return `https://storage.googleapis.com/${stripped}`;
  }
  return `${API_BASE.replace(/\/$/, "")}${url}`;
}