"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  exchangeAssetsApi,
  getExchangeRatesApi,
  getGiftWalletApi,
  type ExchangeRates,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function ConvertPage() {
  const { isAuthenticated } = useAuth();

  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ravensBalance, setRavensBalance] = useState(0);
  const [vptBalance, setVptBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    message: string;
    ravensUsed: number;
    vptGained: number;
  } | null>(null);

  const vptRavenRate = rates?.vpt_raven_rate ?? 75;
  const ravenNgnRate = rates?.raven_ngn_rate ?? 10;

  const ravensInput = Number(amount) || 0;
  const vptPreview = ravensInput > 0 ? ravensInput / vptRavenRate : 0;
  const hasEnoughRavens = ravensInput <= ravensBalance;
  const meetsMinimum = ravensInput >= vptRavenRate;
  const canConvert =
    ravensInput > 0 && hasEnoughRavens && meetsMinimum && !converting;

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setRatesError(null);
      const [ratesRes, walletRes] = await Promise.allSettled([
        getExchangeRatesApi(),
        getGiftWalletApi(),
      ]);

      if (cancelled) return;

      if (
        ratesRes.status === "fulfilled" &&
        ratesRes.value.ok &&
        "rates" in ratesRes.value.data
      ) {
        setRates(ratesRes.value.data.rates);
      } else {
        setRatesError("Could not load exchange rates. Using defaults.");
      }

      if (
        walletRes.status === "fulfilled" &&
        walletRes.value.ok &&
        "wallet" in walletRes.value.data
      ) {
        const w = walletRes.value.data.wallet;
        setRavensBalance(w.coins ?? 0);
        setVptBalance(w.vpt ?? 0);
      }

      setLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  function handleMax() {
    const maxConvertible = Math.floor(ravensBalance / vptRavenRate) * vptRavenRate;
    if (maxConvertible > 0) setAmount(String(maxConvertible));
  }

  async function handleConvert() {
    if (!canConvert) return;
    setConverting(true);
    setError(null);

    const res = await exchangeAssetsApi("ravens", "vpt", ravensInput);
    if (res.ok && "wallet" in res.data) {
      const ravensUsed = ravensBalance - res.data.wallet.coins;
      const vptGained = res.data.wallet.vpt - vptBalance;
      setSuccess({
        message: res.data.message,
        ravensUsed: Math.abs(ravensUsed),
        vptGained: Math.abs(vptGained),
      });
      setRavensBalance(res.data.wallet.coins);
      setVptBalance(res.data.wallet.vpt);
      setAmount("");
    } else {
      setError(
        "error" in res.data
          ? (res.data as { error: string }).error
          : "Conversion failed. Please try again."
      );
    }
    setConverting(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">
            Sign in to convert Ravens.
          </p>
          <Link
            href="/login?redirect=/wallet/convert"
            className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange"
          >
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Ravens → vPT — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="mx-auto max-w-xl px-6">
          {/* Back link */}
          <Link
            href="/wallet"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-av-light-orange hover:text-av-orange transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Wallet
          </Link>

          {/* Header */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
              Convert
            </p>
            <h1 className="mt-2 text-2xl font-bold text-av-white">
              Ravens → vPT
            </h1>
            <p className="mt-2 text-sm text-av-light-orange">
              Convert your Ravens into off-chain vPT at the current admin-set
              exchange rate.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Exchange Rate Card */}
              <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-av-light-orange">
                  Live Exchange Rate
                </p>
                {ratesError ? (
                  <p className="mt-2 text-xs text-red-400">{ratesError}</p>
                ) : null}
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-2xl font-extrabold text-av-white">
                    {vptRavenRate}
                  </span>
                  <span className="text-sm text-av-light-orange">
                    Ravens = 1 vPT
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-av-light-orange/60">
                  1 Raven ≈ ₦{ravenNgnRate} · 1 vPT ≈ ₦
                  {(rates?.vpt_price_ngn ?? vptRavenRate * ravenNgnRate).toLocaleString()}
                </p>
              </div>

              {/* Balance Cards */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-av-input-border/20 bg-av-card/60 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-av-light-orange">
                    Ravens Balance
                  </p>
                  <p className="mt-1 text-lg font-bold text-av-white">
                    {ravensBalance.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-av-input-border/20 bg-av-card/60 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-av-light-orange">
                    Off-chain vPT
                  </p>
                  <p className="mt-1 text-lg font-bold text-av-orange">
                    {vptBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Conversion Form */}
              <div className="mt-6 rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
                  Ravens to Convert
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                      setSuccess(null);
                    }}
                    placeholder={`Min ${vptRavenRate}`}
                    className="flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder:text-av-light-orange/40 outline-none focus:border-av-orange/50 transition-colors"
                  />
                  <button
                    onClick={handleMax}
                    className="rounded-lg border border-av-orange/30 bg-av-orange/10 px-3 py-3 text-xs font-bold text-av-orange hover:bg-av-orange/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>

                {/* Conversion Preview */}
                {ravensInput > 0 && (
                  <div className="mt-4 rounded-xl border border-av-orange/20 bg-av-orange/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-av-light-orange">
                        You send
                      </span>
                      <span className="text-sm font-semibold text-av-white">
                        {ravensInput.toLocaleString()} Ravens
                      </span>
                    </div>
                    <div className="my-2 flex justify-center">
                      <svg
                        className="h-5 w-5 text-av-orange"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-av-light-orange">
                        You receive
                      </span>
                      <span className="text-sm font-bold text-av-orange">
                        {vptPreview.toFixed(4)} vPT
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-av-light-orange/50 text-right">
                      ≈ ₦
                      {(
                        vptPreview *
                        (rates?.vpt_price_ngn ?? vptRavenRate * ravenNgnRate)
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                )}

                {/* Validation Messages */}
                {ravensInput > 0 && !hasEnoughRavens && (
                  <p className="mt-2 text-xs text-red-400">
                    Insufficient Ravens. You have{" "}
                    {ravensBalance.toLocaleString()}.
                  </p>
                )}
                {ravensInput > 0 && !meetsMinimum && hasEnoughRavens && (
                  <p className="mt-2 text-xs text-av-light-orange">
                    Minimum {vptRavenRate} Ravens required for 1 vPT.
                  </p>
                )}

                {error && (
                  <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </p>
                )}

                {/* Convert Button */}
                <button
                  onClick={handleConvert}
                  disabled={!canConvert}
                  className="mt-5 w-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange py-3.5 text-sm font-bold text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  {converting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-av-dark-blue border-t-transparent" />
                      Converting…
                    </span>
                  ) : (
                    `Convert ${ravensInput > 0 ? ravensInput.toLocaleString() : ""} Ravens → vPT`
                  )}
                </button>
              </div>

              {/* Success Card */}
              {success && (
                <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-900/10 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                    <svg
                      className="h-6 w-6 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-green-300">
                    Conversion Complete
                  </p>
                  <p className="mt-1 text-xs text-green-400/70">
                    {success.message}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-green-500/20 bg-green-950/30 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-green-400">
                        Spent
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-green-200">
                        {success.ravensUsed.toLocaleString()} Ravens
                      </p>
                    </div>
                    <div className="rounded-xl border border-green-500/20 bg-green-950/30 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-green-400">
                        Received
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-green-200">
                        {success.vptGained.toFixed(4)} vPT
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSuccess(null)}
                    className="mt-4 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors"
                  >
                    Convert More →
                  </button>
                </div>
              )}

              {/* Info Footer */}
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-av-input-border/20 bg-av-card/40 px-4 py-3">
                <svg
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-av-light-orange"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-[11px] leading-relaxed text-av-light-orange/70">
                  Exchange rates are set by the admin and may change. Conversions
                  are instant and irreversible. Converted vPT goes to your
                  off-chain gift wallet.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
