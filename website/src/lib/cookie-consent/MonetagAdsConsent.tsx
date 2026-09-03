'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCookieConsent } from './CookieConsentProvider';

// Monetag "Vignette" ad zone — replaces Google AdSense/AdMob.
const MONETAG_ZONE = '11543043';
const MONETAG_SCRIPT_SRC = 'https://n6wxm.com/vignette.min.js';
const MONETAG_SCRIPT_ID = 'monetag-vignette-ad';

// Routes where ads must never appear: payment, checkout, wallet, KYC/AML,
// and account-critical flows. Any unexpected overlay here could disrupt a
// transaction or look like "session hijacking".
const EXCLUDED_PATH_PREFIXES = [
  '/checkout',
  '/wallet',
  '/pricing',
  '/challenge/audition',
  '/aml',
  '/refund',
  '/terms',
  '/privacy',
  '/cookies',
];

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function MonetagAdsConsent() {
  const { consent } = useCookieConsent();
  const pathname = usePathname();

  useEffect(() => {
    const excluded = isExcludedPath(pathname);

    if (consent?.marketing && !excluded) {
      if (document.getElementById(MONETAG_SCRIPT_ID)) return;

      const script = document.createElement('script');
      script.id = MONETAG_SCRIPT_ID;
      script.dataset.zone = MONETAG_ZONE;
      script.src = MONETAG_SCRIPT_SRC;
      document.body.appendChild(script);

      return () => {
        const existing = document.getElementById(MONETAG_SCRIPT_ID);
        if (existing) existing.remove();
      };
    }

    // If consent is revoked or we navigate into an excluded route, make sure
    // the ad script isn't left active.
    const existing = document.getElementById(MONETAG_SCRIPT_ID);
    if (existing) existing.remove();
  }, [consent?.marketing, pathname]);

  return null;
}
