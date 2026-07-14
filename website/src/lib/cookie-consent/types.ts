export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface CookieConsent {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState {
  consent: CookieConsent | null;
  hasMadeChoice: boolean;
  isLoaded: boolean;
  setConsent: (consent: CookieConsent) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  resetConsent: () => void;
}

export const COOKIE_CONSENT_KEY = 'afrovision_cookie_consent';
export const COOKIE_CONSENT_VERSION = '1';

export const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

export const ALL_ACCEPTED: CookieConsent = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export const ALL_REJECTED: CookieConsent = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};
