import { NextRequest, NextResponse } from "next/server";

const PROXY_BASE = "/api/hls-proxy";

function resolveUrl(uri: string, originalUrl: string, baseUrl: string): string | null {
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  } else if (uri.startsWith("/")) {
    try {
      const parsed = new URL(originalUrl);
      return `${parsed.origin}${uri}`;
    } catch {
      return null;
    }
  } else {
    return baseUrl + uri;
  }
}

function rewriteManifest(text: string, originalUrl: string): string {
  const lines = text.split("\n");
  const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf("/") + 1);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." inside #EXT-X-KEY and #EXT-X-MAP tags
      if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const absolute = resolveUrl(uri, originalUrl, baseUrl);
          if (!absolute) return `URI="${uri}"`;
          return `URI="${PROXY_BASE}?url=${encodeURIComponent(absolute)}"`;
        });
      }

      // Skip other comment/tag lines
      if (trimmed.startsWith("#")) return line;

      const absoluteUrl = resolveUrl(trimmed, originalUrl, baseUrl);
      if (!absoluteUrl) return line;

      return `${PROXY_BASE}?url=${encodeURIComponent(absoluteUrl)}`;
    })
    .join("\n");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let targetOrigin: string;
  try {
    targetOrigin = new URL(targetUrl).origin;
  } catch {
    return NextResponse.json({ error: "Invalid url parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        Referer: targetOrigin,
        Origin: targetOrigin,
      },
    });

    if (!res.ok) {
      // On 403, return a fallback response with the direct URL so the client
      // can try fetching directly (some CDNs allow CORS from browser but block server-side)
      if (res.status === 403) {
        return new NextResponse(`Upstream 403 — try direct fetch`, {
          status: 403,
          headers: {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*",
            "X-HLS-Direct-Url": targetUrl,
          },
        });
      }
      return new NextResponse(`Upstream error: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "";
    const isManifest =
      targetUrl.endsWith(".m3u8") || contentType.includes("mpegurl") || contentType.includes("m3u8");

    if (isManifest) {
      const text = await res.text();
      const rewritten = rewriteManifest(text, targetUrl);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Proxy error: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
