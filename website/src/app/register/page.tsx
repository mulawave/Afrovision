"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { executeRecaptchaEnterprise } from "@/lib/recaptcha-enterprise";

const FALLBACK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeuIsEsAAAAAO6xD7D08pQAraweXcxw9pHBg94k";

type CaptchaStatus = "loading" | "ready" | "unavailable";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated, isLoading: authLoading, isProfileComplete, kycRequired } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const [captchaStatus, setCaptchaStatus] = useState<CaptchaStatus>("loading");

  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (!isProfileComplete) {
        router.replace("/profile-setup");
      } else if (kycRequired) {
        router.replace("/kyc");
      } else {
        router.replace(redirect);
      }
    }
  }, [authLoading, isAuthenticated, isProfileComplete, kycRequired, redirect, router]);

  const loadCaptchaSiteKey = useCallback(async () => {
    setCaptchaStatus("loading");

    try {
      const response = await fetch(`/api/proxy/home/captcha-key`, { cache: "no-store" });
      const data = await response.json();
      const siteKeyFromApi = typeof data?.siteKey === "string" ? data.siteKey.trim() : "";
      const siteKey = siteKeyFromApi || FALLBACK_SITE_KEY;

      if (!siteKey) {
        setCaptchaSiteKey("");
        setCaptchaStatus("unavailable");
        return false;
      }

      setCaptchaSiteKey(siteKey);
      setCaptchaStatus("ready");
      return true;
    } catch {
      if (FALLBACK_SITE_KEY) {
        setCaptchaSiteKey(FALLBACK_SITE_KEY);
        setCaptchaStatus("ready");
        return true;
      }
      setCaptchaSiteKey("");
      setCaptchaStatus("unavailable");
      return false;
    }
  }, []);

  useEffect(() => {
    loadCaptchaSiteKey();
  }, [loadCaptchaSiteKey]);

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

    if (captchaStatus === "loading") {
      setError("Security check is still loading. Please wait a moment and try again.");
      return;
    }

    if (!captchaSiteKey) {
      const loaded = await loadCaptchaSiteKey();
      if (!loaded) {
        setError("Security check is unavailable right now. Retry in a moment.");
        return;
      }
    }

    setIsSubmitting(true);

    let captchaToken: string;
    try {
      captchaToken = await executeRecaptchaEnterprise(captchaSiteKey, "REGISTER");
      if (!captchaToken) {
        throw new Error("empty_captcha_token");
      }
    } catch {
      setIsSubmitting(false);
      setError("Security check could not be completed. Please retry.");
      return;
    }

    const result = await register(email.trim(), password, referralCode.trim() || undefined, captchaToken);
    setIsSubmitting(false);

    if (result.ok) {
      router.replace("/profile-setup");
    } else {
      setError(result.error || "Registration failed");
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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-av-orange/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-av-light-blue/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
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
          <p className="text-sm text-av-light-orange mt-1">Join Africa&apos;s premier streaming community</p>
        </div>

        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 sm:p-8">
          {error ? (
            <div className="mb-5 px-4 py-3 rounded-xl bg-av-error/10 border border-av-error/30 text-xs text-av-error font-medium">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-av-light-orange mb-1.5">
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
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-av-light-orange mb-1.5">
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
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-av-light-orange hover:text-av-white transition-colors"
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

              {password.length > 0 ? (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${strength >= level ? strengthColors[strength] : "bg-av-input-border/30"}`}
                      />
                    ))}
                  </div>
                  <p className={`text-[10px] mt-1 ${strength <= 1 ? "text-av-error" : strength === 2 ? "text-av-orange" : "text-green-400"}`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="reg-referral" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                Referral code <span className="text-av-light-orange font-normal">(optional)</span>
              </label>
              <input
                id="reg-referral"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Enter referral code"
                autoComplete="off"
                disabled={isSubmitting}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-xs font-semibold text-av-light-orange mb-1.5">
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
                className={`w-full h-11 px-4 rounded-xl bg-av-input-fill border text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:ring-1 transition-all disabled:opacity-50 ${confirmPassword && confirmPassword !== password ? "border-av-error/60 focus:border-av-error/80 focus:ring-av-error/20" : "border-av-input-border/40 focus:border-av-orange/60 focus:ring-av-orange/20"}`}
              />
              {confirmPassword && confirmPassword !== password ? (
                <p className="text-[10px] text-av-error mt-1">Passwords do not match</p>
              ) : null}
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange focus:ring-av-orange/40 accent-av-orange"
              />
              <span className="text-xs text-av-light-orange leading-relaxed group-hover:text-av-light-orange transition-colors">
                I agree to the <Link href="/terms" target="_blank" className="text-av-orange hover:underline">Terms of Service</Link>, <Link href="/privacy" target="_blank" className="text-av-orange hover:underline">Privacy Policy</Link>, and <Link href="/cookies" target="_blank" className="text-av-orange hover:underline">Cookie Policy</Link>.
              </span>
            </label>

            {captchaStatus === "loading" ? (
              <p className="text-[11px] text-av-light-orange/80 text-center">Loading security check...</p>
            ) : null}

            {captchaStatus === "ready" ? (
              <p className="text-[11px] text-av-light-orange/80 text-center">This form is protected by reCAPTCHA Enterprise.</p>
            ) : null}

            {captchaStatus === "unavailable" ? (
              <div className="rounded-xl border border-av-error/30 bg-av-error/10 px-4 py-3 text-center">
                <p className="text-[11px] text-av-error">Security check is unavailable right now.</p>
                <button
                  type="button"
                  onClick={loadCaptchaSiteKey}
                  disabled={isSubmitting}
                  className="mt-2 text-[11px] font-semibold text-av-orange hover:text-av-light-orange disabled:opacity-50"
                >
                  Retry security check
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || !agreedToTerms || !passesAll || password !== confirmPassword || captchaStatus !== "ready"}
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

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-av-input-border/30" />
            <span className="text-[10px] text-av-light-orange uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-av-input-border/30" />
          </div>

          <p className="text-center text-sm text-av-light-orange">
            Already have an account? <Link href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="text-av-orange font-semibold hover:text-av-light-orange transition-colors">Sign in</Link>
          </p>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-av-light-orange hover:text-av-white transition-colors">
            ← Back to AfroVision
          </Link>
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90" aria-label="PEGI 18"><svg viewBox="0 0 32 32" className="h-5 w-5"><rect width="32" height="32" rx="3" fill="#C62828" /><text x="16" y="10" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="6" fill="#FFF">PEGI</text><text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="16" fill="#FFF">18</text></svg></span>
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90" aria-label="IARC 18+"><svg viewBox="0 0 32 32" className="h-5 w-5"><rect width="32" height="32" rx="3" fill="#C62828" /><text x="16" y="10" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="5" fill="#FFF">IARC</text><text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="14" fill="#FFF">18+</text></svg></span>
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90" aria-label="ESRB Mature"><svg viewBox="0 0 32 32" className="h-5 w-5"><rect width="32" height="32" rx="3" fill="#1A1A1A" /><text x="16" y="14" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="7" fill="#FFF">RATED</text><text x="16" y="26" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="12" fill="#FFF">M</text></svg></span>
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90" aria-label="USK 18"><svg viewBox="0 0 32 32" className="h-5 w-5"><circle cx="16" cy="16" r="14" fill="#E65100" stroke="#C62828" strokeWidth="2" /><text x="16" y="14" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="5" fill="#FFF">USK</text><text x="16" y="24" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="12" fill="#FFF">18</text></svg></span>
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-white/90" aria-label="GRAC 18"><svg viewBox="0 0 32 32" className="h-5 w-5"><circle cx="16" cy="16" r="14" fill="none" stroke="#1A1A1A" strokeWidth="2" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="16" fill="#1A1A1A">18</text></svg></span>
          </div>
          <p className="text-[9px] text-av-light-orange/50">Rated by IARC</p>
        </div>
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
