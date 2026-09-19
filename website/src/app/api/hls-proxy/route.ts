import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

const PROXY_BASE = "/api/hls-proxy";

// SSRF guard: this proxy has to reach arbitrary externally-hosted stream
// origins (channels are imported from many different CDNs), so we can't use
// a hostname allowlist. Instead we block requests that resolve to internal /
// link-local / loopback addresses — including the cloud metadata service —
// both by literal IP in the URL and by DNS resolution (to stop rebinding).
function isDisallowedIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (incl. metadata)
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    return false;
  }
  return false;
}

async function assertUrlIsSafeToFetch(targetUrl: string): Promise<void> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  const hostname = parsed.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    throw new Error("Target host is not allowed");
  }
  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) {
      throw new Error("Target host is not allowed");
    }
    return;
  }
  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new Error("Could not resolve target host");
  }
  if (addresses.length === 0 || addresses.some(isDisallowedIp)) {
    throw new Error("Target host is not allowed");
  }
}

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
    await assertUrlIsSafeToFetch(targetUrl);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
