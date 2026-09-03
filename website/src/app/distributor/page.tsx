"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useDistributorAuth, distApi } from "@/lib/DistributorAuthContext";
import MarketersTab from "./MarketersTab";
import CodesTab from "./CodesTab";
import DevicesTab from "./DevicesTab";
import FinancialsTab from "./FinancialsTab";

function formatNgn(n: number | string | null | undefined) {
  return `₦${(Number(n) || 0).toLocaleString("en-NG")}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(d: string | null | undefined) {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300",
  disabled: "bg-red-500/10 border-red-400/30 text-red-300",
  frozen: "bg-sky-500/10 border-sky-400/30 text-sky-300",
  banned: "bg-red-500/10 border-red-400/30 text-red-300",
  used: "bg-av-orange/10 border-av-orange/30 text-av-light-orange",
  unused: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || "border-av-input-border/40 bg-av-card text-av-light-orange"}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  const c = tone === "green" ? "border-emerald-400/30" : tone === "red" ? "border-red-400/30" : "border-av-input-border/30";
  const tc = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-av-white";
  return (
    <div className={`rounded-2xl border ${c} bg-av-card p-5`}>
      <p className="text-xs uppercase tracking-wider text-av-light-orange/70">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tc}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-av-light-orange/60">{sub}</p>}
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-av-input-fill/50 px-4 py-3">
      <label className="mb-1 block text-xs text-av-light-orange/60">{label}</label>
      <p className={`text-sm font-semibold ${highlight ? "text-av-orange" : "text-av-white"}`}>{value}</p>
    </div>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const { distributor, isAuthenticated, isLoading } = useDistributorAuth();
  const [tab, setTab] = useState("overview");
  const [me, setMe] = useState<any>(null);
  const [marketers, setMarketers] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: string; message: string } | null>(null);

  useEffect(() => { setTab(searchParams.get("tab") || "overview"); }, [searchParams]);

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [meRes, mkRes, codeRes, devRes, finRes] = await Promise.all([
        distApi("/distribution/distributor/me"),
        distApi("/distribution/distributor/marketers"),
        distApi("/distribution/distributor/codes"),
        distApi("/distribution/distributor/devices"),
        distApi("/distribution/distributor/financials"),
      ]);
      if (meRes.ok) setMe(meRes.data);
      if (mkRes.ok) { const d = mkRes.data as any; if (d.marketers) setMarketers(d.marketers); }
      if (codeRes.ok) { const d = codeRes.data as any; if (d.codes) setCodes(d.codes); }
      if (devRes.ok) { const d = devRes.data as any; if (d.devices) setDevices(d.devices); }
      if (finRes.ok) { const d = finRes.data as any; setFinancials(d.financials); setLedger(d.ledger || []); }
      setError(null);
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function showFeedback(tone: string, message: string) {
    setFeedback({ tone, message });
    setTimeout(() => setFeedback(null), 4000);
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  const dist = me?.distributor || distributor;
  const stats = me?.stats || {};
  const fin = financials || {};
  const licenseValid = stats.license_valid ?? false;
  const quotaRemaining = stats.quota_remaining ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-av-white">{dist?.company_name}</h1>
          <p className="text-sm text-av-light-orange mt-1">
            {dist?.contact_name && `${dist.contact_name} · `}{dist?.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[dist?.status] || STATUS_STYLES.active}`}>
            {dist?.status || "active"}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${licenseValid ? STATUS_STYLES.active : STATUS_STYLES.disabled}`}>
            License {licenseValid ? "Valid" : "Expired"}
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.tone === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
          {feedback.message}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          <button onClick={loadAll} className="ml-3 underline">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Quota Used" value={`${stats.quota_used || 0} / ${stats.quota_total || 0}`} sub={`${quotaRemaining} remaining`} />
                <StatCard label="Marketers" value={stats.marketer_count || 0} sub={`${stats.active_marketers || 0} active`} />
                <StatCard label="Devices" value={stats.device_count || 0} sub={`${stats.active_devices || 0} active`} />
                <StatCard label="License Expires" value={formatDate(stats.license_expires_at)} sub={licenseValid ? "Valid" : "Expired"} tone={licenseValid ? "green" : "red"} />
              </div>

              <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-av-light-orange mb-4">License & Quota</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="License Fee Paid" value={formatNgn(dist?.license_fee_ngn)} />
                  <InfoField label="License Expires" value={formatDate(dist?.license_expires_at)} />
                  <InfoField label="Quota Remaining" value={quotaRemaining} highlight={quotaRemaining < 10} />
                  <InfoField label="Revenue Split (You)" value={`${100 - (me?.settings?.split_percent || 40)}%`} />
                  <InfoField label="Revenue Split (AfroVision)" value={`${me?.settings?.split_percent || 40}%`} />
                  <InfoField label="Activation Price" value={formatNgn(me?.settings?.activation_price_ngn)} />
                </div>
              </div>

              <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-av-light-orange mb-4">Financial Summary</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Total Revenue" value={formatNgn(fin.total_revenue_ngn)} />
                  <StatCard label="Your Share" value={formatNgn(fin.distributor_share_ngn)} tone="green" />
                  <StatCard label="AfroVision Share" value={formatNgn(fin.afrovision_share_ngn)} />
                  <StatCard label="Remittance Due" value={formatNgn(fin.remittance_due_ngn)} tone={fin.remittance_due_ngn > 0 ? "red" : "green"} />
                </div>
              </div>

              <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-av-light-orange mb-4">Recent Devices</h3>
                {devices.length === 0 ? (
                  <p className="text-sm text-av-light-orange/60">No devices activated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {devices.slice(0, 5).map((d: any) => (
                      <div key={d.device_id} className="flex items-center justify-between rounded-xl bg-av-input-fill/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-av-white">{d.owner_name || "Unknown"}</p>
                          <p className="text-xs text-av-light-orange/60">{d.device_name || d.device_id}</p>
                        </div>
                        <div className="text-right">
                          <StatusPill status={d.status} />
                          <p className="text-xs text-av-light-orange/60 mt-1">{timeAgo(d.activated_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "marketers" && (
            <MarketersTab marketers={marketers} onFeedback={showFeedback} onRefresh={loadAll} />
          )}
          {tab === "codes" && <CodesTab codes={codes} />}
          {tab === "devices" && <DevicesTab devices={devices} onFeedback={showFeedback} />}
          {tab === "financials" && <FinancialsTab financials={fin} ledger={ledger} />}
        </>
      )}
    </div>
  );
}

export default function DistributorDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-av-orange border-t-transparent animate-spin" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}
