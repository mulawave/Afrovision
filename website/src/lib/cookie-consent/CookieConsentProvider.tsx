'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CookieConsent,
  CookieConsentState,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_VERSION,
  ALL_ACCEPTED,
  ALL_REJECTED,
} from './types';

const CookieConsentContext = createContext<CookieConsentState | undefined>(undefined);

function loadStoredConsent(): { consent: CookieConsent | null; hasMadeChoice: boolean } {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === COOKIE_CONSENT_VERSION) {
        return { consent: parsed.consent, hasMadeChoice: true };
      } else {
        // Version mismatch, clear old consent
        localStorage.removeItem(COOKIE_CONSENT_KEY);
      }
    }
  } catch (error) {
    console.error('Error loading cookie consent:', error);
  }

  return { consent: null, hasMadeChoice: false };
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  // Initial state is identical on server and client to avoid hydration
  // mismatches (which break event handlers and freeze the banner).
  const [consent, setConsentState] = useState<CookieConsent | null>(null);
  const [hasMadeChoice, setHasMadeChoice] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Read persisted consent only after mount, on the client.
  useEffect(() => {
    const stored = loadStoredConsent();
    setConsentState(stored.consent);
    setHasMadeChoice(stored.hasMadeChoice);
    setIsLoaded(true);
  }, []);

  const setConsent = (newConsent: CookieConsent) => {
    setConsentState(newConsent);
    setHasMadeChoice(true);
    
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          version: COOKIE_CONSENT_VERSION,
          consent: newConsent,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error saving cookie consent:', error);
    }
  };

  const acceptAll = () => {
    setConsent(ALL_ACCEPTED);
  };

  const rejectAll = () => {
    setConsent(ALL_REJECTED);
  };

  const resetConsent = () => {
    setConsentState(null);
    setHasMadeChoice(false);
    try {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
    } catch (error) {
      console.error('Error clearing cookie consent:', error);
    }
  };

  const value: CookieConsentState = {
    consent,
    hasMadeChoice,
    isLoaded,
    setConsent,
    acceptAll,
    rejectAll,
    resetConsent,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
}
