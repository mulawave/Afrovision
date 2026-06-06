'use client';

import { useState } from 'react';
import { useCookieConsent } from '@/lib/cookie-consent/CookieConsentProvider';
import { CookieCategory } from '@/lib/cookie-consent/types';

export function CookieBanner() {
  const { hasMadeChoice, acceptAll, rejectAll, setConsent } = useCookieConsent();
  const [preferences, setPreferences] = useState<Record<CookieCategory, boolean>>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  if (hasMadeChoice) {
    return null;
  }

  const handleAcceptAll = () => {
    acceptAll();
  };

  const handleRejectAll = () => {
    rejectAll();
  };

  const handleSavePreferences = () => {
    setConsent(preferences);
  };

  const togglePreference = (category: CookieCategory) => {
    if (category === 'necessary') return; // Necessary cookies cannot be disabled
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-av-dark-blue border-t border-av-input-border/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-av-white mb-2">
                  Cookie Preferences
                </h3>
                <p className="text-sm text-av-light-orange leading-relaxed mb-4">
                  We use cookies to enhance your experience, analyze usage, and assist in our marketing efforts. 
                  You can customize your preferences below or accept all cookies.
                </p>
              </div>
              <button
                onClick={handleRejectAll}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full bg-av-card border border-av-input-border/30 text-av-light-orange hover:text-av-white hover:border-av-orange transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Cookie categories */}
            <div className="space-y-3">
              <CookieCategoryToggle
                category="necessary"
                label="Strictly Necessary"
                description="Essential for the platform to function properly"
                checked={preferences.necessary}
                disabled={true}
                onToggle={() => {}}
              />
              <CookieCategoryToggle
                category="functional"
                label="Functional"
                description="Remember your preferences and settings"
                checked={preferences.functional}
                disabled={false}
                onToggle={() => togglePreference('functional')}
              />
              <CookieCategoryToggle
                category="analytics"
                label="Analytics"
                description="Help us improve the platform by analyzing usage"
                checked={preferences.analytics}
                disabled={false}
                onToggle={() => togglePreference('analytics')}
              />
              <CookieCategoryToggle
                category="marketing"
                label="Marketing"
                description="Used to deliver relevant advertisements"
                checked={preferences.marketing}
                disabled={false}
                onToggle={() => togglePreference('marketing')}
              />
            </div>

            {/* Links */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <a href="/cookies" className="text-av-orange hover:underline">
                Cookie Policy
              </a>
              <a href="/privacy" className="text-av-orange hover:underline">
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex lg:flex-col gap-3 lg:w-48">
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-6 py-3 bg-av-orange text-white font-semibold rounded-lg hover:bg-av-orange/90 transition-colors text-sm"
            >
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              className="flex-1 px-6 py-3 bg-av-card border border-av-input-border/30 text-av-white font-semibold rounded-lg hover:border-av-orange transition-colors text-sm"
            >
              Reject All
            </button>
            <button
              onClick={handleSavePreferences}
              className="flex-1 px-6 py-3 bg-av-card border border-av-input-border/30 text-av-light-orange font-semibold rounded-lg hover:border-av-orange hover:text-av-white transition-colors text-sm"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CookieCategoryToggleProps {
  category: CookieCategory;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function CookieCategoryToggle({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: CookieCategoryToggleProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-av-card/50 border border-av-input-border/20">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`mt-0.5 relative w-11 h-6 rounded-full transition-colors ${
          disabled ? 'bg-av-input-border/30 cursor-not-allowed' : checked ? 'bg-av-orange' : 'bg-av-input-border/50'
        }`}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-av-white">{label}</span>
          {disabled && (
            <span className="text-xs text-av-light-orange">(Always on)</span>
          )}
        </div>
        <p className="text-xs text-av-light-orange mt-0.5">{description}</p>
      </div>
    </div>
  );
}
