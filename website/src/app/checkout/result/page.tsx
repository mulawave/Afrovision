"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { verifyCheckoutApi, type CheckoutPayment, type GiftWallet, type Plan } from "@/lib/api";

function CheckoutResultContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") || "";
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [wallet, setWallet] = useState<GiftWallet | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!paymentId) {
        setError("Missing payment reference");
        setLoading(false);
        return;
      }

      const res = await verifyCheckoutApi(paymentId);
      if (cancelled) return;

      if (res.ok && "payment" in res.data) {
        setPayment(res.data.payment);
        setWallet(res.data.wallet);
        setPlan(res.data.plan);
        await refreshUser();
        setError(null);
      } else {
        setError("error" in res.data ? res.data.error : "Payment verification failed");
      }
      setLoading(false);
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [paymentId, refreshUser]);

  const destinationHref = payment?.purpose === "wallet_topup" ? "/wallet" : "/pricing";
  const destinationLabel = payment?.purpose === "wallet_topup" ? "Go to Wallet" : "Back to Pricing";

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl rounded-[2rem] border border-av-input-border/30 bg-av-card p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            <p className="text-sm text-av-light-orange">Verifying your payment...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-red-300/80">Verification Error</p>
            <h1 className="mt-3 text-3xl font-bold text-av-white">Payment not confirmed</h1>
            <p className="mt-3 text-sm text-red-200">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={destinationHref}
                className="rounded-full border border-av-input-border/30 px-6 py-3 text-sm font-semibold text-av-light-orange transition hover:border-av-orange/30 hover:text-av-white"
              >
                {destinationLabel}
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-bold text-av-dark-blue"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">Payment Verified</p>
            <h1 className="mt-3 text-3xl font-bold text-av-white">Checkout complete</h1>
            <p className="mt-3 text-sm text-av-light-orange">
              {payment?.purpose === "wallet_topup"
                ? "Your wallet has been credited successfully."
                : `Your ${plan?.name || "subscription"} plan is now active.`}
            </p>

            <div className="mt-6 rounded-2xl border border-av-orange/20 bg-av-orange/5 px-5 py-4 text-left">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-av-light-orange">Provider</span>
                <span className="font-semibold text-av-white">{payment?.provider}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-av-light-orange">Amount</span>
                <span className="font-semibold text-av-white">₦{payment?.amount_ngn.toLocaleString()}</span>
              </div>
              {wallet ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-av-light-orange">Cash Balance</span>
                    <span className="font-semibold text-av-white">₦{wallet.cash.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-av-light-orange">Off-chain vPT</span>
                    <span className="font-semibold text-av-white">{wallet.vpt.toLocaleString()} units</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={destinationHref}
                className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-bold text-av-dark-blue"
              >
                {destinationLabel}
              </Link>
              <Link
                href={payment?.purpose === "wallet_topup" ? "/pricing" : "/wallet"}
                className="rounded-full border border-av-input-border/30 px-6 py-3 text-sm font-semibold text-av-light-orange transition hover:border-av-orange/30 hover:text-av-white"
              >
                {payment?.purpose === "wallet_topup" ? "Browse Plans" : "Open Wallet"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <CheckoutResultContent />
    </Suspense>
  );
}
