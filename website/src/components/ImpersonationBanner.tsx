"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearAuth } from "@/lib/api";

const IMPERSONATION_STORAGE_KEY = "av_impersonation_user";

interface ImpersonationMeta {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

const QUICK_LINKS = [
  { label: "Profile", href: "/profile" },
  { label: "Wallet", href: "/wallet" },
  { label: "Subscriptions", href: "/my-subscriptions" },
  { label: "My PICs", href: "/my-pics" },
  { label: "Creator Studio", href: "/creator-studio" },
  { label: "Notifications", href: "/notifications" },
  { label: "Referrals", href: "/referrals" },
  { label: "Home", href: "/" },
];

export function ImpersonationBanner() {
  const pathname = usePathname();
  const [meta, setMeta] = useState<ImpersonationMeta | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as ImpersonationMeta;
        setMeta(parsed);
      } catch {
        setMeta({ email: raw });
      }
    } catch {
      // ignore storage errors
    }
  }, [pathname]);

  if (!meta) return null;

  const displayLabel = meta.email || meta.name || meta.id || "User";

  function exitSession() {
    clearAuth();
    try {
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.replace("/login");
  }

  return (
    <div className="sticky top-0 z-[100] w-full bg-amber-500 text-[#050A30] px-4 py-2 text-xs font-semibold shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-[#050A30] text-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Admin View
          </span>
          <span className="truncate">
            Signed in as <strong className="underline">{displayLabel}</strong>
            {meta.role ? ` (${meta.role})` : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-md bg-[#050A30] text-amber-300 px-2.5 py-1 text-[11px] font-bold"
                    : "rounded-md bg-[#050A30]/15 text-[#050A30] hover:bg-[#050A30]/25 px-2.5 py-1 text-[11px] font-semibold transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={exitSession}
            className="ml-1 rounded-md bg-red-700 text-white px-3 py-1 text-[11px] font-bold hover:bg-red-800 transition-colors cursor-pointer"
          >
            Exit Session
          </button>
        </div>
      </div>
    </div>
  );
}
