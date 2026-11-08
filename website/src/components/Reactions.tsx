"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  delay: number;
}

const REACTION_EMOJIS = ["🔥", "❤️", "👏", "😂", "🎉", "💯", "👑", "🇳🇬"];

// ─── localStorage persistence for reaction UI state ──────────────────────────
const REACTION_STORAGE_KEY = "afrovision_reactions_state";

function loadReactionState(): {
  floaters: FloatingReaction[];
  cooldowns: Record<string, boolean>;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REACTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? {
          floaters: Array.isArray(parsed.floaters) ? parsed.floaters : [],
          cooldowns:
            parsed.cooldowns && typeof parsed.cooldowns === "object"
              ? parsed.cooldowns
              : {},
        }
      : null;
  } catch {
    return null;
  }
}

function saveReactionState(
  floaters: FloatingReaction[],
  cooldowns: Record<string, boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REACTION_STORAGE_KEY,
      JSON.stringify({ floaters, cooldowns })
    );
  } catch {
    // Ignore quota errors etc.
  }
}

interface ReactionsProps {
  onReact: (emoji: string) => void;
}

export function Reactions({ onReact }: ReactionsProps) {
  const [floaters, setFloaters] = useState<FloatingReaction[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Hydrate reaction UI state from localStorage on mount
  useEffect(() => {
    const saved = loadReactionState();
    if (saved) {
      setFloaters(saved.floaters);
      setCooldowns(saved.cooldowns);
    }
  }, []);

  // Persist reaction UI state whenever it changes
  useEffect(() => {
    saveReactionState(floaters, cooldowns);
  }, [floaters, cooldowns]);

  // Clean up old floaters
  useEffect(() => {
    const interval = setInterval(() => {
      setFloaters((prev) => prev.filter((f) => Date.now() - parseInt(f.id) < 2500));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (cooldowns[emoji]) return;

      //too fast: 1 reaction per emoji per 500ms (anti-spam ready)
      setCooldowns((prev) => ({ ...prev, [emoji]: true }));
      setTimeout(() => setCooldowns((prev) => ({ ...prev, [emoji]: false })), 500);

      // Create floating reaction
      const id = String(Date.now());
      const x = 10 + Math.random() * 80; // Random horizontal position
      const delay = Math.random() * 0.3;

      setFloaters((prev) => [...prev.slice(-20), { id, emoji, x, delay }]);
      onReact(emoji);
    },
    [cooldowns, onReact]
  );

  return (
    <div className="relative">
      {/* Floating reactions overlay */}
      <div
        ref={containerRef}
        className="absolute bottom-full left-0 right-0 h-32 pointer-events-none overflow-hidden"
      >
        {floaters.map((f) => (
          <span
            key={f.id}
            className="absolute text-2xl reaction-float"
            style={{
              left: `${f.x}%`,
              bottom: 0,
              animationDelay: `${f.delay}s`,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Reaction buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            disabled={cooldowns[emoji]}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 ${
              cooldowns[emoji]
                ? "bg-av-input-fill/30 scale-125 opacity-60"
                : "bg-av-input-fill/50 border border-av-input-border/20 hover:bg-av-input-fill hover:scale-110 hover:border-av-orange/30 active:scale-95"
            }`}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
