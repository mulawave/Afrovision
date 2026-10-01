"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { getMyPicsApi, type MyPic } from "@/lib/api";

function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyPicsPage() {
  const { isAuthenticated } = useAuth();
  const [pics, setPics] = useState<MyPic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function fetchPics() {
      setLoading(true);
      setError(null);
      const res = await getMyPicsApi();
      if (cancelled) return;
      if (res.ok && "pics" in res.data) {
        setPics(res.data.pics);
      } else {
        setError("Failed to load your PICs");
      }
      setLoading(false);
    }
    fetchPics();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleCopy = async (item: MyPic) => {
    try {
      await navigator.clipboard.writeText(item.pic);
      setCopiedId(item.channel_id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard can be blocked; the code is still visible to copy by hand.
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 pb-16 flex flex-col items-center justify-center gap-4">
        <p className="text-3xl">🔒</p>
        <p className="text-sm text-av-light-orange">Please log in to view your PICs.</p>
        <Link
          href="/login"
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg transition-all"
        >
          Log In
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl lg:text-3xl font-bold text-av-white mb-2">
          My Personal Identifier Codes
        </h1>
        <p className="text-sm text-av-light-orange mb-8">
          Each exclusive channel subscription has its own PIC. Use it to unlock that channel on the
          app, website and AfroVision TV. Keep it private.
        </p>

        {error && (
          <div className="mb-6 rounded-xl bg-av-error/10 border border-av-error/20 p-4 text-sm text-av-error">
            {error}
          </div>
        )}

        {pics.length === 0 && !error ? (
          <div className="text-center py-20 rounded-xl bg-av-card border border-av-input-border/20">
            <p className="text-4xl mb-4">🔑</p>
            <p className="text-sm text-av-light-orange">No PICs yet</p>
            <p className="text-xs text-av-light-orange/70 mt-1">
              Subscribe to an exclusive channel to get your PIC.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pics.map((item) => (
              <div
                key={item.channel_id}
                className="rounded-xl bg-av-card border border-av-input-border/20 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-lg font-bold text-av-dark-blue flex-shrink-0 overflow-hidden">
                    {item.channel_logo ? (
                      <img src={item.channel_logo} alt={item.channel_name} className="w-full h-full object-cover" />
                    ) : (
                      item.channel_name?.charAt(0).toUpperCase() || "📺"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-av-white truncate">
                      {item.channel_name}
                    </h3>
                    <p className="text-xs text-av-light-orange mt-0.5">
                      Subscription expires {formatDate(item.expires_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-av-input-fill border border-av-input-border/30 px-4 py-3">
                  <span className="flex-1 min-w-0 font-mono text-lg font-bold tracking-[0.2em] text-av-orange break-all">
                    {item.pic}
                  </span>
                  <button
                    onClick={() => handleCopy(item)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-av-orange border border-av-orange/40 hover:bg-av-orange/10 transition-all flex-shrink-0"
                  >
                    {copiedId === item.channel_id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
