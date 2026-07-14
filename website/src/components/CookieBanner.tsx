'use client';

import { useState } from 'react';
import { useCookieConsent } from '@/lib/cookie-consent/CookieConsentProvider';
import { CookieCategory } from '@/lib/cookie-consent/types';

const CATEGORIES: { key: CookieCategory; label: string; desc: string; locked: boolean }[] = [
  { key: 'necessary',  label: 'Necessary',  desc: 'Required for the site to function',  locked: true  },
  { key: 'functional', label: 'Functional', desc: 'Remember your preferences',           locked: false },
  { key: 'analytics',  label: 'Analytics',  desc: 'Help us improve the platform',        locked: false },
  { key: 'marketing',  label: 'Marketing',  desc: 'Show relevant advertisements',        locked: false },
];

export function CookieBanner() {
  const { hasMadeChoice, isLoaded, acceptAll, rejectAll, setConsent } = useCookieConsent();
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState<Record<CookieCategory, boolean>>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  // Never render during SSR or before hydration completes — a server-rendered
  // banner has no event handlers attached yet, so clicks would do nothing.
  if (!isLoaded || hasMadeChoice) return null;

  const togglePreference = (category: CookieCategory) => {
    if (category === 'necessary') return;
    setPreferences(prev => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    /*
     * pointer-events-none on the full-screen fixed wrapper ensures no part of
     * the page is blocked. pointer-events-auto is applied only to the card itself.
     */
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-end p-4 sm:p-6">
      <div className="pointer-events-auto w-full max-w-sm bg-av-dark-blue border border-av-input-border/40 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">🍪</span>
            <h3 className="text-sm font-semibold text-av-white">Cookie Preferences</h3>
          </div>
          <button
            onClick={rejectAll}
            aria-label="Dismiss cookie banner"
            className="flex items-center justify-center w-6 h-6 rounded-full bg-av-card/70 border border-av-input-border/30 text-av-light-orange hover:text-av-white hover:border-av-orange/60 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Description ── */}
        <p className="px-4 pb-3 text-xs text-av-light-orange leading-relaxed">
          We use cookies to improve your experience.{' '}
          <a href="/cookies" className="text-av-orange underline underline-offset-2 hover:text-av-orange/80">
            Learn more
          </a>
        </p>

        {/* ── Customize panel (toggled) ── */}
        {showCustomize && (
          <div className="px-4 pb-3 pt-3 border-t border-av-input-border/20 space-y-2">
            {CATEGORIES.map(({ key, label, desc, locked }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-av-white truncate">{label}</p>
                  <p className="text-xs text-av-light-orange/70 truncate">{desc}</p>
                </div>
                <button
                  onClick={() => togglePreference(key)}
                  disabled={locked}
                  aria-label={`Toggle ${label} cookies`}
                  className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none ${
                    locked
                      ? 'bg-av-orange/40 cursor-not-allowed'
                      : preferences[key]
                      ? 'bg-av-orange'
                      : 'bg-av-input-border/50 hover:bg-av-input-border/80'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      preferences[key] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="px-4 pt-1 pb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={acceptAll}
              className="flex-1 py-2.5 px-3 bg-av-orange text-white text-xs font-semibold rounded-xl hover:bg-av-orange/90 active:scale-95 transition-all"
            >
              Accept All
            </button>
            <button
              onClick={rejectAll}
              className="flex-1 py-2.5 px-3 bg-av-card border border-av-input-border/40 text-av-white text-xs font-semibold rounded-xl hover:border-av-orange/60 active:scale-95 transition-all"
            >
              Reject All
            </button>
          </div>

          {showCustomize ? (
            <button
              onClick={() => setConsent(preferences)}
              className="w-full py-2.5 px-3 bg-av-orange/10 border border-av-orange/30 text-av-orange text-xs font-semibold rounded-xl hover:bg-av-orange/20 active:scale-95 transition-all"
            >
              Save My Preferences
            </button>
          ) : (
            <button
              onClick={() => setShowCustomize(true)}
              className="w-full py-1 text-center text-xs text-av-light-orange hover:text-av-white transition-colors"
            >
              Customize preferences
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
