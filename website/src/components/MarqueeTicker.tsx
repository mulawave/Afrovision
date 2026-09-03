"use client";

import { useEffect, useState } from "react";

const MARQUEE_TTL_MS = 5 * 60_000;

let marqueeCache: Topic[] = [];
let marqueeCacheUpdatedAt = 0;
let marqueeRequestInFlight: Promise<Topic[]> | null = null;

interface Topic {
  id: string;
  text: string;
  priority: number;
  active: boolean;
}

async function getMarqueeTopics(forceRefresh = false): Promise<Topic[]> {
  const now = Date.now();
  if (!forceRefresh && marqueeCache.length > 0 && now - marqueeCacheUpdatedAt < MARQUEE_TTL_MS) {
    return marqueeCache;
  }

  if (!marqueeRequestInFlight) {
    marqueeRequestInFlight = (async () => {
      try {
        const res = await fetch(`/api/proxy/home/marquee`);
        if (!res.ok) {
          return marqueeCache;
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          marqueeCache = data;
          marqueeCacheUpdatedAt = Date.now();
        }

        return marqueeCache;
      } catch {
        return marqueeCache;
      } finally {
        marqueeRequestInFlight = null;
      }
    })();
  }

  return marqueeRequestInFlight;
}

export function MarqueeTicker() {
  const [topics, setTopics] = useState<Topic[]>(() => marqueeCache);

  useEffect(() => {
    let cancelled = false;

    async function load(forceRefresh = false) {
      const nextTopics = await getMarqueeTopics(forceRefresh);
      if (!cancelled && nextTopics.length > 0) {
        setTopics(nextTopics);
      }
    }

    load();

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        load();
      }
    }

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  if (topics.length === 0) return null;

  const joined = topics.map((t) => t.text).join("   •   ");
  // Duplicate for seamless loop
  const marqueeText = `${joined}   •   ${joined}`;

  return (
    <div className="bg-av-dark-blue border-b border-av-orange/15 overflow-hidden">
      <div className="relative py-1.5">
        <div className="marquee-track flex whitespace-nowrap">
          <span className="marquee-content text-[11px] font-medium text-av-light-orange tracking-wide">
            {marqueeText}
          </span>
        </div>
      </div>
      <style jsx>{`
        .marquee-track {
          animation: marquee-scroll 40s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marquee-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
