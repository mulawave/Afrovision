import { NextRequest } from "next/server";

export const runtime = "nodejs";

function getBackendBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://afrovision-backend-zoeqld5lsa-uc.a.run.app"
  );
}

type ProxyRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handler(req: NextRequest, context: ProxyRouteContext) {
  const params = await context.params;
  const parts: string[] = params.path ?? [];
  const base = getBackendBase().replace(/\/$/, "");
  const path = parts.map((p) => encodeURIComponent(p)).join("/");

  const url = new URL(`${base}/${path}`);
  // Forward query params
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // Build outgoing headers
  const headers = new Headers();
  req.headers.forEach((v, k) => {
    // Hop-by-hop headers should not be forwarded
    if (["connection", "transfer-encoding"].includes(k.toLowerCase())) return;
    headers.set(k, v);
  });

  // Ensure Host header reflects target
  headers.set("host", url.host);

  // Prepare body for non-GET/HEAD
  const method = req.method.toUpperCase();
  let body: BodyInit | undefined = undefined;
  if (!["GET", "HEAD"].includes(method)) {
    const buf = await req.arrayBuffer();
    body = buf.byteLength > 0 ? Buffer.from(buf) : undefined;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body,
    redirect: "manual",
  });

  // Build response, forwarding headers except hop-by-hop
  const outHeaders = new Headers();
  res.headers.forEach((v, k) => {
    if (["connection", "transfer-encoding"].includes(k.toLowerCase())) return;
    outHeaders.set(k, v);
  });

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };
