"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AfroVision Error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-av-error/10 border border-av-error/30 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-av-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-av-light-orange mb-6 leading-relaxed">
          An unexpected error occurred. Please try again or return to the
          homepage.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-semibold text-av-dark-blue hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <link
            href="/"
            className="px-5 py-2 rounded-xl bg-av-card border border-av-input-border/30 text-sm font-medium text-av-light-orange hover:text-av-white hover:border-av-orange/40 transition-all"
          >
            Go Home
          </link>
        </div>
      </div>
    </div>
  );
}
