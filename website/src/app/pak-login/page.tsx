"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function PakLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pakLogin, isAuthenticated, isLoading: authLoading } = useAuth();

  const [pak, setPak] = useState("");
  const [showPak, setShowPak] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirect = searchParams.get("redirect") || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirect);
    }
  }, [isAuthenticated, authLoading, redirect, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!pak.trim() || pak.trim().length < 5) {
      setError("Please enter a valid PAK");
      return;
    }

    setIsSubmitting(true);
    const result = await pakLogin(pak.trim());
    setIsSubmitting(false);

    if (result.ok) {
      router.replace(redirect);
    } else {
      setError(result.error || "PAK login failed");
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
          <h1 className="text-2xl font-bold text-av-white mt-6">Login with PAK</h1>
          <p className="text-sm text-av-hint mt-1">Enter your Personal Access Key to sign in</p>
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
            {/* PAK */}
            <div>
              <label htmlFor="pak" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                PAK (Personal Access Key)
              </label>
              <div className="relative">
                <input
                  id="pak"
                  type={showPak ? "text" : "password"}
                  value={pak}
                  onChange={(e) => setPak(e.target.value)}
                  placeholder="•••••••••••••••••"
                  autoComplete="off"
                  required
                  disabled={isSubmitting}
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-hint/50 focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPak(!showPak)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-av-hint hover:text-av-white transition-colors"
                  aria-label={showPak ? "Hide PAK" : "Show PAK"}
                >
                  {showPak ? (
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
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

          {/* Email login link */}
          <p className="text-center text-sm text-av-hint">
            Use email instead?{" "}
            <Link
              href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-av-orange font-semibold hover:text-av-light-orange transition-colors"
            >
              Sign In
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

export default function PakLoginPage() {
  return (
    <>
      <title>PAK Login — AfroVision</title>
      <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      }
    >
      <PakLoginContent />
    </Suspense>
    </>
  );
}
