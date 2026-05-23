"use client";

import { useState, useSyncExternalStore, useCallback, type ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";

const STORAGE_KEY = "afrovision_hide_hero";

function getHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getSnapshot(): boolean {
  return getHidden();
}

function getServerSnapshot(): boolean {
  return false;
}

export function HeroToggleWrapper({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mounted, setMounted] = useState(false);

  // Track mount for hydration safety
  const mountRef = useCallback(() => setMounted(true), []);
  if (!mounted && typeof window !== "undefined") mountRef();

  const toggle = () => {
    const next = !hidden;
    try {
      if (next) {
        localStorage.setItem(STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Force re-render by dispatching storage event
      window.dispatchEvent(new Event("storage"));
    } catch {
      // silent
    }
  };

  return (
    <>
      {/* Toggle — only for logged-in users */}
      {isAuthenticated && mounted && (
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-end pt-3">
          <button
            onClick={toggle}
            className="flex items-center gap-2 text-xs font-medium text-av-hint hover:text-av-light-orange transition-colors"
            title={hidden ? "Show hero banner" : "Hide hero banner"}
          >
            <span>{hidden ? "Show Hero" : "Hide Hero"}</span>
            <div
              className={`relative w-8 h-[18px] rounded-full transition-colors ${
                hidden ? "bg-av-input-border/40" : "bg-av-orange/60"
              }`}
            >
              <div
                className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-av-white shadow transition-transform ${
                  hidden ? "left-[2px]" : "left-[14px]"
                }`}
              />
            </div>
          </button>
        </div>
      )}

      {/* Hero content — hidden when toggled off */}
      {!(isAuthenticated && mounted && hidden) && children}
    </>
  );
}
