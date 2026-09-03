"use client";

import { useEffect, useRef, useState } from "react";

interface SeekBarDownloadIndicatorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  downloadedRange: { start: number; end: number } | null;
  className?: string;
}

export function SeekBarDownloadIndicator({
  videoRef,
  downloadedRange,
  className = "",
}: SeekBarDownloadIndicatorProps) {
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDuration = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.addEventListener("loadedmetadata", updateDuration);
    video.addEventListener("durationchange", updateDuration);

    return () => {
      video.removeEventListener("loadedmetadata", updateDuration);
      video.removeEventListener("durationchange", updateDuration);
    };
  }, [videoRef]);

  if (!downloadedRange || duration <= 0) return null;

  const startPercent = (downloadedRange.start / duration) * 100;
  const endPercent = (downloadedRange.end / duration) * 100;
  const width = endPercent - startPercent;

  if (width <= 0) return null;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute bottom-[6px] left-0 right-0 z-[1] ${className}`}
      style={{ height: "3px" }}
    >
      <div
        className="absolute h-full bg-white/30 rounded-full"
        style={{
          left: `${startPercent}%`,
          width: `${width}%`,
        }}
      />
    </div>
  );
}
