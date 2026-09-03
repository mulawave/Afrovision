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

export default function DevicesTab({ devices, onFeedback }: { devices: any[]; onFeedback?: (tone: string, msg: string) => void }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [requestingDisable, setRequestingDisable] = useState<string | null>(null);
  const [disableDevice, setDisableDevice] = useState<any | null>(null);
  const [disableReason, setDisableReason] = useState("");

  const filtered = devices.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.device_id || "").toLowerCase().includes(q) ||
      (d.owner_name || "").toLowerCase().includes(q) ||
      (d.owner_email || "").toLowerCase().includes(q) ||
      (d.activation_code || "").toLowerCase().includes(q);
  });

  async function submitDisableRequest() {
    if (!disableDevice) return;
    setRequestingDisable(disableDevice.device_id);
    try {
      const res = await distApi(`/distribution/distributor/devices/${disableDevice.device_id}/request-disable`, {
        method: "POST",
        body: { reason: disableReason },
      });
      if (!res.ok) throw new Error((res.data as any).error || "Failed to submit request");
      onFeedback?.("success", "Disable request submitted to AfroVision admin");
      setDisableDevice(null);
      setDisableReason("");
    } catch (err: any) {
      onFeedback?.("error", err.message);
    } finally {
      setRequestingDisable(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-av-white">TV Devices ({devices.length})</h2>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by device, owner, email, or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md rounded-xl bg-av-input-fill border border-av-input-border/40 px-4 py-2.5 text-sm text-av-white placeholder:text-av-light-orange focus:outline-none focus:border-av-orange/60"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl bg-av-input-fill border border-av-input-border/40 px-4 py-2.5 text-sm text-av-white focus:outline-none focus:border-av-orange/60"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
          <p className="text-sm text-av-light-orange/60">No TV devices found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <div key={d.device_id} className="rounded-xl bg-av-card border border-av-input-border/30 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-av-white">{d.owner_name || "Unknown Owner"}</p>
                    <StatusPill status={d.status} />
                  </div>
                  <p className="text-xs text-av-light-orange/60">{d.owner_email || "No email"} · {d.owner_phone || "No phone"}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-av-light-orange/60">
                    <span>Device: <span className="font-mono text-av-white/80">{d.device_name || d.device_id}</span></span>
                    <span>Code: <span className="font-mono text-av-white/80">{d.activation_code || "—"}</span></span>
                    <span>App: <span className="text-av-white/80">{d.app_version || "—"}</span></span>
                  </div>
                </div>
                <div className="text-right text-xs text-av-light-orange/60">
                  <p>Activated: {formatDate(d.activated_at)}</p>
                  <p>Last seen: {timeAgo(d.last_seen_at)}</p>
                  {d.status === "active" && (
                    <button
                      onClick={() => { setDisableDevice(d); setDisableReason(""); }}
                      className="mt-2 text-xs font-medium text-red-300/70 hover:text-red-300"
                    >
                      Request Disable
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disable request modal */}
      {disableDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDisableDevice(null)}>
          <div className="rounded-2xl bg-av-card border border-av-input-border/40 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-av-light-orange mb-2">Request TV Disable</h3>
            <p className="text-xs text-av-light-orange/60 mb-4">
              Submit a request to AfroVision admin to disable this TV. Provide a reason for the request.
            </p>
            <div className="mb-3 rounded-xl bg-av-input-fill/50 px-3 py-2">
              <p className="text-sm text-av-white">{disableDevice.owner_name || "Unknown"}</p>
              <p className="text-xs text-av-light-orange/60">{disableDevice.device_name || disableDevice.device_id}</p>
            </div>
            <textarea
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="Reason for disable request..."
              rows={3}
              className="w-full rounded-xl bg-av-input-fill border border-av-input-border/40 px-4 py-2.5 text-sm text-av-white placeholder:text-av-light-orange/40 focus:outline-none focus:border-av-orange/60 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={submitDisableRequest}
                disabled={requestingDisable === disableDevice.device_id}
                className="flex items-center gap-2 rounded-xl bg-red-500/80 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {requestingDisable === disableDevice.device_id && (
                  <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                )}
                Submit Request
              </button>
              <button
                onClick={() => setDisableDevice(null)}
                className="rounded-xl bg-av-input-fill border border-av-input-border/40 px-5 py-2.5 text-sm font-medium text-av-light-orange hover:text-av-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
