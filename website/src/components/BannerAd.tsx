'use client';

import { useEffect, useState, useCallback } from 'react';
import { serveBannerAdApi, recordAdImpressionApi, type Advertisement } from '@/lib/api';

interface BannerAdProps {
  placement: 'home' | 'page';
  channelId?: string;
  className?: string;
}

export function BannerAd({ placement, channelId, className = '' }: BannerAdProps) {
  const [ad, setAd] = useState<Advertisement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await serveBannerAdApi(placement, channelId);
      if (res.ok && res.data && 'ad' in res.data && res.data.ad) {
        setAd(res.data.ad);
        // Record impression
        recordAdImpressionApi(res.data.ad.id, channelId).catch(() => {});
      }
    } catch { /* silent */ }
  }, [placement, channelId]);

  useEffect(() => {
    load();
    // Refresh banner every 60s
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (!ad) return null;

  const mediaUrl = ad.media_url || '';
  const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 ${className}`}>
      {/* Ad label */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
        <span className="text-[9px] font-semibold text-white/50 tracking-wider uppercase">Sponsored</span>
      </div>

      {/* Ad media */}
      <a
        href={ad.click_url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        {isVideo ? (
          <video
            src={mediaUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-auto max-h-[200px] object-cover"
          />
        ) : mediaUrl ? (
          <img
            src={mediaUrl}
            alt={ad.title || 'Advertisement'}
            className="w-full h-auto max-h-[200px] object-cover"
          />
        ) : (
          /* Text-only fallback */
          <div className="w-full px-6 py-8 bg-gradient-to-r from-av-light-blue/30 to-av-dark-blue/50 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-white/80">{ad.title}</p>
              {ad.description && (
                <p className="text-xs text-white/50 mt-1">{ad.description}</p>
              )}
            </div>
          </div>
        )}
      </a>
    </div>
  );
}
