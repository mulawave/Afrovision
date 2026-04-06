"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createWalletApi,
  getGiftWalletApi,
  getLedgerApi,
  getVptBalanceApi,
  getWalletApi,
  type CreatorWallet,
  type GiftWallet,
  type LedgerEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function WalletPage() {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [creatorWallet, setCreatorWallet] = useState<CreatorWallet | null>(null);
  const [giftWallet, setGiftWallet] = useState<GiftWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [vptBalance, setVptBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingWallet, setCreatingWallet] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    Promise.allSettled([getGiftWalletApi(), getVptBalanceApi(), getLedgerApi(), getWalletApi()]).then((results) => {
      if (cancelled) return;
      const [giftRes, vptRes, ledgerRes, walletRes] = results;

      if (giftRes.status === "fulfilled" && giftRes.value.ok && "wallet" in giftRes.value.data) {
        setGiftWallet(giftRes.value.data.wallet);
      }
      if (vptRes.status === "fulfilled" && vptRes.value.ok && "balance" in vptRes.value.data) {
        setVptBalance(vptRes.value.data.balance);
      }
      if (ledgerRes.status === "fulfilled" && ledgerRes.value.ok && "ledger" in ledgerRes.value.data) {
        setLedger(ledgerRes.value.data.ledger);
      }
      if (walletRes.status === "fulfilled" && walletRes.value.ok && "wallet" in walletRes.value.data) {
        setCreatorWallet(walletRes.value.data.wallet);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  async function handleCreateWallet() {
    setCreatingWallet(true);
    const res = await createWalletApi();
    if (res.ok && "wallet" in res.data) {
      setCreatorWallet(res.data.wallet);
      await refreshUser();
    }
    setCreatingWallet(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-hint">Sign in to access your wallet.</p>
          <Link href="/login?redirect=/wallet" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Wallet — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Finance</p>
          <h1 className="mt-2 text-3xl font-bold text-av-white">Wallet</h1>
          <p className="mt-2 text-sm text-av-hint">Track vPT, gift-wallet balances, recent ledger activity, and creator wallet readiness.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="vPT Balance" value={`${(vptBalance ?? user?.vpt_balance ?? 0).toLocaleString()} VPT`} />
              <StatCard label="Gift Wallet vPT" value={`${giftWallet?.vpt_units?.toLocaleString() ?? 0} units`} />
              <StatCard label="Gift Wallet NGN" value={`₦${giftWallet?.ngn_balance?.toLocaleString() ?? 0}`} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h2 className="text-sm font-semibold text-av-white">Creator Wallet</h2>
                {creatorWallet ? (
                  <div className="mt-4 space-y-3 text-sm text-av-hint">
                    <p>Status: <span className="font-semibold text-av-white">{creatorWallet.status || "active"}</span></p>
                    <p className="break-all">Address: <span className="font-semibold text-av-white">{creatorWallet.bsc_address}</span></p>
                  </div>
                ) : user?.role === "creator" || user?.role === "admin" ? (
                  <div className="mt-4">
                    <p className="text-sm text-av-hint">No creator wallet exists yet. Create one to receive on-chain distributions.</p>
                    <button
                      onClick={handleCreateWallet}
                      disabled={creatingWallet}
                      className="mt-4 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                    >
                      {creatingWallet ? "Creating..." : "Create Wallet"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-av-hint">Creator wallets are available to creator and admin accounts.</p>
                )}
              </section>

              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-semibold text-av-white">Recent Ledger</h2>
                  <span className="text-[11px] text-av-hint">{ledger.length} entries</span>
                </div>
                {ledger.length === 0 ? (
                  <p className="mt-4 text-sm text-av-hint">No ledger activity yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {ledger.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-av-white">{entry.type.replace(/_/g, " ")}</p>
                            <p className="mt-1 text-[11px] text-av-hint">
                              {new Date(entry.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            {entry.amount_ngn ? <p className="text-sm font-semibold text-av-light-orange">₦{entry.amount_ngn.toLocaleString()}</p> : null}
                            {entry.amount_vpt_units ? <p className="text-sm font-semibold text-av-orange">{entry.amount_vpt_units.toLocaleString()} vPT</p> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-av-hint">{label}</p>
      <p className="mt-2 text-xl font-semibold text-av-white">{value}</p>
    </div>
  );
}