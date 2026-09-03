"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export function useProfileGuard() {
  const { user, isLoading, isAuthenticated, isProfileComplete } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (isProfileComplete) return;
    if (user?.role === "admin") return;
    if (pathname === "/profile-setup") return;

    if (!hasShownToast.current) {
      hasShownToast.current = true;
    }
    router.replace("/profile-setup");
  }, [isLoading, isAuthenticated, isProfileComplete, user, pathname, router]);

  return { needsProfileSetup: isAuthenticated && !isProfileComplete && user?.role !== "admin" };
}
