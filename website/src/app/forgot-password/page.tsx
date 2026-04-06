"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);
    const res = await forgotPasswordApi(email.trim());
    setIsSubmitting(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      const data = res.data as { error?: string };
      setError(data.error || "Something went wrong");
    }
  };

  return (
    <>
      <title>Forgot Password — AfroVision</title>
      <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-av-orange/5 blur-3xl" />
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
          <h1 className="text-2xl font-bold text-av-white mt-6">Reset your password</h1>
          <p className="text-sm text-av-hint mt-1">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 sm:p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#34D399">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-av-white mb-2">Check your email</h2>
              <p className="text-sm text-av-hint leading-relaxed mb-6">
                If an account exists for <strong className="text-av-white">{email}</strong>, you&apos;ll receive a password reset link.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-av-error/10 border border-av-error/30 text-xs text-av-error font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-email" className="block text-xs font-semibold text-av-white/80 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="fp-email"
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-av-dark-blue border-t-transparent animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          )}

          {!success && (
            <p className="text-center text-sm text-av-hint mt-6">
              Remember your password?{" "}
              <Link href="/login" className="text-av-orange font-semibold hover:text-av-light-orange transition-colors">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
    </>
  );
}
