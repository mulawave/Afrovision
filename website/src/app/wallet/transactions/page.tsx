"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLedgerApi, type LedgerEntry } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type LedgerFilter = "all" | "payments" | "rewards" | "splits";
const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

function filterLedger(entries: LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  if (filter === "all") return entries;
  return entries.filter((entry) => {
    const t = entry.type.toLowerCase();
    if (filter === "payments") return t.includes("payment") || t.includes("checkout") || t.includes("topup") || t.includes("top_up");
    if (filter === "rewards") return t.includes("reward") || t.includes("bonus") || t.includes("earning") || t.includes("referral");
    if (filter === "splits") return t.includes("split") || t.includes("distribution") || t.includes("payout");
    return true;
  });
}

export default function TransactionsPage() {
  const { isAuthenticated } = useAuth();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState<number>(10);

  useEffect(() => {
    if (!isAuthenticated) return;
    getLedgerApi().then((res) => {
      if (res.ok && "ledger" in res.data) {
        setLedger(res.data.ledger);
      }
      setLoading(false);
    });
  }, [isAuthenticated]);

  const filtered = filterLedger(ledger, filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  // Reset to first page when filter or perPage changes
  function handleFilterChange(f: LedgerFilter) {
    setFilter(f);
    setPage(0);
  }
  function handlePerPageChange(n: number) {
    setPerPage(n);
    setPage(0);
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to view your transactions.</p>
          <Link href="/login?redirect=/wallet/transactions" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Transaction History — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/wallet" className="text-xs text-av-orange hover:underline">← Back to Wallet</Link>
            <p className="mt-3 text-xs uppercase tracking-[0.3em] text-av-light-orange">Finance</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Transaction History</h1>
            <p className="mt-2 text-sm text-av-light-orange">Full ledger of all your wallet activity.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "payments", "rewards", "splits"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => handleFilterChange(f)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                        filter === f
                          ? "bg-av-orange/20 text-av-orange border border-av-orange/40"
                          : "bg-av-input-fill/30 text-av-light-orange border border-av-input-border/20 hover:border-av-orange/30"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Per-page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-av-light-orange">Show</span>
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(Number(e.target.value))}
                    className="rounded-lg border border-av-input-border/30 bg-av-input-fill/30 px-2.5 py-1.5 text-[11px] font-semibold text-av-white focus:border-av-orange/50 focus:outline-none"
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-av-light-orange">per page</span>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-4 text-[11px] text-av-light-orange">
                {filtered.length} {filter === "all" ? "" : filter + " "}transaction{filtered.length !== 1 ? "s" : ""}
                {filter !== "all" && ` (${ledger.length} total)`}
              </div>

              {/* Table */}
              {paged.length === 0 ? (
                <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-12 text-center">
                  <p className="text-sm text-av-light-orange">No {filter === "all" ? "" : filter + " "}transactions found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paged.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-av-input-border/20 bg-av-card px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${entry.direction === "credit" ? "bg-green-400" : "bg-red-400"}`} />
                            <p className="text-sm font-semibold text-av-white truncate">{entry.type.replace(/_/g, " ")}</p>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-av-light-orange">
                            <span>{new Date(entry.created_at).toLocaleString()}</span>
                            {entry.status && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                entry.status === "completed" || entry.status === "credited"
                                  ? "bg-green-900/30 text-green-400 border border-green-500/20"
                                  : entry.status === "pending"
                                  ? "bg-yellow-900/30 text-yellow-400 border border-yellow-500/20"
                                  : "bg-av-input-fill/30 text-av-light-orange border border-av-input-border/20"
                              }`}>
                                {entry.status}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold uppercase ${entry.direction === "credit" ? "text-green-400" : "text-red-400"}`}>
                              {entry.direction}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {entry.amount_ngn != null && entry.amount_ngn !== 0 && (
                            <p className="text-sm font-semibold text-av-light-orange">
                              {entry.direction === "credit" ? "+" : "−"}₦{Math.abs(entry.amount_ngn).toLocaleString()}
                            </p>
                          )}
                          {entry.amount_vpt_units != null && entry.amount_vpt_units !== 0 && (
                            <p className="text-sm font-semibold text-av-orange">
                              {entry.direction === "credit" ? "+" : "−"}{Math.abs(entry.amount_vpt_units).toLocaleString()} vPT
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg border border-av-input-border/30 bg-av-input-fill/30 px-4 py-2 text-xs font-semibold text-av-light-orange disabled:opacity-30 hover:border-av-orange/30 transition-colors"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (page < 4) {
                        pageNum = i;
                      } else if (page >= totalPages - 4) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`min-w-[32px] rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            page === pageNum
                              ? "bg-av-orange/20 text-av-orange border border-av-orange/40"
                              : "text-av-light-orange hover:text-av-white"
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded-lg border border-av-input-border/30 bg-av-input-fill/30 px-4 py-2 text-xs font-semibold text-av-light-orange disabled:opacity-30 hover:border-av-orange/30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
