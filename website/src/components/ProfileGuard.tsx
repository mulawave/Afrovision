"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const ALLOWED_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/pak-login"];

export function ProfileGuard() {
  const { user, isLoading, isAuthenticated, isProfileComplete } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated || isLoading || isProfileComplete || user?.role === "admin") return null;
  if (ALLOWED_PATHS.includes(pathname)) return null;

  return (
    <div className="sticky top-0 z-[90] w-full bg-red-600 border-b-2 border-red-400/50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <svg className="h-6 w-6 shrink-0 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9 3.75a9 9 0 1118 0 9 9 0 01-18 0zm9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm sm:text-base font-bold text-white truncate">
            Your profile is incomplete. Please complete it to continue using AfroVision.
          </p>
        </div>
        <Link
          href="/profile-setup"
          className="flex-shrink-0 rounded-full bg-white px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
        >
          Complete Profile
        </Link>
      </div>
    </div>
  );
}
