import { API_BASE } from "@/lib/api";

export async function getStaticPageContent<T = unknown>(slug: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE}/home/page-content/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return (payload?.content || null) as T | null;
  } catch {
    return null;
  }
}
