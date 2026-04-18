"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  copyrightWorkDescription: string;
  copyrightWorkUrl: string;
  infringingContentUrls: string;
  infringingContentDescription: string;
  goodFaith: boolean;
  accuracy: boolean;
  authority: boolean;
  signature: string;
}

const INITIAL: FormData = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  copyrightWorkDescription: "",
  copyrightWorkUrl: "",
  infringingContentUrls: "",
  infringingContentDescription: "",
  goodFaith: false,
  accuracy: false,
  authority: false,
  signature: "",
};

export default function ReportCopyrightPage() {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const allDeclarations = form.goodFaith && form.accuracy && form.authority;
  const hasRequiredFields =
    form.fullName.trim() &&
    form.email.trim() &&
    form.copyrightWorkDescription.trim() &&
    form.infringingContentUrls.trim() &&
    form.signature.trim() &&
    allDeclarations;

  const set = (field: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!hasRequiredFields) {
      setError("Please complete all required fields and declarations.");
      return;
    }

    setIsSubmitting(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_BASE}/copyright/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          copyrightWorkDescription: form.copyrightWorkDescription.trim(),
          copyrightWorkUrl: form.copyrightWorkUrl.trim(),
          infringingContentUrls: form.infringingContentUrls.trim(),
          infringingContentDescription: form.infringingContentDescription.trim(),
          signature: form.signature.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setTrackingId(data.trackingId || "");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/15 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-av-white mb-2">Report Submitted</h1>
            <p className="text-sm text-av-light-orange mb-4">
              Your copyright infringement report has been received. Our team will review it within 24–72 hours.
            </p>
            {trackingId && (
              <div className="inline-block px-4 py-2 rounded-xl bg-av-dark-blue/60 border border-av-input-border/30 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-av-light-orange mb-1">Tracking Reference</p>
                <p className="text-lg font-mono font-bold text-av-orange">{trackingId}</p>
              </div>
            )}
            <p className="text-xs text-av-light-orange mb-6">
              Keep this tracking reference for your records. You will also receive a confirmation email at{" "}
              <span className="text-av-white">{form.email}</span>.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/copyright"
                className="px-5 py-2.5 rounded-xl border border-av-input-border/40 text-xs font-semibold text-av-light-orange hover:text-av-white hover:border-av-input-border/60 transition-all"
              >
                Copyright Policy
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-xs font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-20 pb-16">
      <title>Report Copyright Infringement — AfroVision</title>
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Legal</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-av-white">Report Copyright Infringement</h1>
          <p className="mt-2 text-sm text-av-light-orange leading-relaxed">
            Use this form to report content on AfroVision that you believe infringes your copyright. Please review our{" "}
            <Link href="/copyright" className="text-av-orange hover:underline">Copyright Infringement Policy</Link>{" "}
            before submitting.
          </p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-av-error/10 border border-av-error/30 text-xs text-av-error font-medium">
              {error}
            </div>
          )}

          {/* Reporter Information */}
          <fieldset className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
            <legend className="text-base font-semibold text-av-white mb-4">Your Contact Information</legend>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cr-name" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                    Full Name <span className="text-av-error">*</span>
                  </label>
                  <input
                    id="cr-name"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                    placeholder="Your full legal name"
                  />
                </div>
                <div>
                  <label htmlFor="cr-email" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                    Email Address <span className="text-av-error">*</span>
                  </label>
                  <input
                    id="cr-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cr-phone" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id="cr-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                    placeholder="+234..."
                  />
                </div>
                <div>
                  <label htmlFor="cr-address" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                    Postal Address
                  </label>
                  <input
                    id="cr-address"
                    type="text"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                    placeholder="Street, City, Country"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Copyrighted Work */}
          <fieldset className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
            <legend className="text-base font-semibold text-av-white mb-4">Original Copyrighted Work</legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="cr-work-desc" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                  Description of the Copyrighted Work <span className="text-av-error">*</span>
                </label>
                <textarea
                  id="cr-work-desc"
                  value={form.copyrightWorkDescription}
                  onChange={(e) => set("copyrightWorkDescription", e.target.value)}
                  required
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50 resize-y"
                  placeholder="Describe the original work that you believe has been infringed (e.g., title, type of work, registration number if available)"
                />
              </div>
              <div>
                <label htmlFor="cr-work-url" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                  URL of Original Work
                </label>
                <input
                  id="cr-work-url"
                  type="url"
                  value={form.copyrightWorkUrl}
                  onChange={(e) => set("copyrightWorkUrl", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                  placeholder="https://example.com/your-original-work"
                />
              </div>
            </div>
          </fieldset>

          {/* Infringing Content */}
          <fieldset className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
            <legend className="text-base font-semibold text-av-white mb-4">Infringing Content on AfroVision</legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="cr-inf-urls" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                  URL(s) of Infringing Content <span className="text-av-error">*</span>
                </label>
                <textarea
                  id="cr-inf-urls"
                  value={form.infringingContentUrls}
                  onChange={(e) => set("infringingContentUrls", e.target.value)}
                  required
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50 resize-y"
                  placeholder="Paste the AfroVision URL(s) of the content you believe infringes your copyright — one per line"
                />
              </div>
              <div>
                <label htmlFor="cr-inf-desc" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                  Additional Description
                </label>
                <textarea
                  id="cr-inf-desc"
                  value={form.infringingContentDescription}
                  onChange={(e) => set("infringingContentDescription", e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50 resize-y"
                  placeholder="Describe how and where the infringement occurs (optional)"
                />
              </div>
            </div>
          </fieldset>

          {/* Declarations */}
          <fieldset className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
            <legend className="text-base font-semibold text-av-white mb-4">Declarations</legend>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={form.goodFaith}
                  onChange={(e) => set("goodFaith", e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 w-4 h-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange focus:ring-av-orange/40 accent-av-orange"
                />
                <span className="text-xs text-av-light-orange leading-relaxed group-hover:text-av-light-orange transition-colors">
                  <span className="text-av-error">*</span> I have a good-faith belief that use of the material described above is not authorised by the copyright owner, its agent, or the law.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={form.accuracy}
                  onChange={(e) => set("accuracy", e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 w-4 h-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange focus:ring-av-orange/40 accent-av-orange"
                />
                <span className="text-xs text-av-light-orange leading-relaxed group-hover:text-av-light-orange transition-colors">
                  <span className="text-av-error">*</span> The information in this notification is accurate, and under penalty of perjury, I am the copyright owner or am authorised to act on behalf of the owner.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={form.authority}
                  onChange={(e) => set("authority", e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-0.5 w-4 h-4 rounded border-av-input-border/40 bg-av-input-fill text-av-orange focus:ring-av-orange/40 accent-av-orange"
                />
                <span className="text-xs text-av-light-orange leading-relaxed group-hover:text-av-light-orange transition-colors">
                  <span className="text-av-error">*</span> I understand that filing a false or misleading notice may result in legal liability, including damages and attorneys&apos; fees.
                </span>
              </label>
            </div>
          </fieldset>

          {/* Signature */}
          <fieldset className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
            <legend className="text-base font-semibold text-av-white mb-4">Electronic Signature</legend>
            <div>
              <label htmlFor="cr-sig" className="block text-xs font-semibold text-av-light-orange mb-1.5">
                Full Legal Name (as signature) <span className="text-av-error">*</span>
              </label>
              <input
                id="cr-sig"
                type="text"
                value={form.signature}
                onChange={(e) => set("signature", e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 transition-all disabled:opacity-50"
                placeholder="Type your full legal name"
              />
              <p className="text-[10px] text-av-light-orange mt-1.5">
                By typing your name above, you certify this report as your electronic signature on {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              </p>
            </div>
          </fieldset>

          {/* Submit */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !hasRequiredFields}
              className="w-full sm:w-auto px-10 h-12 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-av-dark-blue border-t-transparent animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit Copyright Report"
              )}
            </button>
            <p className="text-[10px] text-av-light-orange text-center max-w-md">
              Submitting a false report may result in legal consequences. By submitting, you confirm all information above is true and complete.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
