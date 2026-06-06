'use client';

import { useState, useEffect } from 'react';
import { useCookieConsent } from '@/lib/cookie-consent/CookieConsentProvider';
import { CookieCategory } from '@/lib/cookie-consent/types';

interface CookieSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CookieSettings({ isOpen, onClose }: CookieSettingsProps) {
  const { consent, setConsent } = useCookieConsent();
  const [preferences, setPreferences] = useState<Record<CookieCategory, boolean>>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (isOpen && consent) {
      setPreferences(consent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    setConsent(preferences);
    onClose();
  };

  const togglePreference = (category: CookieCategory) => {
    if (category === 'necessary') return;
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-av-dark-blue border border-av-input-border/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-av-dark-blue border-b border-av-input-border/30 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-av-white">Cookie Settings</h2>
            <p className="text-sm text-av-light-orange mt-1">
              Manage your cookie preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-av-card border border-av-input-border/30 text-av-light-orange hover:text-av-white hover:border-av-orange transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-av-light-orange leading-relaxed">
            We use cookies to enhance your experience, analyze usage, and assist in our marketing efforts. 
            You can customize your preferences below. Changes will take effect immediately.
          </p>

          {/* Cookie categories */}
          <div className="space-y-4">
            <CookieCategoryToggle
              category="necessary"
              label="Strictly Necessary"
              description="Essential for the platform to function properly. These cookies enable core functionality such as user authentication, security, and load balancing. Cannot be disabled."
              checked={preferences.necessary}
              disabled={true}
              onToggle={() => {}}
            />
            <CookieCategoryToggle
              category="functional"
              label="Functional"
              description="These cookies remember your choices and settings to provide a more personalised experience, including language, theme, and playback preferences."
              checked={preferences.functional}
              disabled={false}
              onToggle={() => togglePreference('functional')}
            />
            <CookieCategoryToggle
              category="analytics"
              description="These cookies help us understand how visitors interact with the platform so we can measure performance and improve the user experience. Analytics data is aggregated and anonymised."
              checked={preferences.analytics}
              disabled={false}
              onToggle={() => togglePreference('analytics')}
            />
            <CookieCategoryToggle
              category="marketing"
              label="Marketing"
              description="We may use these cookies to deliver relevant advertisements and measure campaign effectiveness. These cookies will only be activated with your explicit consent."
              checked={preferences.marketing}
              disabled={false}
              onToggle={() => togglePreference('marketing')}
            />
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 text-xs pt-4 border-t border-av-input-border/30">
            <a href="/cookies" className="text-av-orange hover:underline">
              Cookie Policy
            </a>
            <a href="/privacy" className="text-av-orange hover:underline">
              Privacy Policy
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-av-dark-blue border-t border-av-input-border/30 p-6 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-av-orange text-white font-semibold rounded-lg hover:bg-av-orange/90 transition-colors"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-av-card border border-av-input-border/30 text-av-white font-semibold rounded-lg hover:border-av-orange transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface CookieCategoryToggleProps {
  category: CookieCategory;
  label?: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function CookieCategoryToggle({
  category,
  label,
  description,
  checked,
  disabled,
  onToggle,
}: CookieCategoryToggleProps) {
  const categoryLabel = label || category.charAt(0).toUpperCase() + category.slice(1);
  
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-av-card/50 border border-av-input-border/20">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`mt-0.5 relative w-12 h-7 rounded-full transition-colors ${
          disabled ? 'bg-av-input-border/30 cursor-not-allowed' : checked ? 'bg-av-orange' : 'bg-av-input-border/50'
        }`}
        aria-label={`Toggle ${categoryLabel}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-av-white">{categoryLabel}</span>
          {disabled && (
            <span className="text-xs text-av-light-orange">(Always on)</span>
          )}
        </div>
        <p className="text-sm text-av-light-orange mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
