"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PaymentCheckoutDialog from "@/components/PaymentCheckoutDialog";
import {
  connectExternalWalletApi,
  createWalletApi,
  disconnectExternalWalletApi,
  getCheckoutProvidersApi,
  getConnectedWalletApi,
  getExchangeRatesApi,
  getGiftWalletApi,
  getLedgerApi,
  getReferralDashboardApi,
  getVptBalanceApi,
  getWalletApi,
  importWalletAddressApi,
  initializeCheckoutApi,
  type CheckoutProvider,
  type ConnectedWallet,
  type CreatorWallet,
  type ExchangeRates,
  type GiftWallet,
  type LedgerEntry,
  type ReferralDashboard,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function WalletPage() {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [creatorWallet, setCreatorWallet] = useState<CreatorWallet | null>(null);
  const [giftWallet, setGiftWallet] = useState<GiftWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [vptBalance, setVptBalance] = useState<number | null>(null);
  const [referralLedger, setReferralLedger] = useState<ReferralDashboard["ledger_summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [providers, setProviders] = useState<CheckoutProvider[]>([]);
  const [checkoutProvider, setCheckoutProvider] = useState<"paystack" | "flutterwave">("paystack");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("2000");
  const [topUpBalanceType, setTopUpBalanceType] = useState<"ngn" | "vpt">("ngn");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);

  const RECENT_LEDGER_LIMIT = 3;

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    Promise.allSettled([getGiftWalletApi(), getVptBalanceApi(), getLedgerApi(), getWalletApi(), getReferralDashboardApi(), getExchangeRatesApi(), getConnectedWalletApi()]).then((results) => {
      if (cancelled) return;
      const [giftRes, vptRes, ledgerRes, walletRes, refRes, ratesRes, connRes] = results;

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
      if (refRes.status === "fulfilled" && refRes.value.ok && "ledger_summary" in (refRes.value.data as ReferralDashboard)) {
        setReferralLedger((refRes.value.data as ReferralDashboard).ledger_summary);
      }
      if (ratesRes.status === "fulfilled" && ratesRes.value.ok && "rates" in ratesRes.value.data) {
        setExchangeRates(ratesRes.value.data.rates);
      }
      if (connRes.status === "fulfilled" && connRes.value.ok && "connected" in connRes.value.data && connRes.value.data.connected) {
        setConnectedWallet(connRes.value.data.connected as ConnectedWallet);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    getCheckoutProvidersApi().then((res) => {
      if (!res.ok || !("providers" in res.data)) return;
      setProviders(res.data.providers);
      const firstEnabled = res.data.providers.find((item) => item.enabled);
      if (firstEnabled) {
        setCheckoutProvider(firstEnabled.id);
      }
    });
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

  async function handleTopUp() {
    setTopUpBusy(true);
    setTopUpError(null);

    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount < 100) {
      setTopUpBusy(false);
      setTopUpError("Enter a valid amount of at least ₦100.");
      return;
    }

    const res = await initializeCheckoutApi({
      purpose: "wallet_topup",
      provider: checkoutProvider,
      amount_ngn: amount,
      balanceType: topUpBalanceType,
      return_url: `${window.location.origin}/checkout/result`,
    });

    if (!res.ok || !("payment" in res.data) || !res.data.payment.checkout_url) {
      setTopUpBusy(false);
      setTopUpError("error" in res.data ? res.data.error : "Failed to initialize wallet top-up");
      return;
    }

    window.location.href = res.data.payment.checkout_url;
  }

  const recentLedger = ledger.slice(0, RECENT_LEDGER_LIMIT);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to access your wallet.</p>
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
          <p className="mt-2 text-sm text-av-light-orange">Track vPT, gift-wallet balances, recent ledger activity, and creator wallet readiness.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="vPT Balance" value={`${(vptBalance ?? user?.vpt_balance ?? 0).toLocaleString()} VPT`} variant="orange" />
              <StatCard label="Off-chain vPT" value={`${giftWallet?.vpt?.toLocaleString() ?? 0} vPT`} variant="blue" />
              <StatCard label="Cash (NGN)" value={`₦${giftWallet?.cash?.toLocaleString() ?? 0}`} variant="green" />
              <StatCard label="Ravens" value={`${giftWallet?.coins?.toLocaleString() ?? 0} Ravens`} variant="lightOrange" />
            </div>

            {/* Cash Balance + Withdrawal CTA */}
            <section className="rounded-2xl border border-av-orange/30 bg-gradient-to-r from-av-dark-blue to-av-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-av-light-orange mb-1">Available for Withdrawal</p>
                  <p className="text-3xl font-extrabold text-av-white">
                    ₦{(giftWallet?.cash ?? 0).toLocaleString()}
                    <span className="ml-2 text-sm font-normal text-av-light-orange">NGN</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setTopUpOpen(true);
                      setTopUpError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-av-orange/30 bg-av-orange/10 px-6 py-3 text-sm font-bold text-av-orange transition hover:shadow-lg hover:shadow-av-orange/20 hover:scale-105 active:scale-95 whitespace-nowrap"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Top Up Wallet
                  </button>
                  <Link
                    href="/wallet/convert"
                    className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-6 py-3 text-sm font-bold text-purple-300 transition hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105 active:scale-95 whitespace-nowrap"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Ravens → vPT
                  </Link>
                  <a
                    href="/wallet/withdrawal"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/30 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l1 11H4L5 9z" />
                    </svg>
                    Request Withdrawal
                  </a>
                </div>
              </div>
            </section>

            {/* Stake Wallet Card */}
            {giftWallet?.blockchain_tokens && (
              <StakeWalletCard stakeRaw={giftWallet.blockchain_tokens} />
            )}

            <PortfolioValueCard
              vptBalance={vptBalance ?? user?.vpt_balance ?? 0}
              offChainVpt={giftWallet?.vpt ?? 0}
              cash={giftWallet?.cash ?? 0}
              ravens={giftWallet?.coins ?? 0}
              vptPrice={exchangeRates?.vpt_price_ngn ?? 0}
              ravenNgnRate={exchangeRates?.raven_ngn_rate ?? 0}
            />

            {/* External Wallet Card */}
            <ExternalWalletCard
              connectedWallet={connectedWallet}
              onConnect={async (address, type) => {
                const res = await connectExternalWalletApi(address, type);
                if (res.ok && "connected" in res.data && res.data.connected) {
                  setConnectedWallet(res.data.connected);
                  // Refresh gift wallet to get updated blockchain_tokens
                  const gRes = await getGiftWalletApi();
                  if (gRes.ok && "wallet" in gRes.data) setGiftWallet(gRes.data.wallet);
                  return true;
                }
                return false;
              }}
              onDisconnect={async () => {
                const res = await disconnectExternalWalletApi();
                if (res.ok) setConnectedWallet(null);
              }}
              onImport={async (address) => {
                const res = await importWalletAddressApi(address);
                if (res.ok) {
                  // Refresh gift wallet to get updated blockchain_tokens
                  const gRes = await getGiftWalletApi();
                  if (gRes.ok && "wallet" in gRes.data) setGiftWallet(gRes.data.wallet);
                  return true;
                }
                return false;
              }}
            />

            {referralLedger && (
              <section className="mt-6 rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-sm font-semibold text-av-white">Referral Earnings</h2>
                  <a href="/referrals" className="text-[11px] text-av-orange hover:underline">View referrals →</a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                    <p className="text-[10px] text-av-light-orange uppercase tracking-wider">Pending NGN</p>
                    <p className="mt-1 text-sm font-semibold text-av-light-orange">₦{referralLedger.pending_ngn.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                    <p className="text-[10px] text-av-light-orange uppercase tracking-wider">Off-chain vPT</p>
                    <p className="mt-1 text-sm font-semibold text-av-orange">{referralLedger.pending_vpt_units.toLocaleString()} VPT</p>
                  </div>
                  <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                    <p className="text-[10px] text-av-light-orange uppercase tracking-wider">Credited NGN</p>
                    <p className="mt-1 text-sm font-semibold text-av-success">₦{referralLedger.credited_ngn.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                    <p className="text-[10px] text-av-light-orange uppercase tracking-wider">Credited VPT</p>
                    <p className="mt-1 text-sm font-semibold text-av-success">{referralLedger.credited_vpt_units.toLocaleString()} VPT</p>
                  </div>
                </div>
              </section>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <h2 className="text-sm font-semibold text-av-white">Creator Wallet</h2>
                {creatorWallet ? (
                  <div className="mt-4 space-y-3 text-sm text-av-light-orange">
                    <p>Status: <span className="font-semibold text-av-white">{creatorWallet.status || "active"}</span></p>
                    <p className="break-all">Address: <span className="font-semibold text-av-white">{creatorWallet.bsc_address}</span></p>
                  </div>
                ) : user?.role === "creator" || user?.role === "admin" ? (
                  <div className="mt-4">
                    <p className="text-sm text-av-light-orange">No creator wallet exists yet. Create one to receive on-chain distributions.</p>
                    <button
                      onClick={handleCreateWallet}
                      disabled={creatingWallet}
                      className="mt-4 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                    >
                      {creatingWallet ? "Creating..." : "Create Wallet"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-av-light-orange">Creator wallets are available to creator and admin accounts.</p>
                )}
              </section>

              <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-sm font-semibold text-av-white">Recent Ledger</h2>
                  <Link href="/wallet/transactions" className="text-[11px] text-av-orange hover:underline">
                    View All →
                  </Link>
                </div>

                {recentLedger.length === 0 ? (
                  <p className="mt-4 text-sm text-av-light-orange">No entries found.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {recentLedger.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-av-white">{entry.type.replace(/_/g, " ")}</p>
                            <p className="mt-1 text-[11px] text-av-light-orange">
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

                {ledger.length > RECENT_LEDGER_LIMIT && (
                  <div className="mt-4 text-center">
                    <Link
                      href="/wallet/transactions"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-av-orange hover:text-av-light-orange transition-colors"
                    >
                      View all {ledger.length} transactions →
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <PaymentCheckoutDialog
        open={topUpOpen}
        title="Top up your wallet"
        subtitle="Choose where the credit should go, select your provider, and complete the secure payment."
        providers={providers}
        provider={checkoutProvider}
        onProviderChange={(value) => setCheckoutProvider(value as "paystack" | "flutterwave")}
        onClose={() => {
          if (topUpBusy) return;
          setTopUpOpen(false);
          setTopUpError(null);
        }}
        onConfirm={() => void handleTopUp()}
        confirmLabel="Continue to checkout"
        busy={topUpBusy}
        error={topUpError}
        amountValue={topUpAmount}
        onAmountChange={setTopUpAmount}
        balanceType={topUpBalanceType}
        onBalanceTypeChange={setTopUpBalanceType}
      />
    </main>
    </>
  );
}

type CardVariant = "orange" | "blue" | "green" | "lightOrange";

const variantStyles: Record<CardVariant, string> = {
  orange: "border-orange-500/25 bg-gradient-to-br from-orange-900/18 to-orange-950/8 shadow-orange-900/10",
  blue: "border-blue-400/25 bg-gradient-to-br from-blue-900/12 to-blue-950/4 shadow-blue-900/10",
  green: "border-green-500/25 bg-gradient-to-br from-green-900/12 to-green-950/4 shadow-green-900/10",
  lightOrange: "border-amber-400/25 bg-gradient-to-br from-amber-900/12 to-amber-950/4 shadow-amber-900/10",
};

const variantLabel: Record<CardVariant, string> = {
  orange: "text-orange-400",
  blue: "text-blue-400",
  green: "text-green-400",
  lightOrange: "text-amber-400",
};

function StatCard({ label, value, variant = "orange" }: { label: string; value: string; variant?: CardVariant }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-lg ${variantStyles[variant]}`}>
      <p className={`text-[11px] uppercase tracking-wider ${variantLabel[variant]}`}>{label}</p>
      <p className="mt-2 text-xl font-semibold text-av-white">{value}</p>
    </div>
  );
}

// ─── Stake Wallet Card ──────────────────────────────────────

const TOTAL_MINTED_VPT = 400_000_000; // 400 million vPT

function formatStakeBalance(raw: string): string {
  if (!raw || raw === "0") return "0";
  try {
    return Number(raw).toLocaleString();
  } catch {
    return "0";
  }
}

function stakeEquityPercent(raw: string): number {
  try {
    const vpt = Number(raw);
    if (!vpt || vpt <= 0) return 0;
    return (vpt / TOTAL_MINTED_VPT) * 100;
  } catch {
    return 0;
  }
}

function StakeWalletCard({ stakeRaw }: { stakeRaw: string }) {
  const formatted = formatStakeBalance(stakeRaw);
  const equity = stakeEquityPercent(stakeRaw);
  const equityStr = equity >= 0.01
    ? equity.toFixed(2)
    : equity > 0 ? equity.toFixed(6) : "0";
  const barWidth = Math.min((equity / 100) * 100, 100);

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-purple-950/10 p-6 shadow-lg shadow-purple-900/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-700/20">
            <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-purple-400">Stake Wallet</p>
            <p className="mt-0.5 text-sm text-purple-200/70">Token Equity Position</p>
          </div>
        </div>
        <span className="rounded-md border border-purple-500/30 bg-purple-800/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
          On-Chain
        </span>
      </div>

      {/* Balance */}
      <div className="mt-5">
        <p className="text-2xl font-extrabold tracking-tight text-purple-100">{formatted}</p>
        <p className="mt-0.5 text-xs text-purple-400">vPT tokens staked</p>
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-purple-900/50">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-700"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Equity row */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400">Equity Share</p>
          <p className="mt-1 text-3xl font-extrabold text-purple-100">{equityStr}<span className="ml-1 text-base font-semibold text-purple-400">%</span></p>
          <p className="mt-0.5 text-xs text-purple-300/70">of 400M total minted vPT</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400">Total Minted</p>
          <p className="mt-1 text-lg font-bold text-purple-100">400,000,000</p>
          <p className="text-xs text-purple-400">vPT</p>
        </div>
      </div>

      {/* Info footnote */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-purple-700/25 bg-purple-950/40 px-3 py-2.5">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[11px] text-purple-300/80 leading-relaxed">
          Stake wallet represents your proportional equity in the entire vPT ecosystem against the 400M total supply.
        </p>
      </div>
    </div>
  );
}

// ─── Portfolio Value Card ───────────────────────────────────

function PortfolioValueCard({
  vptBalance,
  offChainVpt,
  cash,
  ravens,
  vptPrice,
  ravenNgnRate,
}: {
  vptBalance: number;
  offChainVpt: number;
  cash: number;
  ravens: number;
  vptPrice: number;
  ravenNgnRate: number;
}) {
  const totalVpt = vptBalance + offChainVpt;
  const vptValue = totalVpt * vptPrice;
  const ravensValue = ravens * ravenNgnRate;
  const portfolioTotal = vptValue + cash + ravensValue;

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#E8890C] via-av-orange to-av-light-orange p-5 shadow-lg shadow-av-orange/25">
      <div className="flex items-center justify-center gap-2">
        <svg className="h-5 w-5 text-[#2D1600]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-base font-extrabold text-[#2D1600] tracking-wide">
          Off-Chain Portfolio Value ≈ ₦{fmt(portfolioTotal)}
        </p>
      </div>
      <p className="mt-1.5 text-center text-[11px] italic text-[#2D1600]/70">
        vPT ({fmt(totalVpt)} × ₦{fmt(vptPrice)} = ₦{fmt(vptValue)})
        {" • "}Ravens ({fmt(ravens)} × ₦{fmt(ravenNgnRate)} = ₦{fmt(ravensValue)})
        {" • "}Cash (₦{fmt(cash)})
      </p>
    </div>
  );
}

// ─── External Wallet Card ───────────────────────────────────

function ExternalWalletCard({
  connectedWallet,
  onConnect,
  onDisconnect,
  onImport,
}: {
  connectedWallet: ConnectedWallet | null;
  onConnect: (address: string, type: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onImport: (address: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"idle" | "manual" | "import">("idle");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasConnection = connectedWallet?.address ? true : false;

  const walletTypeLabel = (t: string) => {
    const map: Record<string, string> = { metamask: "MetaMask", trust: "Trust Wallet", manual: "Manual" };
    return map[t] ?? t;
  };

  // ── Exactly the same approach as Navbar's handleInjectedWalletLogin ──
  // Detect window.ethereum, call eth_requestAccounts to open MetaMask popup,
  // get the user's approved address, then save it via the backend API.
  const connectWalletViaExtension = async () => {
    if (typeof window === "undefined") {
      setError("Wallet connection is not available in this environment.");
      return;
    }

    const injected = (window as typeof window & {
      ethereum?: { request: (args: { method: string }) => Promise<unknown> };
    }).ethereum;

    if (!injected) {
      setError("No browser wallet detected. Install MetaMask or Trust Wallet extension and refresh the page. Or use Manual Entry below.");
      setMode("manual");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // This opens the MetaMask (or Trust Wallet) popup and asks the user to approve the connection
      const result = await injected.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(result) ? result : [];
      const detected = typeof accounts[0] === "string" ? accounts[0] : "";

      if (!detected) {
        setError("No wallet account was returned by your wallet app. Please unlock your wallet and try again.");
        setBusy(false);
        return;
      }

      // Determine wallet type from the provider
      const walletType = (injected as unknown as { isMetaMask?: boolean }).isMetaMask ? "metamask" : "trust";

      // Send the detected address to the backend to link it
      const ok = await onConnect(detected, walletType);
      if (ok) {
        setMode("idle");
        setAddress("");
        setError(null);
      } else {
        setError("Failed to connect wallet to your account.");
      }
    } catch {
      setError("Wallet connection was cancelled or rejected. Try again or use Manual Entry below.");
    } finally {
      setBusy(false);
    }
  };

  const handleManualConnect = async () => {
    if (!address.trim()) return setError("Enter a BSC wallet address");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) return setError("Invalid BSC address format");
    setBusy(true);
    setError(null);
    const ok = await onConnect(address.trim(), "manual");
    setBusy(false);
    if (ok) { setMode("idle"); setAddress(""); }
    else setError("Failed to connect wallet");
  };

  const handleImport = async () => {
    if (!address.trim()) return setError("Enter a BSC wallet address");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) return setError("Invalid BSC address format");
    setBusy(true);
    setError(null);
    const ok = await onImport(address.trim());
    setBusy(false);
    if (ok) { setMode("idle"); setAddress(""); }
    else setError("Failed to import wallet");
  };

  const handleCopy = () => {
    if (!connectedWallet?.address) return;
    navigator.clipboard.writeText(connectedWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-2xl border p-5 ${hasConnection ? "border-av-success/30 bg-av-card" : "border-av-input-border/30 bg-av-card"}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasConnection ? "bg-av-success/12" : "bg-av-orange/12"}`}>
            <svg className={`h-5 w-5 ${hasConnection ? "text-av-success" : "text-av-orange"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={hasConnection ? "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"} />
              {hasConnection && <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />}
            </svg>
          </div>
          <p className="text-sm font-bold text-av-white">External Wallet</p>
        </div>
        {hasConnection && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-av-success/30 bg-av-success/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-av-success">
            <span className="h-1.5 w-1.5 rounded-full bg-av-success" />
            {walletTypeLabel(connectedWallet!.type)}
          </span>
        )}
      </div>

      {hasConnection ? (
        <>
          {/* Connected address */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-av-input-border/20 bg-av-input-fill px-3 py-2.5">
            <p className="flex-1 truncate font-mono text-[11px] font-semibold text-av-gold tracking-wide">
              {connectedWallet!.address}
            </p>
            <button onClick={handleCopy} className="shrink-0 text-av-orange hover:text-av-light-orange transition-colors">
              {copied ? (
                <svg className="h-4 w-4 text-av-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>

          {/* Balances */}
          {connectedWallet!.balances && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-av-input-border/20 bg-av-input-fill/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-av-hint">BNB</p>
                <p className="text-sm font-bold text-av-white">{Number(connectedWallet!.balances!.bnb_balance).toFixed(6)}</p>
              </div>
              <div className="rounded-lg border border-av-input-border/20 bg-av-input-fill/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-av-hint">vPT</p>
                <p className="text-sm font-bold text-av-white">{Number(connectedWallet!.balances!.vpt_balance).toLocaleString()} vPT</p>
              </div>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={onDisconnect}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-av-error/30 bg-av-error/8 py-2.5 text-xs font-semibold text-av-error transition hover:bg-av-error/15"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
            Disconnect Wallet
          </button>
        </>
      ) : mode === "idle" ? (
        <>
          {/* Connect Wallet — immediately opens MetaMask popup (same as Navbar) */}
          <div className="mt-4 space-y-3">
            <button
              onClick={connectWalletViaExtension}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange py-3.5 text-sm font-bold text-av-dark-blue transition hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              {busy ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-av-dark-blue border-t-transparent" />
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" /></svg>
              )}
              {busy ? "Opening Wallet..." : "Connect Wallet"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode("manual"); setError(null); setAddress(""); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-av-input-border/25 bg-av-input-fill/15 py-2.5 text-xs font-semibold text-av-hint transition hover:text-av-white hover:border-av-input-border/40"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Manual Entry
              </button>
              <button
                onClick={() => { setMode("import"); setError(null); setAddress(""); }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/8 py-2.5 text-xs font-semibold text-purple-300 transition hover:border-purple-500/40 hover:bg-purple-500/12"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Import Address
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-av-error/20 bg-av-error/8 px-3 py-2.5">
                <p className="text-[11px] text-av-error leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-av-input-border/15 bg-av-input-fill/20 px-3 py-2">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-av-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-[11px] text-av-hint leading-relaxed">
                Click Connect Wallet to open your MetaMask or Trust Wallet extension directly. Use Manual Entry to paste an address, or Import to scan a balance.
              </p>
            </div>
          </div>
        </>
      ) : mode === "manual" ? (
        <>
          {/* Manual address entry fallback */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => { setMode("idle"); setError(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-av-input-fill hover:bg-av-input-fill/80 transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-av-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <p className="text-sm font-bold text-av-white">Manual Wallet Entry</p>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... BSC wallet address"
              className="w-full rounded-lg border border-av-input-border bg-av-input-fill px-4 py-3 font-mono text-sm text-av-white placeholder:text-av-hint focus:border-av-orange focus:outline-none focus:ring-1 focus:ring-av-orange/30"
              autoFocus
            />
            {error && <p className="text-xs text-av-error">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleManualConnect}
                disabled={busy}
                className="flex-1 rounded-lg bg-gradient-to-r from-av-orange to-av-light-orange py-2.5 text-sm font-bold text-av-dark-blue transition hover:shadow-lg hover:shadow-av-orange/25 disabled:opacity-50"
              >
                {busy ? "Connecting..." : "Connect"}
              </button>
              <button
                onClick={() => { setMode("idle"); setError(null); }}
                className="rounded-lg border border-av-input-border px-4 py-2.5 text-sm text-av-hint transition hover:text-av-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Import address form */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => { setMode("idle"); setError(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-av-input-fill hover:bg-av-input-fill/80 transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-av-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <p className="text-sm font-bold text-av-white">Import Address</p>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... BSC wallet address"
              className="w-full rounded-lg border border-av-input-border bg-av-input-fill px-4 py-3 font-mono text-sm text-av-white placeholder:text-av-hint focus:border-av-orange focus:outline-none focus:ring-1 focus:ring-av-orange/30"
              autoFocus
            />
            {error && <p className="text-xs text-av-error">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={busy}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-purple-400 py-2.5 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50"
              >
                {busy ? "Processing..." : "Import & Scan"}
              </button>
              <button
                onClick={() => { setMode("idle"); setError(null); }}
                className="rounded-lg border border-av-input-border px-4 py-2.5 text-sm text-av-hint transition hover:text-av-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}