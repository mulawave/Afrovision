"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { PremiumBadge } from "@/components/PremiumBadge";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Live", href: "/live" },
  { label: "Channels", href: "/channels" },
  { label: "Pricing", href: "/pricing" },
  { label: "Challenge", href: "/challenge" },
  { label: "Advertise", href: "/advertiser" },
  { label: "Updates", href: "/updates" },
];

export function Navbar({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [walletMode, setWalletMode] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletDetectBusy, setWalletDetectBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const { user, isAuthenticated, isLoading, logout, walletLogin } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const authPanelRef = useRef<HTMLDivElement>(null);

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

  // Close auth panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (authPanelRef.current && !authPanelRef.current.contains(e.target as Node)) {
        setAuthPanelOpen(false);
        setWalletMode(false);
        setWalletError(null);
      }
    };
    if (authPanelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [authPanelOpen]);

  const loginWithWalletAddress = async (rawAddress: string) => {
    const addr = rawAddress.trim();
    if (!addr) return setWalletError("Enter a BSC wallet address");
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return setWalletError("Invalid BSC address format");
    setWalletBusy(true);
    setWalletError(null);
    const result = await walletLogin(addr);
    setWalletBusy(false);
    if (result.ok) {
      setAuthPanelOpen(false);
      setWalletMode(false);
      setWalletAddress("");
      router.push("/");
    } else {
      setWalletError(result.error || "Wallet login failed");
    }
  };

  const handleWalletLogin = async () => loginWithWalletAddress(walletAddress);

  const handleInjectedWalletLogin = async () => {
    if (typeof window === "undefined") {
      setWalletError("Wallet connection is not available in this environment");
      return;
    }

    const injected = (window as typeof window & {
      ethereum?: { request: (args: { method: string }) => Promise<unknown> };
    }).ethereum;

    if (!injected) {
      setWalletError("No browser wallet detected. Install MetaMask or paste your linked wallet address below.");
      return;
    }

    try {
      setWalletDetectBusy(true);
      setWalletError(null);
      const result = await injected.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(result) ? result : [];
      const detected = typeof accounts[0] === "string" ? accounts[0] : "";

      if (!detected) {
        setWalletError("No wallet account was returned by your wallet app.");
        return;
      }

      setWalletAddress(detected);
      await loginWithWalletAddress(detected);
    } catch {
      setWalletError("Wallet connection was cancelled or unavailable. You can paste your linked wallet address manually.");
    } finally {
      setWalletDetectBusy(false);
    }
  };

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
                className="px-4 py-2 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg transition-colors hover:bg-av-white/5"
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
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-sm font-bold text-av-dark-blue transition-transform group-hover:scale-110">
                        {userInitial}
                      </div>
                    )}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className={`hidden sm:block text-av-light-orange transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-av-card border border-av-input-border/30 shadow-2xl shadow-black/40 overflow-hidden z-50 animate-fade-in-up">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-av-input-border/20">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-av-white truncate">
                              {user.name || user.email}
                            </p>
                            <p className="text-[11px] text-av-light-orange truncate">{user.email}</p>
                          </div>
                          <PremiumBadge user={user} size="sm" className="flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 rounded-full bg-av-orange/10 border border-av-orange/20 text-[10px] font-bold text-av-orange uppercase">
                            {user.role}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-av-light-orange">
                            💎 {user.vpt_balance.toLocaleString()} vPT
                          </span>
                        </div>
                      </div>

                      {/* Menu links */}
                      <div className="py-1">
                        <Link
                          href="/notifications"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
                          </svg>
                          Notifications
                        </Link>
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                          Profile
                        </Link>
                        <Link
                          href="/wallet"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                          </svg>
                          Wallet
                        </Link>
                        <Link
                          href="/wallet/withdrawal"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M17 9V7a5 5 0 00-10 0v2M5 9h14l1 11H4L5 9z" />
                          </svg>
                          Withdrawals
                        </Link>
                        <Link
                          href="/referrals"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                          </svg>
                          Referrals
                        </Link>
                        <Link
                          href="/kyc"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                          KYC Verification
                          {user.kyc_status !== "verified" && (
                            <span className={`ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                              user.kyc_status === "rejected"
                                ? "bg-red-500/20 text-red-400"
                                : user.kyc_status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-av-orange/20 text-av-orange"
                            }`}>
                              {user.kyc_status === "none" ? "Required" : user.kyc_status}
                            </span>
                          )}
                        </Link>
                        <Link
                          href="/advertiser"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
                          </svg>
                          Advertise
                        </Link>
                        {(user.role === "creator" || user.role === "admin") && (
                          <>
                            <Link
                              href="/create-channel"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                                <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
                              </svg>
                              Create Channel
                            </Link>
                            <Link
                              href="/creator-studio"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
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
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-light-orange hover:text-av-white hover:bg-av-input-fill/50 transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-av-light-orange">
                              <path d="M12 2l8 4v6c0 5.25-3.44 10.74-8 12-4.56-1.26-8-6.75-8-12V6l8-4zm0 5a3 3 0 100 6 3 3 0 000-6zm0 8c-2.33 0-7 1.17-7 3.5V20h14v-1.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                            Admin
                          </Link>
                        )}
                      </div>

                      {/* Danger zone */}
                      <div className="border-t border-av-input-border/20 py-1">
                        <Link
                          href="/profile/delete-account"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-av-error/60 hover:text-av-error hover:bg-av-error/5 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                          Delete Account
                        </Link>
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
              /* Not logged in — My Account button + auth panel */
              <div className="relative" ref={authPanelRef}>
                <button
                  onClick={() => { setAuthPanelOpen(!authPanelOpen); setWalletMode(false); setWalletError(null); }}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-av-light-orange hover:text-av-white rounded-lg transition-colors hover:bg-av-white/5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-av-orange">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  My Account
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={`transition-transform ${authPanelOpen ? "rotate-180" : ""}`}>
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </button>

                <button
                  onClick={() => { setAuthPanelOpen(!authPanelOpen); setWalletMode(false); setWalletError(null); }}
                  className="inline-flex sm:hidden items-center justify-center h-9 w-9 rounded-lg border border-av-input-border/40 bg-av-card/70 text-av-light-orange hover:text-av-white hover:border-av-light-orange/40 transition-colors"
                  aria-label="Open My Account panel"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-av-orange">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </button>

                {authPanelOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-80 rounded-2xl bg-av-card border border-av-input-border/30 shadow-2xl shadow-black/50 overflow-hidden z-50 animate-fade-in-up">
                    {!walletMode ? (
                      <>
                        {/* Header */}
                        <div className="px-5 pt-5 pb-3">
                          <p className="text-sm font-bold text-av-white">Welcome to AfroVision</p>
                          <p className="text-[11px] text-av-hint mt-1">Choose how you&apos;d like to access your account</p>
                        </div>

                        {/* 3 Auth Options */}
                        <div className="px-4 pb-4 space-y-2">
                          {/* Connect Wallet */}
                          <button
                            onClick={async () => {
                              setWalletMode(true);
                              setWalletError(null);
                              setWalletAddress("");
                              await handleInjectedWalletLogin();
                            }}
                            className="flex items-center gap-4 w-full rounded-xl border border-av-orange/20 bg-gradient-to-r from-av-orange/8 to-transparent px-4 py-3.5 text-left transition-all hover:border-av-orange/40 hover:bg-av-orange/12 hover:shadow-lg hover:shadow-av-orange/10 group"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-av-orange/15 transition-colors group-hover:bg-av-orange/25">
                              <svg className="h-5 w-5 text-av-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-av-white">Connect Wallet</p>
                              <p className="text-[10px] text-av-hint mt-0.5">Login with your linked BSC wallet</p>
                            </div>
                            <svg className="h-4 w-4 text-av-hint group-hover:text-av-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {/* Sign in with Email */}
                          <Link
                            href="/login"
                            onClick={() => setAuthPanelOpen(false)}
                            className="flex items-center gap-4 w-full rounded-xl border border-av-input-border/20 bg-av-input-fill/20 px-4 py-3.5 text-left transition-all hover:border-av-light-orange/35 hover:bg-av-light-orange/8 group"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-av-light-orange/12 transition-colors group-hover:bg-av-light-orange/20">
                              <svg className="h-5 w-5 text-av-light-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-av-white">Sign in with Email</p>
                              <p className="text-[10px] text-av-hint mt-0.5">Use your email &amp; password</p>
                            </div>
                            <svg className="h-4 w-4 text-av-hint group-hover:text-av-light-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>

                          {/* Login with PAK */}
                          <Link
                            href="/pak-login"
                            onClick={() => setAuthPanelOpen(false)}
                            className="flex items-center gap-4 w-full rounded-xl border border-av-input-border/20 bg-av-input-fill/20 px-4 py-3.5 text-left transition-all hover:border-av-white/25 hover:bg-av-white/8 group"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-av-white/10 transition-colors group-hover:bg-av-white/20">
                              <svg className="h-5 w-5 text-av-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-av-white">Login with PAK</p>
                              <p className="text-[10px] text-av-hint mt-0.5">Use your Personal Access Key</p>
                            </div>
                            <svg className="h-4 w-4 text-av-hint group-hover:text-av-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>

                        {/* Register CTA */}
                        <div className="border-t border-av-input-border/20 px-5 py-3 flex items-center justify-between">
                          <p className="text-[11px] text-av-hint">Don&apos;t have an account?</p>
                          <Link
                            href="/register"
                            onClick={() => setAuthPanelOpen(false)}
                            className="text-xs font-bold text-av-orange hover:text-av-light-orange transition-colors"
                          >
                            Get Started →
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Wallet Connect Form */}
                        <div className="px-5 pt-5 pb-2">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setWalletMode(false); setWalletError(null); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-av-input-fill hover:bg-av-input-fill/80 transition-colors"
                            >
                              <svg className="h-4 w-4 text-av-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <div>
                              <p className="text-sm font-bold text-av-white">Connect Wallet</p>
                              <p className="text-[10px] text-av-hint mt-0.5">Enter your linked BSC wallet address</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 pb-5 space-y-3">
                          <button
                            onClick={handleInjectedWalletLogin}
                            disabled={walletBusy || walletDetectBusy}
                            className="w-full rounded-xl border border-av-orange/35 bg-av-orange/8 py-2.5 text-xs font-bold text-av-orange transition-all hover:bg-av-orange/14 disabled:opacity-60"
                          >
                            {walletDetectBusy ? "Opening Wallet..." : "Use Connected Wallet App"}
                          </button>

                          <input
                            type="text"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleWalletLogin(); }}
                            placeholder="0x... BSC wallet address"
                            className="w-full rounded-xl border border-av-input-border bg-av-input-fill px-4 py-3 font-mono text-sm text-av-white placeholder:text-av-hint focus:border-av-orange focus:outline-none focus:ring-1 focus:ring-av-orange/30"
                            autoFocus
                          />

                          {walletError && (
                            <div className="rounded-lg border border-av-error/20 bg-av-error/8 px-3 py-2.5">
                              <p className="text-[11px] text-av-error leading-relaxed">{walletError}</p>
                            </div>
                          )}

                          <button
                            onClick={handleWalletLogin}
                            disabled={walletBusy || walletDetectBusy}
                            className="w-full rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange py-3 text-sm font-bold text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 disabled:opacity-50"
                          >
                            {walletBusy ? "Connecting..." : "Connect & Login"}
                          </button>

                          <div className="flex items-start gap-2 rounded-xl border border-av-input-border/15 bg-av-input-fill/20 px-3 py-2">
                            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-av-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-[10px] text-av-hint leading-relaxed">
                              Wallet login works only for existing accounts that already linked this wallet. If no account is linked, first create or sign in to your account and link wallet under Wallet → Connect Wallet, or import your account with Login with PAK and then link wallet.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-av-light-orange hover:text-av-white hover:bg-av-white/5 transition-colors"
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
              className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-av-input-border/20 pt-2 mt-2 space-y-1">
            {isAuthenticated && user ? (
              <>
                <div className="px-4 py-2 flex items-center gap-3">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center text-xs font-bold text-av-dark-blue">
                      {userInitial}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-av-white truncate">{user.name || user.email}</p>
                    <p className="text-[10px] text-av-light-orange">💎 {user.vpt_balance.toLocaleString()} vPT</p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Profile
                </Link>
                <Link
                  href="/wallet"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Wallet
                </Link>
                <Link
                  href="/referrals"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Referrals
                </Link>
                <Link
                  href="/advertiser"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Advertise
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  Notifications
                </Link>
                {(user.role === "creator" || user.role === "admin") && (
                  <>
                    <Link
                      href="/create-channel"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                    >
                      Create Channel
                    </Link>
                    <Link
                      href="/creator-studio"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                    >
                      Creator Studio
                    </Link>
                  </>
                )}
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/profile/delete-account"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-av-error/60 hover:text-av-error rounded-lg hover:bg-av-error/5 transition-colors"
                >
                  Delete Account
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-av-error/80 hover:text-av-error rounded-lg hover:bg-av-error/5 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthPanelOpen(true);
                    setWalletMode(false);
                    setWalletError(null);
                  }}
                  className="block px-4 py-3 text-sm font-medium text-av-light-orange hover:text-av-white rounded-lg hover:bg-av-white/5 transition-colors"
                >
                  My Account
                </button>
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
