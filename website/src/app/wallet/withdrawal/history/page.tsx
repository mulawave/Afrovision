"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getMyWithdrawalsApi,
  type Withdrawal,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE = 10;

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: Withdrawal["status"] }) {
  const classes: Record<Withdrawal["status"], string> = {
    pending: "bg-av-light-orange/15 text-av-light-orange border border-av-light-orange/30",
    approved: "bg-av-success/15 text-av-success border border-av-success/30",
    rejected: "bg-av-error/15 text-av-error border border-av-error/30",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${classes[status]}`}>
      {status}
    </span>
  );
}

export default function WithdrawalHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | Withdrawal["status"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyWithdrawalsApi();
      if (res.ok && "withdrawals" in res.data) setWithdrawals(res.data.withdrawals);
    } catch {
      setError("Failed to load withdrawal history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
  }, [isAuthenticated, load]);

  const filtered = filter === "all" ? withdrawals : withdrawals.filter((w) => w.status === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const counts = {
    all: withdrawals.length,
    pending: withdrawals.filter((w) => w.status === "pending").length,
    approved: withdrawals.filter((w) => w.status === "approved").length,
    rejected: withdrawals.filter((w) => w.status === "rejected").length,
  };

  const totalPending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + w.amount, 0);

  const totalApproved = withdrawals
    .filter((w) => w.status === "approved")
    .reduce((sum, w) => sum + w.amount, 0);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to view withdrawal history.</p>
          <Link href="/login?redirect=/wallet/withdrawal/history" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Withdrawal History — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/wallet" className="text-xs text-av-light-orange hover:text-av-light-orange transition-colors">
                Wallet
              </Link>
              <span className="text-av-light-orange text-xs">/</span>
              <Link href="/wallet/withdrawal" className="text-xs text-av-light-orange hover:text-av-light-orange transition-colors">
                Withdrawals
              </Link>
              <span className="text-av-light-orange text-xs">/</span>
              <span className="text-xs text-av-light-orange">History</span>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Finance</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Withdrawal History</h1>
            <p className="mt-2 text-sm text-av-light-orange">Track all your withdrawal requests and their statuses.</p>
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

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-av-input-border/30 bg-av-card p-4">
                  <p className="text-[10px] uppercase tracking-wider text-av-light-orange mb-1">Total Withdrawn</p>
                  <p className="text-lg font-bold text-av-success">₦{totalApproved.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-av-input-border/30 bg-av-card p-4">
                  <p className="text-[10px] uppercase tracking-wider text-av-light-orange mb-1">Pending</p>
                  <p className="text-lg font-bold text-av-light-orange">₦{totalPending.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-av-input-border/30 bg-av-card p-4">
                  <p className="text-[10px] uppercase tracking-wider text-av-light-orange mb-1">Requests</p>
                  <p className="text-lg font-bold text-av-white">{withdrawals.length}</p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 flex-wrap">
                {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setPage(0); }}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      filter === f
                        ? "bg-av-orange text-av-dark-blue"
                        : "border border-av-input-border/40 text-av-light-orange hover:border-av-orange/40"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                  </button>
                ))}
              </div>

              {/* Records */}
              <section className="rounded-2xl border border-av-input-border/30 bg-av-card overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="p-10 text-center">
                    <svg className="mx-auto h-10 w-10 text-av-input-border/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-av-light-orange">
                      {filter === "all" ? "No withdrawal requests yet." : `No ${filter} withdrawals.`}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-av-input-border/20">
                      {paginated.map((w) => (
                        <div key={w.id} className="flex items-center gap-4 px-6 py-4 hover:bg-av-input-fill/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-av-white">
                                ₦{w.amount.toLocaleString()}
                              </p>
                              <StatusBadge status={w.status} />
                            </div>
                            {(w.total_fees > 0) && (
                              <p className="mt-0.5 text-[10px] text-av-light-orange">
                                Fees: ₦{w.total_fees.toLocaleString()} · VAT: ₦{(w.vat_amount || 0).toLocaleString()} · Total debited: ₦{w.total_debit.toLocaleString()}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-av-light-orange">{fmtDate(w.created_at)}</p>
                            {w.bank_details && (
                              <p className="mt-0.5 text-xs text-av-light-orange">
                                {w.bank_details.bank_name} · {w.bank_details.account_number}
                              </p>
                            )}
                          </div>
                          {w.status === "approved" && w.processed_at && (
                            <p className="text-xs text-av-success whitespace-nowrap">
                              Approved {fmtDate(w.processed_at)}
                            </p>
                          )}
                          {w.status === "rejected" && w.processed_at && (
                            <p className="text-xs text-av-error whitespace-nowrap">
                              Rejected {fmtDate(w.processed_at)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {pageCount > 1 && (
                      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-av-input-border/20">
                        <button
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                          className="rounded-lg border border-av-input-border/40 px-3 py-1.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 disabled:opacity-40 transition-colors"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-av-light-orange">
                          {page + 1} / {pageCount}
                        </span>
                        <button
                          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                          disabled={page === pageCount - 1}
                          className="rounded-lg border border-av-input-border/40 px-3 py-1.5 text-xs font-semibold text-av-light-orange hover:border-av-orange/40 disabled:opacity-40 transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Action */}
              <div className="text-center">
                <Link
                  href="/wallet/withdrawal"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
                >
                  ← Request a Withdrawal
                </Link>
              </div>

            </div>
          )}
        </div>
      </main>
    </>
  );
}
