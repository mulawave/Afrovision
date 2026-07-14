'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback, useRef } from 'react';
import { serveBannerAdApi, recordAdImpressionApi, recordAdClickApi, type Advertisement } from '@/lib/api';
import { resolveWebsiteMediaUrl } from '@/lib/media';

const BANNER_TTL_MS = 60_000;

const bannerCache = new Map<string, { ad: Advertisement | null; updatedAt: number }>();
const bannerRequestInFlight = new Map<string, Promise<Advertisement | null>>();

function getAdSessionId() {
  if (typeof window === 'undefined') return undefined;
  const key = 'afrovision_ad_session_id';
  let existing = window.sessionStorage.getItem(key);
  if (!existing) {
    existing = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, existing);
  }
  return existing;
}

interface BannerAdProps {
  placement: 'home' | 'page';
  channelId?: string;
  className?: string;
}

function getBannerCacheKey(placement: BannerAdProps['placement'], channelId?: string) {
  return `${placement}:${channelId ?? ''}`;
}

async function getBannerAd(
  placement: BannerAdProps['placement'],
  channelId?: string,
  forceRefresh = false,
): Promise<Advertisement | null> {
  const cacheKey = getBannerCacheKey(placement, channelId);
  const cached = bannerCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && now - cached.updatedAt < BANNER_TTL_MS) {
    return cached.ad;
  }

  if (!bannerRequestInFlight.has(cacheKey)) {
    bannerRequestInFlight.set(cacheKey, (async () => {
      try {
        const res = await serveBannerAdApi(placement, channelId);
        const nextAd = res.ok && res.data && 'ad' in res.data ? (res.data.ad ?? null) : null;
        bannerCache.set(cacheKey, { ad: nextAd, updatedAt: Date.now() });
        return nextAd;
      } catch {
        return cached?.ad ?? null;
      } finally {
        bannerRequestInFlight.delete(cacheKey);
      }
    })());
  }

  return bannerRequestInFlight.get(cacheKey) ?? null;
}

export function BannerAd({ placement, channelId, className = '' }: BannerAdProps) {
  const cacheKey = getBannerCacheKey(placement, channelId);
  const [ad, setAd] = useState<Advertisement | null>(() => bannerCache.get(cacheKey)?.ad ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastImpressionIdRef = useRef<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    const nextAd = await getBannerAd(placement, channelId, forceRefresh);
    setAd(nextAd);
  }, [placement, channelId]);

  useEffect(() => {
    const initialLoadTimeout = window.setTimeout(() => {
      void load();
    }, 0);

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearTimeout(initialLoadTimeout);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!ad?.id || lastImpressionIdRef.current == ad.id || !rootRef.current) return;

    let viewTimer: number | null = null;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!viewTimer) {
          viewTimer = window.setTimeout(() => {
            if (!ad?.id || lastImpressionIdRef.current == ad.id) return;
            lastImpressionIdRef.current = ad.id;
            recordAdImpressionApi(ad.id, channelId, 1, {
              sessionId: getAdSessionId(),
              placement: `banner_${placement}`,
            }).catch(() => {});
            observer.disconnect();
          }, 1000);
        }
      } else if (viewTimer) {
        window.clearTimeout(viewTimer);
        viewTimer = null;
      }
    }, { threshold: [0, 0.5, 1] });

    observer.observe(rootRef.current);
    return () => {
      if (viewTimer) window.clearTimeout(viewTimer);
      observer.disconnect();
    };
  }, [ad?.id, channelId, placement]);

  const handleClick = useCallback(() => {
    if (!ad?.id) return;
    recordAdClickApi(ad.id, channelId, {
      sessionId: getAdSessionId(),
      placement: `banner_${placement}`,
    }).catch(() => {});
  }, [ad?.id, channelId, placement]);

  if (!ad) return null;

  const mediaUrl = ad.media_url || '';
  const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);

  return (
    <div ref={rootRef} className={`relative overflow-hidden rounded-xl border border-white/5 ${className}`}>
      {/* Ad label */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
        <span className="text-[9px] font-semibold text-av-light-orange tracking-wider uppercase">Sponsored</span>
      </div>

      {/* Ad media */}
      <a
        href={ad.click_url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
        onClick={handleClick}
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
          <Image
            src={resolveWebsiteMediaUrl(mediaUrl)}
            alt={ad.title || 'Advertisement'}
            width={1200}
            height={675}
            unoptimized
            className="w-full h-auto max-h-[200px] object-cover"
          />
        ) : (
          /* Text-only fallback */
          <div className="w-full px-6 py-8 bg-gradient-to-r from-av-light-blue/30 to-av-dark-blue/50 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-av-light-orange">{ad.title}</p>
              {ad.description && (
                <p className="text-xs text-av-light-orange mt-1">{ad.description}</p>
              )}
            </div>
          </div>
        )}
      </a>
    </div>
  );
}
