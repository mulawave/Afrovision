"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export function GracePeriodBanner() {
  const { gracePeriodActive, kycRequired, kycVerified, isLoading } = useAuth();

  if (isLoading || !gracePeriodActive || !kycRequired || kycVerified) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-4">
      <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 px-5 py-3 flex items-center gap-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-orange-400 shrink-0">
          <path d="M12 2L1 21h22L12 2zm0 3.83L19.53 19H4.47L12 5.83zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-400">KYC Verification Required</p>
          <p className="text-xs text-av-light-orange mt-0.5">
            Complete identity verification to keep using all AfroVision features.
          </p>
        </div>
        <Link
          href="/kyc"
          className="shrink-0 rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-av-dark-blue transition-colors hover:bg-orange-400"
        >
          Verify Now
        </Link>
      </div>
    </div>
  );
}
