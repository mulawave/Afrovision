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

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  const redirect = searchParams.get("redirect") || "/";

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
    // If grecaptcha already loaded (e.g. login page loaded it)
    if (window.grecaptcha) { renderCaptcha(); return; }
    window.onRecaptchaLoad = renderCaptcha;
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { window.onRecaptchaLoad = undefined; };
  }, [captchaSiteKey, renderCaptcha]);

  // Password strength — matches backend: 8+ chars, uppercase, lowercase, digit
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasMinLength = password.length >= 8;
  const passesAll = hasLower && hasUpper && hasDigit && hasMinLength;
  const checks = [hasMinLength, hasLower, hasUpper, hasDigit].filter(Boolean).length;
  const strength = password.length === 0 ? 0 : checks <= 2 ? 1 : checks === 3 ? 2 : 3;
  const strengthLabels = ["", "Weak", "Good", "Strong"];
  const strengthColors = ["", "bg-av-error", "bg-av-orange", "bg-green-500"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!passesAll) {
      setError("Password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    const result = await register(email.trim(), password, referralCode.trim() || undefined, captchaToken || undefined);
    setIsSubmitting(false);

    if (result.ok) {
      // Backend auto-logs in on register — redirect directly
      router.replace(redirect);
    } else {
      setError(result.error || "Registration failed");
      // Reset captcha on failure
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
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-av-light-blue/15 blur-3xl" />
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
          <h1 className="text-2xl font-bold text-av-white mt-6">Create your account</h1>
          <p className="text-sm text-av-hint mt-1">Join Africa&apos;s premier streaming community</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 sm:p-8">
          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-av-error/10 border border-av-error/30 text-xs text-av-error font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                Email address
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, upper + lower + number"
                  autoComplete="new-password"
                  required
                  minLength={8}
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

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          strength >= level ? strengthColors[strength] : "bg-av-input-border/30"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[10px] mt-1 ${strength <= 1 ? "text-av-error" : strength === 2 ? "text-av-orange" : "text-green-400"}`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            {/* Referral Code (optional) */}
            <div>
              <label htmlFor="reg-referral" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                Referral code <span className="text-av-hint font-normal">(optional)</span>
              </label>
              <input
                id="reg-referral"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Enter referral code"
                autoComplete="off"
                disabled={isSubmitting}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-hint/50 focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                className={`w-full h-11 px-4 rounded-xl bg-av-input-fill border text-sm text-av-white placeholder:text-av-hint/50 focus:outline-none focus:ring-1 transition-all disabled:opacity-50 ${
                  confirmPassword && confirmPassword !== password
                    ? "border-av-error/60 focus:border-av-error/80 focus:ring-av-error/20"
                    : "border-av-input-border/40 focus:border-av-orange/60 focus:ring-av-orange/20"
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[10px] text-av-error mt-1">Passwords do not match</p>
              )}
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-av-input-border/30" />
            <span className="text-[10px] text-av-hint uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-av-input-border/30" />
          </div>

          {/* Login link */}
          <p className="text-center text-sm text-av-hint">
            Already have an account?{" "}
            <Link
              href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-av-orange font-semibold hover:text-av-light-orange transition-colors"
            >
              Sign in
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

export default function RegisterPage() {
  return (
    <>
      <title>Create Account — AfroVision</title>
      <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
    </>
  );
}
