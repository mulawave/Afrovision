"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  const redirect = searchParams.get("redirect") || "/";
  const expired = searchParams.get("expired") === "1";
  const registered = searchParams.get("registered") === "1";

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirect);
    }
  }, [isAuthenticated, authLoading, redirect, router]);

  // Fetch captcha site key
  useEffect(() => {
    fetch(`${API_BASE}/home/captcha-key`)
      .then((r) => r.json())
      .then((d) => { if (d.siteKey) setCaptchaSiteKey(d.siteKey); })
      .catch(() => {});
  }, []);

  // Load reCAPTCHA script & render widget
  const renderCaptcha = useCallback(() => {
    if (!captchaSiteKey || !captchaRef.current || !window.grecaptcha) return;
    if (widgetIdRef.current !== null) return;
    widgetIdRef.current = window.grecaptcha.render(captchaRef.current, {
      sitekey: captchaSiteKey,
      callback: (token: string) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(""),
      theme: "dark",
    });
  }, [captchaSiteKey]);

  useEffect(() => {
    if (!captchaSiteKey) return;
    if (window.grecaptcha) { renderCaptcha(); return; }
    window.onRecaptchaLoad = renderCaptcha;
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { window.onRecaptchaLoad = undefined; };
  }, [captchaSiteKey, renderCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setIsSubmitting(true);
    const result = await login(email.trim(), password, captchaToken || undefined);
    setIsSubmitting(false);

    if (result.ok) {
      router.replace(redirect);
    } else {
      setError(result.error || "Invalid credentials");
      if (window.grecaptcha && widgetIdRef.current !== null) {
        window.grecaptcha.reset(widgetIdRef.current);
        setCaptchaToken("");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -bottom-60 -left-40 w-[400px] h-[400px] rounded-full bg-av-light-blue/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-av-orange to-av-light-orange flex items-center justify-center font-bold text-av-dark-blue text-xl transition-transform group-hover:scale-110">
              A
            </div>
            <span className="text-2xl font-bold tracking-wide">
              <span className="text-av-white">Afro</span>
              <span className="text-av-orange">Vision</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-av-white mt-6">Welcome back</h1>
          <p className="text-sm text-av-hint mt-1">Sign in to continue watching and earning</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 sm:p-8">
          {/* Session expired banner */}
          {expired && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-av-orange/10 border border-av-orange/30 text-xs text-av-orange font-medium">
              ⏱ Your session expired. Please sign in again.
            </div>
          )}

          {/* Registration success banner */}
          {registered && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-400 font-medium">
              ✓ Account created! Sign in to get started.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-av-error/10 border border-av-error/30 text-xs text-av-error font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-hint/50 focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-av-white/80">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-av-orange hover:text-av-light-orange transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-hint/50 focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-av-hint hover:text-av-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Terms & Policies */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange focus:ring-av-orange/40 accent-av-orange"
              />
              <span className="text-xs text-av-hint leading-relaxed group-hover:text-av-white/70 transition-colors">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-av-orange hover:underline">Terms of Service</Link>,{" "}
                <Link href="/privacy" target="_blank" className="text-av-orange hover:underline">Privacy Policy</Link>, and{" "}
                <Link href="/cookies" target="_blank" className="text-av-orange hover:underline">Cookie Policy</Link>.
              </span>
            </label>

            {/* reCAPTCHA */}
            {captchaSiteKey && (
              <div className="flex justify-center">
                <div ref={captchaRef} />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !agreedToTerms || (captchaSiteKey ? !captchaToken : false)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-av-dark-blue border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-av-input-border/30" />
            <span className="text-[10px] text-av-hint uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-av-input-border/30" />
          </div>

          {/* PAK login */}
          <Link
            href={`/pak-login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-av-light-orange/30 text-sm font-semibold text-av-light-orange hover:border-av-light-orange/60 hover:bg-av-light-orange/5 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
            </svg>
            Login with PAK
          </Link>

          {/* Register link */}
          <p className="text-center text-sm text-av-hint mt-5">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-av-orange font-semibold hover:text-av-light-orange transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-av-hint hover:text-av-white transition-colors">
            ← Back to AfroVision
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <>
      <title>Sign In — AfroVision</title>
      <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
    </>
  );
}
