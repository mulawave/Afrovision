'use client';

import { useEffect, useRef, useState } from 'react';

interface FlashScreenProps {
  type: 'coming_up' | 'now_playing';
  title: string;
  channelName: string;
  durationMs?: number;
  onComplete: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * AfroVision branded flash screen overlay.
 * Shows "Coming Up Next" or "Now Playing" text with optional ElevenLabs TTS.
 */
export function FlashScreen({ type, title, channelName, durationMs = 5000, onComplete }: FlashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const heading = type === 'now_playing' ? 'Now Playing' : 'Coming Up Next';

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setPhase('show'), 400);

    // Try to play TTS audio
    const audioUrl = `${API_BASE}/broadcast/flash-audio?type=${type}&title=${encodeURIComponent(title)}&channel_name=${encodeURIComponent(channelName)}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => { /* TTS not available — silent flash */ });

    // Auto-dismiss after duration
    timerRef.current = setTimeout(() => {
      setPhase('exit');
      setTimeout(onComplete, 400);
    }, durationMs);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(timerRef.current);
      audio.pause();
      audio.src = '';
    };
  }, [type, title, channelName, durationMs, onComplete]);

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-400 ${
        phase === 'enter' ? 'opacity-0' : phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'linear-gradient(135deg, #050A30 0%, #0A1545 40%, #173A6D 70%, #050A30 100%)' }}
    >
      {/* Animated lines decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-av-orange/20 to-transparent animate-pulse" />
        <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-av-light-orange/15 to-transparent animate-pulse" style={{ animationDelay: '0.6s' }} />
        <div className="absolute top-0 left-1/4 h-full w-px bg-gradient-to-b from-transparent via-av-orange/10 to-transparent animate-pulse" style={{ animationDelay: '0.3s' }} />
        <div className="absolute top-0 right-1/4 h-full w-px bg-gradient-to-b from-transparent via-av-light-orange/10 to-transparent animate-pulse" style={{ animationDelay: '0.9s' }} />
      </div>

      <div className={`relative text-center transition-all duration-500 ${
        phase === 'show' ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
      }`}>
        {/* AfroVision logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center">
            <svg className="w-5 h-5 text-av-dark-blue" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
          <span className="text-av-light-orange text-sm font-semibold tracking-widest uppercase">AfroVision</span>
        </div>

        {/* Type label */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-av-orange/15 border border-av-orange/25 mb-4">
          <span className="w-2 h-2 rounded-full bg-av-orange animate-pulse" />
          <span className="text-av-orange text-xs font-bold tracking-wider uppercase">{heading}</span>
        </div>

        {/* Title */}
        <h2 className="text-white text-2xl sm:text-3xl font-bold max-w-lg mx-auto leading-tight mb-3">
          {title}
        </h2>

        {/* Channel name */}
        <p className="text-av-light-orange text-sm">
          on <span className="text-av-light-orange font-semibold">{channelName}</span>
        </p>
      </div>
    </div>
  );
}
