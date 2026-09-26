/**
 * Public ticker feed for embedding the marquee on other sites
 * (served with /ticker.js from this site's public/ folder).
 *
 * Returns only the active topic texts, in priority order:
 *   { "items": ["...", "..."] }
 * The upstream API address stays server-side; callers only ever see this
 * site's domain. Any origin may read it (it's public marquee text).
 */
export const runtime = "nodejs";
export const revalidate = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getBackendBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://afrovision-backend-zoeqld5lsa-uc.a.run.app"
  );
}

type Topic = { text?: unknown; priority?: unknown; active?: unknown };

export async function GET() {
  let items: string[] = [];
  try {
    const res = await fetch(`${getBackendBase()}/home/marquee`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data: unknown = await res.json();
      items = (Array.isArray(data) ? (data as Topic[]) : [])
        .filter((t) => t && t.active !== false)
        .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0))
        .map((t) => (typeof t.text === "string" ? t.text.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Upstream unreachable: return an empty list; the widget keeps its cached text.
  }

  return Response.json(
    { items },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
