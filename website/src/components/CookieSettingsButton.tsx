'use client';

import { useState } from 'react';
import { CookieSettings } from './CookieSettings';

export function CookieSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-av-light-orange hover:text-av-white transition-colors"
      >
        Cookie Settings
      </button>
      <CookieSettings isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
