"use client";

import { useState } from "react";
import { distApi } from "@/lib/DistributorAuthContext";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300",
  disabled: "bg-red-500/10 border-red-400/30 text-red-300",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || "border-av-input-border/40 bg-av-card text-av-light-orange"}`}>
      {status}
    </span>
  );
}

export default function MarketersTab({ marketers, onFeedback, onRefresh }: {
  marketers: any[];
  onFeedback: (tone: string, msg: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", username: "", phone: "", pin: "" });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Leaderboard: top marketers by activation count
  const leaderboard = [...marketers]
    .filter((m) => m.status === "active")
    .sort((a, b) => (b.activation_count || 0) - (a.activation_count || 0))
    .slice(0, 5);

  // Anomaly detection: >5 codes requested but 0 activations (potential abuse)
  const anomalyMarketers = marketers.filter((m) => {
    const requested = m.codes_requested || 0;
    const activated = m.activation_count || 0;
    return requested >= 5 && activated === 0 && m.status === "active";
  });

  function resetForm() {
    setForm({ name: "", username: "", phone: "", pin: "" });
    setEditing(null);
    setShowForm(false);
    setFormError(null);
  }

  function startEdit(m: any) {
    setEditing(m);
    setForm({ name: m.name || "", username: m.username || "", phone: m.phone || "", pin: "" });
    setShowForm(true);
    setFormError(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        username: form.username,
        phone: form.phone || undefined,
      };
      if (form.pin) body.pin = form.pin;

      if (editing) {
        const res = await distApi(`/distribution/distributor/marketers/${editing.id}`, { method: "PATCH", body });
        if (!res.ok) throw new Error((res.data as any).error || "Failed to update marketer");
        onFeedback("success", "Marketer updated successfully");
      } else {
        if (!form.pin || form.pin.length < 4) {
          setFormError("PIN must be at least 4 digits");
          setSaving(false);
          return;
        }
        const res = await distApi("/distribution/distributor/marketers", { method: "POST", body });
        if (!res.ok) throw new Error((res.data as any).error || "Failed to create marketer");
        onFeedback("success", "Marketer created successfully");
      }
      resetForm();
      await onRefresh();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(m: any) {
    const newStatus = m.status === "active" ? "disabled" : "active";
    setTogglingId(m.id);
    try {
      const res = await distApi(`/distribution/distributor/marketers/${m.id}`, { method: "PATCH", body: { status: newStatus } });
      if (!res.ok) throw new Error((res.data as any).error || "Failed to update status");
      onFeedback("success", `Marketer ${newStatus === "disabled" ? "disabled" : "enabled"}`);
      await onRefresh();
    } catch (err: any) {
      onFeedback("error", err.message);
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = marketers.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q) || (m.phone || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-av-light-orange mb-4">Top Marketers</h3>
          <div className="space-y-2">
            {leaderboard.map((m, i) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-av-input-fill/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-av-orange text-av-dark-blue" : "bg-av-input-border/40 text-av-light-orange"}`}>{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-av-white">{m.name}</p>
                    <p className="text-xs text-av-light-orange/60">@{m.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-av-orange">{m.activation_count || 0}</p>
                  <p className="text-xs text-av-light-orange/60">activations</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly flags */}
      {anomalyMarketers.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-300 text-sm font-semibold">⚠ Anomaly Detected</span>
          </div>
          <p className="text-xs text-amber-200/70 mb-3">{anomalyMarketers.length} marketer(s) have requested 5+ codes with zero activations. This may indicate code hoarding or distribution issues.</p>
          <div className="space-y-1">
            {anomalyMarketers.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-amber-500/5 px-3 py-2">
                <span className="text-sm text-amber-200">{m.name} (@{m.username})</span>
                <span className="text-xs text-amber-300/70">{m.codes_requested || 0} codes, 0 activations</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-av-white">Marketers ({marketers.length})</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
        >
          + Add Marketer
        </button>
      </div>

      <input
        type="text"
        placeholder="Search marketers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md rounded-xl bg-av-input-fill border border-av-input-border/40 px-4 py-2.5 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60"
      />

      {showForm && (
        <form onSubmit={submitForm} className="rounded-2xl bg-av-card border border-av-input-border/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-av-light-orange">{editing ? "Edit Marketer" : "New Marketer"}</h3>
            <button type="button" onClick={resetForm} className="text-sm text-av-light-orange/60 hover:text-av-white">Cancel</button>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{formError}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-av-light-orange mb-1.5">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white focus:outline-none focus:border-av-orange/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-av-light-orange mb-1.5">Username</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={!!editing}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white focus:outline-none focus:border-av-orange/60 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-av-light-orange mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white focus:outline-none focus:border-av-orange/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-av-light-orange mb-1.5">PIN {editing && "(leave blank to keep current)"}</label>
              <input type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="••••"
                className="w-full h-11 px-4 rounded-xl bg-av-input-fill border border-av-input-border/40 text-sm text-av-white focus:outline-none focus:border-av-orange/60" />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-2.5 text-sm font-bold text-av-dark-blue disabled:opacity-50">
            {saving && (
              <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-av-dark-blue" />
            )}
            {saving ? "Saving..." : editing ? "Update Marketer" : "Create Marketer"}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
          <p className="text-sm text-av-light-orange/60">No marketers found. Click "Add Marketer" to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-av-card border border-av-input-border/30 px-4 py-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-av-white">{m.name}</p>
                  <p className="text-xs text-av-light-orange/60">@{m.username} · {m.phone || "No phone"}</p>
                </div>
                <StatusPill status={m.status} />
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-av-light-orange/60">Codes: <span className="font-mono text-av-white">{m.codes_requested || 0}</span></p>
                  <p className="text-xs text-av-light-orange/60">Activations: <span className="font-mono text-av-white">{m.activation_count || 0}</span></p>
                </div>
                <button onClick={() => startEdit(m)} className="text-sm font-medium text-av-light-orange hover:text-av-white">Edit</button>
                <button onClick={() => toggleStatus(m)} disabled={togglingId === m.id} className={`flex items-center gap-1.5 text-sm font-medium ${m.status === "active" ? "text-red-300/70 hover:text-red-300" : "text-emerald-300 hover:text-emerald-200"} disabled:opacity-50`}>
                  {togglingId === m.id && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-current" />
                  )}
                  {m.status === "active" ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
