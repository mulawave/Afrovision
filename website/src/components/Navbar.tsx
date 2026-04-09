"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Live", href: "/live" },
  { label: "Channels", href: "/channels" },
  { label: "Challenge", href: "/challenge" },
  { label: "Advertise", href: "/advertiser" },
  { label: "Updates", href: "/updates" },
];

export function Navbar({ logoUrl }: { logoUrl?: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-av-dark-blue/95 backdrop-blur-md shadow-lg shadow-black/30"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            {logoUrl ? (
              <img src={logoUrl} alt="AfroVision" className="h-11 w-11 rounded-lg object-contain transition-transform group-hover:scale-110" />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center font-bold text-av-dark-blue text-xl transition-transform group-hover:scale-110">
                A
              </div>
            )}
            <span className="text-2xl font-bold tracking-wide">
              <span className="text-av-white">Afro</span>
              <span className="text-av-orange">Vision</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg transition-colors hover:bg-av-white/5"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA + Auth + Mobile toggle */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-av-input-fill animate-pulse" />
            ) : isAuthenticated && user ? (
              /* Logged-in user menu */
              <>
                <NotificationBell />
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 group"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-sm font-bold text-av-dark-blue transition-transform group-hover:scale-110">
                      {userInitial}
                    </div>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className={`hidden sm:block text-av-hint transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-av-card border border-av-input-border/30 shadow-2xl shadow-black/40 overflow-hidden z-50 animate-fade-in-up">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-av-input-border/20">
                        <p className="text-sm font-semibold text-av-white truncate">
                          {user.name || user.email}
                        </p>
                        <p className="text-[11px] text-av-hint truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 rounded-full bg-av-orange/10 border border-av-orange/20 text-[10px] font-bold text-av-orange uppercase">
                            {user.role}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-av-light-orange">
                            💎 {user.vpt_balance.toLocaleString()} VPT
                          </span>
                        </div>
                      </div>

                      {/* Menu links */}
                      <div className="py-1">
                        <Link
                          href="/notifications"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
                          </svg>
                          Notifications
                        </Link>
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                          Profile
                        </Link>
                        <Link
                          href="/wallet"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                          </svg>
                          Wallet
                        </Link>
                        <Link
                          href="/referrals"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                          </svg>
                          Referrals
                        </Link>
                        <Link
                          href="/advertiser"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                          </svg>
                          Advertise
                        </Link>
                        {(user.role === "creator" || user.role === "admin") && (
                          <>
                            <Link
                              href="/create-channel"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                                <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
                              </svg>
                              Create Channel
                            </Link>
                            <Link
                              href="/creator-studio"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                                <path d="M3 3h8v8H3zm10 0h8v5h-8zm0 7h8v11h-8zM3 13h8v8H3z" />
                              </svg>
                              Creator Studio
                            </Link>
                          </>
                        )}
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-white/70 hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-hint">
                              <path d="M12 2l8 4v6c0 5.25-3.44 10.74-8 12-4.56-1.26-8-6.75-8-12V6l8-4zm0 5a3 3 0 100 6 3 3 0 000-6zm0 8c-2.33 0-7 1.17-7 3.5V20h14v-1.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                            Admin
                          </Link>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t border-av-input-border/20 py-1">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-av-error/80 hover:text-av-error hover:bg-av-error/5 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Not logged in — Sign In + Get the App */
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-av-white/80 hover:text-av-white rounded-lg transition-colors hover:bg-av-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 hover:scale-105 active:scale-95"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-av-white/70 hover:text-av-white hover:bg-av-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                {mobileOpen ? (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-80" : "max-h-0"
        }`}
      >
        <div className="px-6 pb-4 pt-2 bg-av-dark-blue/95 backdrop-blur-md border-t border-av-input-border/30 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-av-input-border/20 pt-2 mt-2 space-y-1">
            {isAuthenticated && user ? (
              <>
                <div className="px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-xs font-bold text-av-dark-blue">
                    {userInitial}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-av-white truncate">{user.name || user.email}</p>
                    <p className="text-[10px] text-av-hint">💎 {user.vpt_balance.toLocaleString()} VPT</p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Profile
                </Link>
                <Link
                  href="/wallet"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Wallet
                </Link>
                <Link
                  href="/referrals"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Referrals
                </Link>
                <Link
                  href="/advertiser"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Advertise
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Notifications
                </Link>
                {(user.role === "creator" || user.role === "admin") && (
                  <>
                    <Link
                      href="/create-channel"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                    >
                      Create Channel
                    </Link>
                    <Link
                      href="/creator-studio"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                    >
                      Creator Studio
                    </Link>
                  </>
                )}
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-av-error/80 hover:text-av-error rounded-lg hover:bg-av-error/5 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-white/70 hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center mt-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
