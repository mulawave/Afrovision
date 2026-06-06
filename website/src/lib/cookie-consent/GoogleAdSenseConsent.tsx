'use client';

import { useEffect } from 'react';
import { useCookieConsent } from './CookieConsentProvider';

export function GoogleAdSenseConsent() {
  const { consent } = useCookieConsent();

  useEffect(() => {
    // Only load AdSense if marketing cookies are consented
    if (consent?.marketing) {
      // Load AdSense script
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1470400062955743';
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);

      return () => {
        // Cleanup script if consent is revoked
        const existingScript = document.querySelector(
          'script[src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1470400062955743"]'
        );
        if (existingScript) {
          existingScript.remove();
        }
      };
    }
  }, [consent?.marketing]);

  return null;
}
