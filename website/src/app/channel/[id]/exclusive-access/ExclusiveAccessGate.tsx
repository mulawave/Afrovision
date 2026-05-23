"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  getChannelApi,
  getExclusiveAccessStatusApi,
  purchaseExclusiveAccessApi,
  renewExclusiveAccessApi,
  verifyExclusivePicApi,
  type Channel,
} from "@/lib/api";

type GateState =
  | "loading"
  | "requiresLogin"
  | "requiresKyc"
  | "noEntitlement"
  | "purchaseInProgress"
  | "purchaseFailure"
  | "purchaseSuccess"
  | "hasEntitlement";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "30-day access window";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ExclusiveAccessGate({ id }: { id: string }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [state, setState] = useState<GateState>("loading");
  const [eligibleByKyc, setEligibleByKyc] = useState(false);
  const [hasActiveEntitlement, setHasActiveEntitlement] = useState(false);
  const [renewalRequired, setRenewalRequired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [monthlyFeeNgn, setMonthlyFeeNgn] = useState(0);
  const [pic, setPic] = useState("");
  const [picVerified, setPicVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyingPic, setVerifyingPic] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setError(null);
      setMessage(null);
      setPicVerified(false);

      const chRes = await getChannelApi(id);
      if (cancelled) return;
      if (!chRes.ok || !("channel" in chRes.data)) {
        setError("Channel not found.");
        setState("purchaseFailure");
        return;
      }

      const ch = chRes.data.channel;
      setChannel(ch);

      if (ch.type !== "exclusive") {
        router.replace(`/live/${id}`);
        return;
      }

      if (!isAuthenticated) {
        setState("requiresLogin");
        return;
      }

      const statusRes = await getExclusiveAccessStatusApi(id);
      if (cancelled) return;

      if (!statusRes.ok) {
        if (statusRes.status === 401) {
          setState("requiresLogin");
          return;
        }
        setError("Could not load exclusive access status.");
        setState("purchaseFailure");
        return;
      }

      if (!("eligibleByKyc" in statusRes.data)) {
        setError("Unexpected exclusive access response.");
        setState("purchaseFailure");
        return;
      }

      const s = statusRes.data;
      setEligibleByKyc(s.eligibleByKyc);
      setHasActiveEntitlement(s.hasActiveEntitlement);
      setRenewalRequired(s.renewalRequired);
      setExpiresAt(s.expiresAt ?? null);
      setMonthlyFeeNgn(Number(s.monthlyFeeNgn || ch.exclusive_monthly_fee_ngn || 0));

      if (!s.eligibleByKyc) {
        setState("requiresKyc");
      } else if (s.hasActiveEntitlement) {
        setState("hasEntitlement");
      } else {
        setState("noEntitlement");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, router]);

  const feeLabel = useMemo(() => `NGN ${Math.max(0, monthlyFeeNgn).toLocaleString()}`, [monthlyFeeNgn]);

  async function handlePurchaseOrRenew() {
    setState("purchaseInProgress");
    setError(null);
    setMessage(null);

    const res = renewalRequired
      ? await renewExclusiveAccessApi(id)
      : await purchaseExclusiveAccessApi(id);

    if (!res.ok) {
      const msg = "error" in res.data ? res.data.error : "Failed to complete purchase.";
      setError(msg === "INSUFFICIENT_NGN" ? "Insufficient wallet balance for this purchase." : msg);
      setState("purchaseFailure");
      return;
    }

    if (!("has_access" in res.data) || !res.data.has_access) {
      setError("Purchase did not grant access.");
      setState("purchaseFailure");
      return;
    }

    setHasActiveEntitlement(true);
    setRenewalRequired(false);
    setExpiresAt(res.data.expires_at ?? null);
    if (res.data.personal_identifier_code) {
      setPic(res.data.personal_identifier_code);
    }
    setState("purchaseSuccess");
  }

  async function handleVerifyPic() {
    if (!pic.trim()) {
      setError("Enter your personal identifier code to verify.");
      return;
    }

    setVerifyingPic(true);
    setError(null);
    setMessage(null);
    const res = await verifyExclusivePicApi(id, pic.trim());
    setVerifyingPic(false);

    if (!res.ok || !("valid" in res.data) || !res.data.valid) {
      setPicVerified(false);
      setError("error" in res.data ? res.data.error : "PIC verification failed.");
      return;
    }

    setPicVerified(true);
    setMessage("PIC verified. You can proceed to watch now.");
  }

  function continueToLive() {
    router.push(`/live/${id}`);
  }

  function copyPic() {
    if (!pic.trim()) return;
    navigator.clipboard.writeText(pic.trim()).then(() => {
      setMessage("PIC copied.");
      setTimeout(() => setMessage(null), 1800);
    }).catch(() => {
      setMessage("Copy failed. Select and copy manually.");
    });
  }

  return (
    <main className="min-h-screen pt-20 pb-16">
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-av-light-orange/80">Exclusive Access</p>
          <h1 className="mt-2 text-2xl font-bold text-av-white">{channel?.name || "Exclusive Channel"}</h1>
          <p className="mt-2 text-sm text-av-light-orange">
            Monthly fee: <span className="font-semibold text-av-orange">{feeLabel}</span>
          </p>
          <p className="mt-1 text-xs text-av-light-orange/80">
            Access is valid for 30 days and renews at the current channel fee.
          </p>

          <div className="mt-6 rounded-2xl border border-av-input-border/30 bg-av-input-fill/60 p-5">
            {state === "loading" && (
              <div className="flex items-center gap-3 text-sm text-av-light-orange">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
                Checking access status...
              </div>
            )}

            {state === "requiresLogin" && (
              <div>
                <h2 className="text-lg font-semibold text-av-white">Login Required</h2>
                <p className="mt-2 text-sm text-av-light-orange">
                  Sign in to check eligibility and purchase exclusive access.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/channel/${id}/exclusive-access`)}`}
                    className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
                  >
                    Go to Login
                  </Link>
                  <Link href={`/channel/${id}`} className="rounded-xl border border-av-input-border/40 px-4 py-2 text-sm text-av-light-orange">
                    Back to Channel
                  </Link>
                </div>
              </div>
            )}

            {state === "requiresKyc" && (
              <div>
                <h2 className="text-lg font-semibold text-av-white">Adult KYC Required</h2>
                <p className="mt-2 text-sm text-av-light-orange">
                  Complete approved adult KYC before accessing this channel.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link href="/kyc" className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue">
                    Complete KYC
                  </Link>
                  <Link href={`/channel/${id}`} className="rounded-xl border border-av-input-border/40 px-4 py-2 text-sm text-av-light-orange">
                    Back to Channel
                  </Link>
                </div>
              </div>
            )}

            {state === "noEntitlement" && (
              <div>
                <h2 className="text-lg font-semibold text-av-white">
                  {renewalRequired ? "Renew Access" : "No Active Entitlement"}
                </h2>
                <p className="mt-2 text-sm text-av-light-orange">
                  {renewalRequired
                    ? "Your entitlement has expired. Renew now to continue watching."
                    : "Purchase exclusive access to unlock this channel."}
                </p>
                <button
                  type="button"
                  onClick={handlePurchaseOrRenew}
                  className="mt-4 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
                >
                  {renewalRequired ? "Renew Now" : "Purchase Access"}
                </button>
              </div>
            )}

            {state === "purchaseInProgress" && (
              <div className="flex items-center gap-3 text-sm text-av-light-orange">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
                Processing payment and access setup...
              </div>
            )}

            {(state === "purchaseSuccess" || state === "hasEntitlement") && (
              <div>
                <h2 className="text-lg font-semibold text-av-white">
                  {state === "purchaseSuccess" ? "Access Activated" : "Active Entitlement"}
                </h2>
                <p className="mt-2 text-sm text-av-light-orange">
                  Expires: <span className="text-av-white">{formatDate(expiresAt)}</span>
                </p>

                <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
                  Personal Identifier Code (PIC)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={pic}
                    onChange={(event) => setPic(event.target.value.toUpperCase())}
                    placeholder="Enter or paste PIC"
                    className="h-11 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyPic}
                    className="rounded-xl border border-av-input-border/40 px-3 text-sm text-av-light-orange"
                  >
                    Copy
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyPic}
                    disabled={verifyingPic}
                    className="rounded-xl border border-av-orange/40 px-4 py-2 text-sm font-semibold text-av-orange disabled:opacity-60"
                  >
                    {verifyingPic ? "Verifying..." : picVerified ? "PIC Verified" : "Verify PIC"}
                  </button>
                  <button
                    type="button"
                    onClick={continueToLive}
                    className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-2 text-sm font-semibold text-av-dark-blue"
                  >
                    Continue to Live
                  </button>
                </div>
              </div>
            )}

            {state === "purchaseFailure" && (
              <div>
                <h2 className="text-lg font-semibold text-av-white">Could Not Complete Access</h2>
                <p className="mt-2 text-sm text-av-light-orange">Try again to refresh your access state.</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-xl border border-av-input-border/40 px-4 py-2 text-sm text-av-light-orange"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-av-error">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

          {(state !== "requiresLogin" && state !== "requiresKyc") && (
            <div className="mt-6">
              <Link href={`/channel/${id}`} className="text-sm text-av-light-orange hover:text-av-orange transition-colors">
                ← Back to Channel
              </Link>
            </div>
          )}
        </div>

        {eligibleByKyc && hasActiveEntitlement && (
          <div className="mt-4 rounded-2xl border border-av-input-border/30 bg-av-card/70 px-5 py-4 text-xs text-av-light-orange">
            Entitlement confirmed. Renewal required: <span className="text-av-white">{renewalRequired ? "Yes" : "No"}</span>
          </div>
        )}
      </div>
    </main>
  );
}
