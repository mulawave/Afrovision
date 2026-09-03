"use client";

import { useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  used: "bg-av-orange/10 border-av-orange/30 text-av-light-orange",
  activated: "bg-av-orange/10 border-av-orange/30 text-av-light-orange",
  unused: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300",
  revoked: "bg-red-500/10 border-red-400/30 text-red-300",
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
  return new Date(d).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CodesTab({ codes }: { codes: any[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = codes.filter((c) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.code || "").toLowerCase().includes(q) || (c.device_id || "").toLowerCase().includes(q);
  });

  const unusedCount = codes.filter((c) => c.status === "unused").length;
  const usedCount = codes.filter((c) => c.status === "used").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-av-white">Activation Codes ({codes.length})</h2>
        <div className="flex gap-2">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {unusedCount} unused
          </span>
          <span className="rounded-full border border-av-orange/30 bg-av-orange/10 px-3 py-1 text-xs font-medium text-av-light-orange">
            {usedCount} used
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by code or device ID..."
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
          <option value="unused">Unused</option>
          <option value="used">Used</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-av-card border border-av-input-border/30 p-8 text-center">
          <p className="text-sm text-av-light-orange/60">No activation codes found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-av-card border border-av-input-border/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-av-input-border/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Code</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Issued</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Activated</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-av-light-orange/70">Device</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} className="border-b border-av-input-border/20 last:border-0 hover:bg-av-input-fill/30">
                  <td className="px-4 py-3 font-mono text-av-white">{c.code}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-av-light-orange/70">{formatDate(c.issued_at)}</td>
                  <td className="px-4 py-3 text-av-light-orange/70">{formatDate(c.activated_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-av-light-orange/60">{c.device_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
