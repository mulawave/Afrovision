"use client";

function formatNgn(n: number | string | null | undefined) {
  return `₦${(Number(n) || 0).toLocaleString("en-NG")}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_STYLES: Record<string, string> = {
  activation_revenue: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  license_fee: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  payment: "border-amber-400/30 bg-amber-500/10 text-amber-300",
};

const TYPE_LABELS: Record<string, string> = {
  activation_revenue: "Activation Revenue",
  license_fee: "License Fee",
  payment: "Payment",
};

export default function FinancialsTab({ financials, ledger }: { financials: any; ledger: any[] }) {
  const f = financials || {};

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-av-white">Financial Overview</h2>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
          <p className="text-xs uppercase tracking-wider text-av-light-orange/70">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-av-white">{formatNgn(f.total_revenue_ngn)}</p>
          <p className="mt-1 text-xs text-av-light-orange/60">{f.activations || 0} activations</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/30 bg-av-card p-5">
          <p className="text-xs uppercase tracking-wider text-av-light-orange/70">Your Share</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{formatNgn(f.distributor_share_ngn)}</p>
        </div>
        <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-5">
          <p className="text-xs uppercase tracking-wider text-av-light-orange/70">AfroVision Share</p>
          <p className="mt-2 text-2xl font-bold text-av-white">{formatNgn(f.afrovision_share_ngn)}</p>
        </div>
        <div className={`rounded-2xl border bg-av-card p-5 ${f.remittance_due_ngn > 0 ? "border-red-400/30" : "border-emerald-400/30"}`}>
          <p className="text-xs uppercase tracking-wider text-av-light-orange/70">Remittance Due</p>
          <p className={`mt-2 text-2xl font-bold ${f.remittance_due_ngn > 0 ? "text-red-300" : "text-emerald-300"}`}>{formatNgn(f.remittance_due_ngn)}</p>
          <p className="mt-1 text-xs text-av-light-orange/60">Paid: {formatNgn(f.payments_received_ngn)}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-av-light-orange mb-4">Transaction Ledger ({ledger.length})</h3>

        {ledger.length === 0 ? (
          <p className="text-sm text-av-light-orange/60">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-av-input-border/30 text-left">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Date</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Type</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Amount</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Your Share</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">AfroVision</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Code</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => (
                  <tr key={i} className="border-b border-av-input-border/20 last:border-0 hover:bg-av-input-fill/30">
                    <td className="px-3 py-2 text-xs text-av-light-orange/70">{formatDate(e.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[e.type] || "border-av-input-border/40 bg-av-card text-av-light-orange"}`}>
                        {TYPE_LABELS[e.type] || e.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-av-white">{formatNgn(e.amount_ngn)}</td>
                    <td className="px-3 py-2 font-mono text-emerald-300">{e.distributor_share_ngn != null ? formatNgn(e.distributor_share_ngn) : "—"}</td>
                    <td className="px-3 py-2 font-mono text-av-white/70">{e.afrovision_share_ngn != null ? formatNgn(e.afrovision_share_ngn) : "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-av-light-orange/60">{e.code || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
