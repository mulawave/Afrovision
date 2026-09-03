"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getMyBankDetailsApi,
  getGiftWalletApi,
  requestWithdrawalApi,
  type BankDetails,
  type GiftWallet,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import AddBankAccountModal from "./AddBankAccountModal";
import WithdrawalSuccessModal from "./WithdrawalSuccessModal";

export default function WithdrawalPage() {
  const { isAuthenticated, isMinor } = useAuth();
  const [wallet, setWallet] = useState<GiftWallet | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [giftRes, bankRes] = await Promise.all([
        getGiftWalletApi(),
        getMyBankDetailsApi(),
      ]);
      if (giftRes.ok && "wallet" in giftRes.data) setWallet(giftRes.data.wallet);
      if (bankRes.ok && "bank_details" in bankRes.data) setBankDetails(bankRes.data.bank_details);
    } catch {
      setError("Failed to load withdrawal data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated, load]);

  const ngnBalance = wallet?.cash ?? 0;

  const TRANSACTION_FEE = 50;
  const SERVICE_CHARGE = 50;
  const TOTAL_FEES = TRANSACTION_FEE + SERVICE_CHARGE;
  const VAT_RATE = 0.075;
  const VAT_AMOUNT = Math.round(TOTAL_FEES * VAT_RATE * 100) / 100; // ₦7.50
  const TOTAL_CHARGES = TOTAL_FEES + VAT_AMOUNT; // ₦107.50

  const parsedAmount = parseFloat(amount) || 0;
  const totalDebit = parsedAmount > 0 ? parsedAmount + TOTAL_CHARGES : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!bankDetails) {
      setSubmitError("Add your bank account first before requesting a withdrawal.");
      return;
    }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setSubmitError("Enter a valid amount.");
      return;
    }
    if (parsed + TOTAL_CHARGES > ngnBalance) {
      setSubmitError(`Insufficient balance. You need ₦${(parsed + TOTAL_CHARGES).toLocaleString()} (₦${parsed.toLocaleString()} + ₦${TOTAL_FEES} fees + ₦${VAT_AMOUNT} VAT) but you only have ₦${ngnBalance.toLocaleString()}.`);
      return;
    }
    if (parsed < 100) {
      setSubmitError("Minimum withdrawal amount is ₦100.");
      return;
    }

    setSubmitting(true);
    const res = await requestWithdrawalApi(parsed);
    setSubmitting(false);

    if (res.ok && "withdrawal" in res.data) {
      setSuccessAmount(parsed);
      setAmount("");
      // Re-fetch wallet balance (already deducted server-side)
      const giftRes = await getGiftWalletApi();
      if (giftRes.ok && "wallet" in giftRes.data) setWallet(giftRes.data.wallet);
      setShowSuccess(true);
    } else {
      const errData = res.data as { error?: string };
      setSubmitError(errData.error || "Failed to submit withdrawal request.");
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to request withdrawals.</p>
          <Link href="/login?redirect=/wallet/withdrawal" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (isMinor) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Withdrawals</p>
          <h1 className="mt-3 text-2xl font-bold text-av-white">Not available for minors</h1>
          <p className="mt-4 text-sm text-av-light-orange">Wallet withdrawals are restricted to users aged 18 and above.</p>
          <Link href="/wallet" className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            ← Back to Wallet
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Withdrawals — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/wallet" className="text-xs text-av-light-orange hover:text-av-light-orange transition-colors">
                Wallet
              </Link>
              <span className="text-av-light-orange text-xs">/</span>
              <span className="text-xs text-av-light-orange">Withdrawals</span>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Finance</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Withdrawals</h1>
            <p className="mt-2 text-sm text-av-light-orange">Request an NGN cash withdrawal to your registered bank account.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-av-error/30 bg-av-error/5 p-8 text-center">
              <p className="text-sm text-av-error mb-3">{error}</p>
              <button onClick={load} className="text-sm text-av-orange hover:text-av-light-orange">
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Bank Details Card */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h2 className="text-sm font-semibold text-av-white mb-4">Withdrawal Bank Account</h2>
                {bankDetails ? (
                  <div className="rounded-xl border border-av-orange/30 bg-av-orange/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-av-white">{bankDetails.account_name}</p>
                        <p className="text-sm text-av-light-orange font-mono">{bankDetails.account_number}</p>
                        <p className="text-xs text-av-light-orange">{bankDetails.bank_name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full bg-av-success/15 border border-av-success/30 px-3 py-1">
                        <svg className="h-3 w-3 text-av-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[10px] font-bold text-av-success uppercase">Verified</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-av-orange/40 p-6 text-center">
                    <p className="text-sm text-av-light-orange mb-4">
                      You haven&apos;t added a bank account yet. Bank details are required to withdraw.
                    </p>
                    <button
                      onClick={() => setShowAddBank(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Bank Account
                    </button>
                  </div>
                )}
              </section>

              {/* Request Withdrawal Card */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h2 className="text-sm font-semibold text-av-white mb-1">Request Withdrawal</h2>
                <p className="text-xs text-av-light-orange mb-5">
                  Available balance:{" "}
                  <span className="font-bold text-av-white">₦{ngnBalance.toLocaleString()}</span>
                </p>

                {submitError && (
                  <div className="mb-4 rounded-xl border border-av-error/30 bg-av-error/10 p-4 text-sm text-av-error">
                    {submitError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-av-light-orange mb-2 uppercase tracking-wider">
                      Amount to Withdraw (NGN)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-av-light-orange">₦</span>
                      <input
                        type="number"
                        min="100"
                        step="0.01"
                        max={ngnBalance}
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setSubmitError(null); }}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-av-input-border bg-av-input-fill pl-8 pr-4 py-3.5 text-sm text-av-white placeholder-av-hint focus:border-av-orange focus:outline-none transition-colors"
                        disabled={submitting || !bankDetails}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-av-light-orange">
                      Minimum ₦100 · Maximum ₦5,000,000
                    </p>
                  </div>

                  {/* Charges Breakdown */}
                  {parsedAmount > 0 && (
                    <div className="rounded-xl border border-av-input-border/30 bg-av-input-fill/30 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-av-light-orange">You will receive</span>
                        <span className="font-semibold text-av-white">₦{parsedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-av-light-orange">Transaction fee</span>
                        <span className="text-av-light-orange">₦{TRANSACTION_FEE.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-av-light-orange">Service charge</span>
                        <span className="text-av-light-orange">₦{SERVICE_CHARGE.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-av-light-orange">VAT (7.5%)</span>
                        <span className="text-av-light-orange">₦{VAT_AMOUNT.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-av-input-border/30 pt-2.5 flex items-center justify-between text-sm">
                        <span className="font-semibold text-av-white">Total to be debited</span>
                        <span className="font-bold text-av-orange">₦{totalDebit.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !bankDetails || !amount || ngnBalance === 0}
                    className="w-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange py-3.5 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Submitting…
                      </span>
                    ) : (
                      "Request Withdrawal"
                    )}
                  </button>
                </form>

                <p className="mt-4 text-xs text-av-light-orange">
                  Withdrawal requests are reviewed by the AfroVision team within 1–3 business days.
                  Approved transfers are sent directly to your registered bank account.
                </p>
              </section>

              {/* Link to History */}
              <div className="text-center">
                <Link
                  href="/wallet/withdrawal/history"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View Withdrawal History
                </Link>
              </div>

            </div>
          )}
        </div>
      </main>

      <AddBankAccountModal
        open={showAddBank}
        onClose={() => setShowAddBank(false)}
        onSaved={(details) => {
          setBankDetails(details);
          setShowAddBank(false);
        }}
      />

      <WithdrawalSuccessModal
        open={showSuccess}
        amount={successAmount}
        totalDebit={successAmount + TOTAL_CHARGES}
        transactionFee={TRANSACTION_FEE}
        serviceCharge={SERVICE_CHARGE}
        vatAmount={VAT_AMOUNT}
        bankName={bankDetails?.bank_name ?? ""}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
}
