"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getDeletionStatusApi,
  requestAccountDeletionApi,
  cancelAccountDeletionApi,
  confirmImmediateDeletionApi,
  clearAuth,
  type DeletionRequest,
  type ErrorResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const REASONS = [
  "I no longer use AfroVision",
  "I have privacy concerns",
  "I found a better alternative",
  "I have multiple accounts",
  "I'm not satisfied with the service",
  "Other",
];

export default function DeleteAccountPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<DeletionRequest | null>(null);

  // Request form state
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Immediate deletion
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Cancellation
  const [cancelling, setCancelling] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    const res = await getDeletionStatusApi();
    if (res.ok && "has_pending_request" in res.data) {
      const data = res.data as { has_pending_request: boolean; request?: DeletionRequest };
      setPendingRequest(data.has_pending_request && data.request ? data.request : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    checkStatus();
  }, [isAuthenticated, checkStatus]);

  async function handleSubmitRequest() {
    if (!reason) {
      setError("Please select a reason");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await requestAccountDeletionApi(reason, feedback);
    if (res.ok && "request" in res.data) {
      const data = res.data as { message: string; request: DeletionRequest };
      setPendingRequest(data.request);
      setSuccess(data.message);
    } else {
      const e = res.data as ErrorResponse;
      setError(e.error || "Failed to submit deletion request");
    }
    setSubmitting(false);
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    const res = await cancelAccountDeletionApi();
    if (res.ok) {
      setPendingRequest(null);
      setSuccess("Deletion request cancelled. Your account is safe.");
    } else {
      const e = res.data as ErrorResponse;
      setError(e.error || "Failed to cancel request");
    }
    setCancelling(false);
  }

  async function handleImmediateDelete() {
    if (confirmText !== "DELETE MY ACCOUNT") {
      setError('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setDeleting(true);
    setError(null);

    const res = await confirmImmediateDeletionApi(password);
    if (res.ok) {
      clearAuth();
      router.push("/login");
    } else {
      const e = res.data as ErrorResponse;
      setError(e.error || "Failed to delete account");
    }
    setDeleting(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to manage your account.</p>
          <Link href="/login?redirect=/profile/delete-account" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Delete Account — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/profile" className="text-xs font-semibold text-av-orange hover:text-av-light-orange">
              ← Back to Profile
            </Link>
            <h1 className="mt-4 text-3xl font-bold text-av-error">Delete Account</h1>
            <p className="mt-2 text-sm text-av-light-orange">
              This action is irreversible. Please read carefully before proceeding.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : pendingRequest ? (
            /* ── Pending Request View ──────────────────────────────── */
            <div className="space-y-6 animate-fade-in-up">
              <section className="rounded-2xl border border-av-orange/30 bg-av-orange/5 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-3 w-3 rounded-full bg-av-orange animate-pulse" />
                  <h2 className="text-lg font-semibold text-av-orange">Deletion Scheduled</h2>
                </div>
                <p className="text-sm text-av-light-orange">
                  Your account is scheduled for permanent deletion on{" "}
                  <span className="font-bold text-av-white">
                    {new Date(pendingRequest.scheduled_deletion_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>.
                </p>
                <p className="mt-2 text-sm text-av-light-orange">
                  You have <span className="font-bold text-av-white">{pendingRequest.grace_period_days} days</span> to cancel this request. After that, your account and all associated data will be permanently deleted.
                </p>
              </section>

              {/* What gets deleted */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h3 className="text-sm font-semibold text-av-white mb-3">What will be deleted:</h3>
                <ul className="space-y-2 text-sm text-av-light-orange">
                  <li className="flex items-start gap-2"><span className="text-av-error mt-0.5">✕</span> Your profile and personal information</li>
                  <li className="flex items-start gap-2"><span className="text-av-error mt-0.5">✕</span> All channels you own (will be disabled)</li>
                  <li className="flex items-start gap-2"><span className="text-av-error mt-0.5">✕</span> VPT balance and transaction history</li>
                  <li className="flex items-start gap-2"><span className="text-av-error mt-0.5">✕</span> Subscriptions and creator earnings</li>
                  <li className="flex items-start gap-2"><span className="text-av-error mt-0.5">✕</span> All uploaded content and media</li>
                </ul>
              </section>

              {error && (
                <div className="rounded-xl border border-av-error/30 bg-av-error/10 p-4 text-sm text-av-error">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                  {success}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange py-3 text-sm font-bold text-av-dark-blue transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-av-orange/25 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel Deletion — Keep My Account"}
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="rounded-xl border border-av-error/30 bg-av-error/5 px-6 py-3 text-sm font-semibold text-av-error hover:bg-av-error/10 transition-all"
                >
                  Delete Now
                </button>
              </div>

              {/* Immediate deletion modal */}
              {showConfirm && (
                <section className="rounded-2xl border border-av-error/40 bg-av-card p-6 space-y-4 animate-fade-in-up">
                  <h3 className="text-base font-bold text-av-error">Confirm Immediate Deletion</h3>
                  <p className="text-sm text-av-light-orange">This will permanently delete your account right now. This cannot be undone.</p>

                  <div>
                    <label className="block text-xs font-semibold text-av-light-orange mb-1">
                      Type &quot;DELETE MY ACCOUNT&quot; to confirm
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE MY ACCOUNT"
                      className="w-full rounded-xl border border-av-input-border/40 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder-av-light-orange/40 focus:border-av-error/60 focus:ring-1 focus:ring-av-error/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-av-light-orange mb-1">
                      Enter your password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your account password"
                      className="w-full rounded-xl border border-av-input-border/40 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder-av-light-orange/40 focus:border-av-error/60 focus:ring-1 focus:ring-av-error/20 outline-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowConfirm(false); setPassword(""); setConfirmText(""); }}
                      className="flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill py-3 text-sm font-semibold text-av-white hover:bg-av-input-fill/80 transition-all"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleImmediateDelete}
                      disabled={deleting || confirmText !== "DELETE MY ACCOUNT" || !password}
                      className="flex-1 rounded-xl bg-av-error py-3 text-sm font-bold text-white transition-all hover:bg-av-error/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Deleting..." : "Permanently Delete"}
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* ── Request Form View ─────────────────────────────────── */
            <div className="space-y-6 animate-fade-in-up">
              {/* Warning banner */}
              <section className="rounded-2xl border border-av-error/30 bg-av-error/5 p-6">
                <h2 className="text-base font-bold text-av-error mb-2">⚠ Before you continue</h2>
                <ul className="space-y-2 text-sm text-av-light-orange">
                  <li>• Your account will be permanently deleted after a <span className="font-bold text-av-white">30-day grace period</span></li>
                  <li>• All your data, channels, content, and balances will be removed</li>
                  <li>• Active subscriptions will not be refunded</li>
                  <li>• You can cancel the request anytime within the grace period</li>
                </ul>
              </section>

              {/* Reason selection */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h3 className="text-sm font-semibold text-av-white mb-4">Why are you leaving?</h3>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label key={r} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${reason === r ? "border-av-error/50 bg-av-error/5" : "border-av-input-border/30 bg-av-input-fill/40 hover:border-av-input-border/50"}`}>
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={(e) => setReason(e.target.value)}
                        className="accent-av-error"
                      />
                      <span className="text-sm text-av-light-orange">{r}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Optional feedback */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h3 className="text-sm font-semibold text-av-white mb-2">Additional feedback (optional)</h3>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Tell us how we can improve..."
                  className="w-full rounded-xl border border-av-input-border/40 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder-av-light-orange/40 focus:border-av-orange/60 focus:ring-1 focus:ring-av-orange/20 outline-none resize-none"
                />
              </section>

              {error && (
                <div className="rounded-xl border border-av-error/30 bg-av-error/10 p-4 text-sm text-av-error">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                  {success}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/profile"
                  className="flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill py-3 text-center text-sm font-semibold text-av-white hover:bg-av-input-fill/80 transition-all"
                >
                  Cancel — Keep My Account
                </Link>
                <button
                  onClick={handleSubmitRequest}
                  disabled={submitting || !reason}
                  className="flex-1 rounded-xl border border-av-error/30 bg-av-error/10 py-3 text-sm font-bold text-av-error transition-all hover:bg-av-error/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Request Account Deletion"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
