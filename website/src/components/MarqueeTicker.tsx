"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

interface Topic {
  id: string;
  text: string;
  priority: number;
  active: boolean;
}

export function MarqueeTicker() {
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API}/home/marquee`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setTopics(data);
          }
        }
      } catch {
        /* silent */
      }
    }
    load();
    const interval = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
