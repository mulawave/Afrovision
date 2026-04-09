"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export function KycAlertBanner() {
  const { user, isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show for authenticated users with KYC not yet verified
  if (!isAuthenticated || !user) return null;
  if (user.kyc_status === "verified" || user.kyc_status === "pending") return null;
  if (dismissed) return null;

  const isRejected = user.kyc_status === "rejected";

  return (
    <div
      className={`relative border-b ${
        isRejected
          ? "bg-red-900/30 border-red-500/20"
          : "bg-av-orange/10 border-av-orange/15"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              isRejected ? "bg-red-500/20" : "bg-av-orange/20"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={isRejected ? "text-red-400" : "text-av-orange"}
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <p className="text-xs sm:text-sm text-av-white/90 truncate">
            {isRejected
              ? "Your KYC verification was rejected. Please re-submit with valid documents."
              : "Complete your KYC verification to unlock all platform features."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/kyc"
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all hover:scale-105 ${
              isRejected
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-av-orange text-av-dark-blue hover:bg-av-light-orange"
            }`}
          >
            {isRejected ? "Re-submit KYC" : "Complete KYC"}
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full text-av-hint hover:text-av-white hover:bg-av-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
