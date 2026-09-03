"use client";

import { useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DistributorAuthProvider, useDistributorAuth } from "@/lib/DistributorAuthContext";

const NAV_ITEMS = [
  { label: "Dashboard", tab: null as string | null },
  { label: "Marketers", tab: "marketers" },
  { label: "Codes", tab: "codes" },
  { label: "Devices", tab: "devices" },
  { label: "Financials", tab: "financials" },
];

function DistributorShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, distributor, logout } = useDistributorAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/distributor/login") {
      router.replace("/distributor/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/distributor/login") {
    return null;
  }

  if (pathname === "/distributor/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-av-input-border/30 bg-av-dark-blue/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center font-bold text-av-dark-blue text-lg">
                  A
                </div>
                <span className="text-lg font-bold tracking-wide hidden sm:inline">
                  <span className="text-av-white">Afro</span>
                  <span className="text-av-orange">Vision</span>
                </span>
              </Link>
              <span className="ml-2 rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-0.5 text-xs font-medium text-av-light-orange">
                Distributor Portal
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-av-white">{distributor?.company_name}</p>
                <p className="text-xs text-av-light-orange">{distributor?.email}</p>
              </div>
              <button
                onClick={() => { logout(); router.replace("/distributor/login"); }}
                className="rounded-xl border border-av-orange/30 bg-av-orange/10 px-4 py-2 text-sm font-semibold text-av-light-orange hover:bg-av-orange/20 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tab Nav */}
          <nav className="flex gap-1 overflow-x-auto pb-2">
            {NAV_ITEMS.map((item) => {
              const href = item.tab ? `/distributor?tab=${item.tab}` : "/distributor";
              const isActive = (item.tab || "overview") === currentTab;
              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-av-orange/15 text-av-light-orange"
                      : "text-av-light-orange/60 hover:text-av-light-orange hover:bg-av-orange/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default function DistributorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DistributorAuthProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" /></div>}>
        <DistributorShell>{children}</DistributorShell>
      </Suspense>
    </DistributorAuthProvider>
  );
}
