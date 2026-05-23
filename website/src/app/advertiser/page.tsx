"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyAdsApi,
  getAdStatsApi,
  submitAdApi,
  topUpAdBudgetApi,
  pauseAdApi,
  getAdUploadUrlApi,
  uploadFileToGCS,
  getMyAdAnalyticsApi,
  type Advertisement,
  type AdStats,
  type AdvertiserAnalytics,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const CATEGORIES = [
  { key: "banner_home", label: "Banner — Home Page", type: "image" },
  { key: "banner_page", label: "Banner — Page", type: "image" },
  { key: "in_stream_pre", label: "Pre-Roll (≤30s)", type: "video" },
  { key: "in_stream_mid", label: "Mid-Roll (≤60s)", type: "video" },
  { key: "in_stream_brief", label: "Brief/Bumper (≤15s)", type: "video" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  active: "bg-green-500/15 text-green-300 border-green-500/30",
  paused: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  expired: "bg-white/8 text-av-light-orange border-white/10",
  depleted: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export default function AdvertiserPage() {
  const { isAuthenticated } = useAuth();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"list" | "create" | "analytics">("list");
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Form state
  const [formCategory, setFormCategory] = useState("banner_home");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formClickUrl, setFormClickUrl] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formPricePerImpression, setFormPricePerImpression] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Top-up state
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSaving, setTopUpSaving] = useState(false);

  const loadAds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyAdsApi();
      if (!res.ok || "error" in res.data) throw new Error("error" in res.data ? String(res.data.error) : "Failed");
      setAds(res.data as Advertisement[]);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load ads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadAds();
  }, [isAuthenticated, loadAds]);

  async function loadStats(adId: string) {
    setStatsLoading(true);
    try {
      const res = await getAdStatsApi(adId);
      if (!res.ok || "error" in res.data) throw new Error("Failed");
      setStats((res.data as { ad: Advertisement; stats: AdStats }).stats);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  function selectAd(ad: Advertisement) {
    if (selectedAd?.id === ad.id) {
      setSelectedAd(null);
      setStats(null);
    } else {
      setSelectedAd(ad);
      loadStats(ad.id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!formTitle.trim()) { setSubmitError("Title is required"); return; }
    if (!formFile) { setSubmitError("Media file is required"); return; }
    if (!formBudget || Number(formBudget) <= 0) { setSubmitError("Budget must be > 0"); return; }
    if (!formPricePerImpression || Number(formPricePerImpression) <= 0) { setSubmitError("Price per impression must be > 0"); return; }

    setSubmitting(true);
    try {
      // Upload media
      setUploadProgress("Getting upload URL...");
      const uploadRes = await getAdUploadUrlApi(formFile.type, formFile.name);
      if (!uploadRes.ok || "error" in uploadRes.data) throw new Error("error" in uploadRes.data ? String(uploadRes.data.error) : "Upload URL failed");
      const { signed_url, public_url } = uploadRes.data as { signed_url: string; public_url: string };

      setUploadProgress("Uploading media...");
      await uploadFileToGCS(signed_url, formFile);

      setUploadProgress("Submitting ad...");
      const catInfo = CATEGORIES.find((c) => c.key === formCategory);
      const isVideo = catInfo?.type === "video";

      // Detect video duration
      let duration = 0;
      if (isVideo) {
        duration = await getVideoDuration(formFile);
      }

      const adRes = await submitAdApi({
        category: formCategory,
        title: formTitle.trim(),
        description: formDescription.trim(),
        media_url: public_url,
        click_url: formClickUrl.trim() || undefined,
        duration,
        budget: Number(formBudget),
        price_per_impression: Number(formPricePerImpression),
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
      });

      if (!adRes.ok || "error" in adRes.data) throw new Error("error" in adRes.data ? String(adRes.data.error) : "Submission failed");

      setSubmitSuccess(true);
      setUploadProgress(null);
      // Reset form
      setFormTitle("");
      setFormDescription("");
      setFormClickUrl("");
      setFormBudget("");
      setFormPricePerImpression("");
      setFormStartDate("");
      setFormEndDate("");
      setFormFile(null);
      if (fileRef.current) fileRef.current.value = "";
      // Reload and switch to list
      await loadAds();
      setTimeout(() => setTab("list"), 1500);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTopUp() {
    if (!topUpId || !topUpAmount || Number(topUpAmount) <= 0) return;
    setTopUpSaving(true);
    try {
      const res = await topUpAdBudgetApi(topUpId, Number(topUpAmount));
      if (!res.ok || "error" in res.data) throw new Error("Top up failed");
      await loadAds();
      setTopUpId(null);
      setTopUpAmount("");
    } catch {
      // handled
    } finally {
      setTopUpSaving(false);
    }
  }

  async function handlePause(adId: string) {
    try {
      await pauseAdApi(adId);
      await loadAds();
    } catch {
      // handled
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto mt-32 max-w-md text-center">
        <h1 className="text-2xl font-bold text-white">Advertiser Portal</h1>
        <p className="mt-4 text-av-light-orange">Please log in to manage your advertisements.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Advertiser Portal</h1>
        <p className="mt-2 text-sm text-av-light-orange">
          Submit ads, track performance, and manage your advertising campaigns on AfroVision.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        {([
          { key: "list" as const, label: "My Ads" },
          { key: "create" as const, label: "Submit New Ad" },
          { key: "analytics" as const, label: "Analytics" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedAd(null); setStats(null); }}
            className={`rounded-2xl border px-5 py-2.5 text-sm font-semibold transition-all ${
              tab === t.key
                ? "border-[#F49617]/50 bg-gradient-to-r from-[#F49617]/20 to-[#F5C16C]/10 text-white shadow-lg shadow-[#F49617]/10"
                : "border-white/10 bg-white/5 text-av-light-orange hover:bg-white/10 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-semibold text-white">Submit New Advertisement</h2>

          {submitSuccess && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              Ad submitted successfully! It will be reviewed by our team.
            </div>
          )}
          {submitError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {submitError}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Category</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setFormCategory(cat.key); setFormFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    formCategory === cat.key
                      ? "border-[#F49617]/50 bg-[#F49617]/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-av-light-orange hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="font-semibold">{cat.label}</span>
                  <span className="block mt-0.5 text-[10px] uppercase tracking-wider text-av-light-orange">{cat.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title + Description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ad campaign title"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Click URL</label>
              <input
                type="url"
                value={formClickUrl}
                onChange={(e) => setFormClickUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              placeholder="Describe your ad campaign..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50 resize-none transition"
            />
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">
              Media File * ({CATEGORIES.find((c) => c.key === formCategory)?.type === "video" ? "Video" : "Image"})
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={CATEGORIES.find((c) => c.key === formCategory)?.type === "video" ? "video/*" : "image/*"}
              onChange={(e) => setFormFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-av-light-orange file:mr-4 file:rounded-lg file:border-0 file:bg-[#F49617]/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#F5C16C] hover:file:bg-[#F49617]/30 transition"
            />
            {formFile && (
              <p className="mt-1 text-xs text-av-light-orange">{formFile.name} ({(formFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            )}
          </div>

          {/* Budget & Pricing */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Budget (₦) *</label>
              <input
                type="number"
                min="1"
                step="any"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder="Total budget"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Price per Impression (₦) *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={formPricePerImpression}
                onChange={(e) => setFormPricePerImpression(e.target.value)}
                placeholder="Cost per view"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50 transition"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">Start Date (Optional)</label>
              <input
                type="datetime-local"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#F49617]/50 transition [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-av-light-orange mb-2">End Date (Optional)</label>
              <input
                type="datetime-local"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#F49617]/50 transition [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-[#F49617] to-[#F5C16C] px-6 py-3.5 text-sm font-bold text-[#050A30] shadow-lg shadow-[#F49617]/20 transition hover:shadow-[#F49617]/40 disabled:opacity-50"
          >
            {submitting ? (uploadProgress || "Submitting...") : "Submit Ad for Review"}
          </button>
        </form>
      )}

      {/* List Tab */}
      {tab === "list" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[#F5C16C]" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
              <button onClick={loadAds} className="ml-3 underline">Retry</button>
            </div>
          ) : ads.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center backdrop-blur-xl">
              <p className="text-lg text-av-light-orange">No ads yet</p>
              <p className="mt-2 text-sm text-av-light-orange">Submit your first ad to get started.</p>
              <button
                onClick={() => setTab("create")}
                className="mt-6 rounded-2xl bg-gradient-to-r from-[#F49617] to-[#F5C16C] px-6 py-3 text-sm font-bold text-[#050A30]"
              >
                Create Your First Ad
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total Ads" value={ads.length.toString()} />
                <StatCard label="Active" value={ads.filter((a) => a.status === "active").length.toString()} color="green" />
                <StatCard label="Total Budget" value={`₦${ads.reduce((s, a) => s + a.budget, 0).toLocaleString()}`} />
                <StatCard label="Total Spent" value={`₦${ads.reduce((s, a) => s + a.spent, 0).toLocaleString()}`} color="orange" />
              </div>

              {/* Ad cards */}
              <div className="space-y-3">
                {ads.map((ad) => (
                  <div key={ad.id}>
                    <div
                      onClick={() => selectAd(ad)}
                      className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                        selectedAd?.id === ad.id
                          ? "border-[#F49617]/40 bg-white/[0.06]"
                          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white">{ad.title}</h3>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[ad.status] || ""}`}>
                              {ad.status}
                            </span>
                            <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-av-light-orange">
                              {CATEGORIES.find((c) => c.key === ad.category)?.label || ad.category}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-av-light-orange">
                            <span>₦{ad.budget.toLocaleString()} budget</span>
                            <span>₦{ad.spent.toLocaleString()} spent</span>
                            <span>{ad.impression_count.toLocaleString()} impressions</span>
                          </div>
                          {/* Budget bar */}
                          {ad.budget > 0 && (
                            <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-white/8 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#F49617] to-[#F5C16C] transition-all"
                                style={{ width: `${Math.min(100, (ad.spent / ad.budget) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {ad.status === "active" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePause(ad.id); }}
                              className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300 hover:bg-purple-500/20 transition"
                            >
                              Pause
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setTopUpId(ad.id); }}
                            className="rounded-xl border border-[#F49617]/30 bg-[#F49617]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#F5C16C] hover:bg-[#F49617]/20 transition"
                          >
                            Top Up
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded stats */}
                    {selectedAd?.id === ad.id && (
                      <div className="mt-2 rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
                        {statsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-av-light-orange">
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#F5C16C]" />
                            Loading stats...
                          </div>
                        ) : stats ? (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <MiniStat label="Impressions" value={stats.total_impressions.toLocaleString()} />
                            <MiniStat label="Total Viewers" value={stats.total_viewers.toLocaleString()} />
                            <MiniStat label="Total Cost" value={`₦${stats.total_cost.toLocaleString()}`} />
                            <MiniStat label="Channels Reached" value={stats.unique_channels.toLocaleString()} />
                          </div>
                        ) : (
                          <p className="text-sm text-av-light-orange">No stats available yet.</p>
                        )}
                        <div className="pt-2 border-t border-white/6 space-y-2">
                          <DetailRow label="ID" value={ad.id} />
                          <DetailRow label="Price/Impression" value={`₦${ad.price_per_impression}`} />
                          {ad.click_url && <DetailRow label="Click URL" value={ad.click_url} />}
                          {ad.start_date && <DetailRow label="Start" value={new Date(ad.start_date).toLocaleString()} />}
                          {ad.end_date && <DetailRow label="End" value={new Date(ad.end_date).toLocaleString()} />}
                          <DetailRow label="Created" value={new Date(ad.created_at).toLocaleString()} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Top-up modal */}
      {topUpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTopUpId(null)}>
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0B1A52] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Top Up Budget</h3>
            <p className="mt-1 text-sm text-av-light-orange">Add funds to your ad campaign.</p>
            <input
              type="number"
              min="1"
              step="any"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Amount (₦)"
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#F49617]/50"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setTopUpId(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-av-light-orange hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={topUpSaving || !topUpAmount || Number(topUpAmount) <= 0}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#F49617] to-[#F5C16C] px-4 py-2.5 text-sm font-bold text-[#050A30] disabled:opacity-50"
              >
                {topUpSaving ? "Processing..." : "Top Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && <AdvertiserAnalyticsTab />}
    </div>
  );
}

/* ── Advertiser Analytics Tab ──────────────────────── */

const CATEGORY_LABELS_MAP: Record<string, string> = {
  banner_home: "Banner — Home",
  banner_page: "Banner — Page",
  in_stream_pre: "Pre-Roll",
  in_stream_mid: "Mid-Roll",
  in_stream_brief: "Brief (≤15s)",
};

function fmt(n: number) {
  return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtI(n: number) {
  return (n || 0).toLocaleString();
}

function AdvertiserAnalyticsTab() {
  const [data, setData] = useState<AdvertiserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"cost" | "impressions" | "viewers">("cost");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getMyAdAnalyticsApi();
        if (!res.ok || "error" in res.data) throw new Error("error" in res.data ? String(res.data.error) : "Failed");
        setData(res.data as AdvertiserAnalytics);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-[#F49617]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center text-red-300 text-sm">
        {error || "No data available"}
      </div>
    );
  }

  const { overview, daily, per_ad, categories } = data;
  const chartMax = Math.max(...daily.map((d) => d[chartMetric] || 0), 1);

  return (
    <div className="space-y-5">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Spend", value: `₦${fmt(overview.total_spent)}` },
          { label: "Budget Left", value: `₦${fmt(overview.remaining)}` },
          { label: "Impressions", value: fmtI(overview.total_impressions) },
          { label: "Avg Cost/Imp", value: `₦${fmt(overview.avg_cost)}` },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-av-light-orange">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* 30-Day Chart */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-av-light-orange">30-Day Performance</h3>
          <div className="flex gap-1">
            {(["cost", "impressions", "viewers"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`rounded-lg px-3 py-1 text-[10px] uppercase tracking-wider transition ${
                  chartMetric === m
                    ? "bg-[#F49617]/20 text-[#F49617]"
                    : "text-av-light-orange hover:text-av-light-orange"
                }`}
              >
                {m === "cost" ? "spend" : m}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-end gap-[2px]" style={{ height: 120 }}>
          {daily.map((d, i) => {
            const val = d[chartMetric] || 0;
            const h = chartMax > 0 ? (val / chartMax) * 100 : 0;
            return (
              <div key={i} className="group relative flex-1" title={`${d.date}: ${chartMetric === "cost" ? `₦${fmt(val)}` : fmtI(val)}`}>
                <div
                  className="w-full rounded-t bg-[#F49617]/50 transition group-hover:bg-[#F49617]/80"
                  style={{ height: `${Math.max(h, 1)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-av-light-orange">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-av-light-orange">By Category</h3>
          <div className="mt-3 space-y-3">
            {categories.sort((a, b) => b.cost - a.cost).map((c, i) => {
              const catMax = Math.max(...categories.map((x) => x.cost), 1);
              return (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="text-xs text-av-light-orange">{CATEGORY_LABELS_MAP[c.category] || c.category}</span>
                    <span className="text-xs font-medium text-av-light-orange">₦{fmt(c.cost)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#F49617]/50" style={{ width: `${(c.cost / catMax) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-av-light-orange">{fmtI(c.impressions)} impressions · {fmtI(c.viewers)} viewers</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Ad Table */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-av-light-orange">Ad Performance</h3>
        <div className="mt-3 overflow-x-auto">
          {per_ad.length === 0 ? (
            <p className="text-xs text-av-light-orange">No ads yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase tracking-wider text-av-light-orange">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Budget</th>
                  <th className="py-2 pr-3 text-right">Spent</th>
                  <th className="py-2 pr-3 text-right">Imps</th>
                  <th className="py-2 pr-3 text-right">Viewers</th>
                  <th className="py-2 text-right">Channels</th>
                </tr>
              </thead>
              <tbody>
                {per_ad.map((ad) => (
                  <tr key={ad.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-medium text-av-light-orange">{ad.title}</td>
                    <td className="py-2 pr-3 text-av-light-orange">{CATEGORY_LABELS_MAP[ad.category] || ad.category}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] border ${STATUS_COLORS[ad.status] || "bg-white/8 text-av-light-orange border-white/10"}`}>
                        {ad.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-av-light-orange">₦{fmt(ad.budget)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-[#F49617]">₦{fmt(ad.spent)}</td>
                    <td className="py-2 pr-3 text-right text-av-light-orange">{fmtI(ad.impressions)}</td>
                    <td className="py-2 pr-3 text-right text-av-light-orange">{fmtI(ad.viewers)}</td>
                    <td className="py-2 text-right text-av-light-orange">{ad.unique_channels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const borderColor = color === "green" ? "border-green-500/20" : color === "orange" ? "border-[#F49617]/20" : "border-white/8";
  return (
    <div className={`rounded-2xl border ${borderColor} bg-white/[0.03] p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-av-light-orange">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-av-light-orange">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="font-semibold text-av-light-orange min-w-[100px]">{label}</span>
      <span className="text-av-light-orange break-all">{value}</span>
    </div>
  );
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Math.round(video.duration));
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}
