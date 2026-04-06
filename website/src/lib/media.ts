import { API_BASE } from "@/lib/api";

export function resolveWebsiteMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE.replace(/\/$/, "")}${url}`;
}