"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Returns a gate function that checks auth before running a callback.
 * If the user is not authenticated, redirects to /login with a redirect param.
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   requireAuth(() => { sendGift(); });
 */
export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (callback: () => void) => {
      if (isAuthenticated) {
        callback();
      } else {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    },
    [isAuthenticated, router, pathname]
  );
}
