/* eslint-disable @next/next/no-img-element */

"use client";

import { useMemo, useState } from "react";
import { type Channel } from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";

type SurferChannel = Pick<Channel, "id" | "name" | "channel_number" | "logo_url" | "category" | "is_active">;

interface ChannelSurferProps {
  currentChannel: SurferChannel;
  channels: SurferChannel[];
  onSelectChannel: (channelId: string) => void;
  variant?: "overlay" | "sidebar";
  pendingChannelId?: string | null;
}

function formatNumber(value: number | string | null | undefined): string {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "--";
}

function compareChannels(left: SurferChannel, right: SurferChannel) {
  const leftNumber = Number(left.channel_number) || 0;
  const rightNumber = Number(right.channel_number) || 0;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return left.name.localeCompare(right.name);
}

export function ChannelSurfer({ currentChannel, channels, onSelectChannel, variant = "overlay", pendingChannelId = null }: ChannelSurferProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);

  const orderedChannels = useMemo(() => {
    const map = new Map<string, SurferChannel>();
    [...channels, currentChannel].forEach((channel) => {
      if (channel?.id) {
        map.set(channel.id, channel);
      }
    });
    return [...map.values()].sort(compareChannels);
  }, [channels, currentChannel]);

  const currentIndex = Math.max(0, orderedChannels.findIndex((channel) => channel.id === currentChannel.id));
  const hasMultiple = orderedChannels.length > 1;
  const previousChannel = hasMultiple
    ? orderedChannels[(currentIndex - 1 + orderedChannels.length) % orderedChannels.length]
    : currentChannel;
  const nextChannel = hasMultiple
    ? orderedChannels[(currentIndex + 1) % orderedChannels.length]
    : currentChannel;

  const goToChannel = (channelId: string) => {
    setDrawerOpen(false);
    setGridOpen(false);
    onSelectChannel(channelId);
  };

  // Sidebar variant: render a dedicated scrollable panel, no overlay widget
  if (variant === "sidebar") {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden">
        <div className="flex items-center justify-between border-b border-av-input-border/20 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-av-light-orange/70">Channels</p>
            <p className="text-xs text-av-light-orange">Tap a channel to switch</p>
          </div>
          <button
            type="button"
            onClick={() => setGridOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-av-white hover:bg-white/10"
          >
            Grid
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {orderedChannels.map((channel) => {
            const isCurrent = channel.id === currentChannel.id;
            const isPending = pendingChannelId === channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                disabled={!!pendingChannelId && !isPending}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${isCurrent ? "bg-av-orange/15 ring-1 ring-av-orange/30" : "hover:bg-white/5"}`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {channel.logo_url ? (
                    <img src={resolveWebsiteMediaUrl(channel.logo_url)} alt={channel.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-av-light-orange">{channel.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-av-light-orange">#{formatNumber(channel.channel_number)}</span>
                    {isCurrent ? <span className="rounded-full bg-av-orange/20 px-2 py-0.5 text-[10px] font-semibold text-av-orange">Current</span> : null}
                    {isPending ? <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Loading…</span> : null}
                    {!channel.is_active ? <span className="rounded-full bg-av-error/15 px-2 py-0.5 text-[10px] font-semibold text-av-error">Off</span> : null}
                  </div>
                  <p className="truncate text-sm font-semibold text-av-white">{channel.name}</p>
                  <p className="truncate text-[11px] text-av-light-orange/70">{channel.category || "Live TV"}</p>
                </div>
              </button>
            );
          })}
        </div>

        {gridOpen && (
          <div className="fixed inset-0 z-40 bg-black/65 px-3 py-4 backdrop-blur-md" onClick={() => setGridOpen(false)}>
            <div
              className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#050A30]/95 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-av-light-orange/70">Channel grid</p>
                  <h3 className="text-lg font-semibold text-av-white">Tap a logo to switch</h3>
                </div>
                <button type="button" onClick={() => setGridOpen(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-av-white">
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                  {orderedChannels.map((channel) => {
                    const isCurrent = channel.id === currentChannel.id;
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => { setGridOpen(false); onSelectChannel(channel.id); }}
                        disabled={!!pendingChannelId && pendingChannelId !== channel.id}
                        className={`group relative overflow-hidden rounded-3xl border transition-all ${isCurrent ? "border-av-orange/50 bg-av-orange/15" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"}`}
                      >
                        <div className="aspect-square w-full">
                          {channel.logo_url ? (
                            <img src={resolveWebsiteMediaUrl(channel.logo_url)} alt={channel.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-av-orange/25 to-white/5 text-center">
                              <span className="px-2 text-sm font-semibold text-av-white">{channel.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-8">
                          <p className="truncate text-[11px] font-semibold text-white">#{formatNumber(channel.channel_number)}</p>
                          <p className="truncate text-[10px] text-av-light-orange/75">{channel.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default overlay variant (legacy in-player widget)
  return (
    <div className="pointer-events-auto relative z-30 w-[min(26rem,calc(100vw-1.5rem))]">
      <div className="rounded-2xl border border-white/15 bg-[#050A30]/75 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => goToChannel(previousChannel.id)}
            disabled={!hasMultiple}
            className="flex w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-av-white transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Previous channel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => goToChannel(currentChannel.id)}
            className="min-w-0 flex-1 rounded-xl border border-av-orange/30 bg-gradient-to-r from-av-orange/20 to-white/5 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-[0.26em] text-av-light-orange/70">Now playing</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {currentChannel.logo_url ? (
                  <img src={resolveWebsiteMediaUrl(currentChannel.logo_url)} alt={currentChannel.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-av-light-orange">{currentChannel.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-av-white">#{formatNumber(currentChannel.channel_number)} · {currentChannel.name}</p>
                <p className="truncate text-[11px] text-av-light-orange/70">{currentChannel.category || "Live TV"}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => goToChannel(nextChannel.id)}
            disabled={!hasMultiple}
            className="flex w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-av-white transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Next channel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="m8.6 16.6 1.4 1.4 6-6-6-6-1.4 1.4L13.8 12z" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDrawerOpen((value) => !value);
              setGridOpen(false);
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-av-white transition-colors hover:bg-white/10"
          >
            {drawerOpen ? "Hide channel list" : "Open channel list"}
          </button>
          <button
            type="button"
            onClick={() => {
              setGridOpen((value) => !value);
              setDrawerOpen(false);
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-av-light-orange transition-colors hover:bg-white/10"
          >
            {gridOpen ? "Hide grid" : "Open grid"}
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="mt-2 max-h-[30rem] overflow-hidden rounded-2xl border border-white/15 bg-[#050A30]/92 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-av-light-orange/70">Channel list</p>
              <p className="text-xs text-av-light-orange">Scroll and tap to switch instantly</p>
            </div>
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold text-av-white">
              Close
            </button>
          </div>
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {orderedChannels.map((channel) => {
              const isCurrent = channel.id === currentChannel.id;
              const isPending = pendingChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => goToChannel(channel.id)}
                  disabled={!!pendingChannelId && !isPending}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${isCurrent ? "bg-av-orange/15 ring-1 ring-av-orange/30" : "hover:bg-white/5"}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {channel.logo_url ? (
                      <img src={resolveWebsiteMediaUrl(channel.logo_url)} alt={channel.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-av-light-orange">{channel.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-av-light-orange">#{formatNumber(channel.channel_number)}</span>
                      {isCurrent ? <span className="rounded-full bg-av-orange/20 px-2 py-0.5 text-[10px] font-semibold text-av-orange">Current</span> : null}
                      {isPending ? <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Loading…</span> : null}
                      {!channel.is_active ? <span className="rounded-full bg-av-error/15 px-2 py-0.5 text-[10px] font-semibold text-av-error">Off</span> : null}
                    </div>
                    <p className="truncate text-sm font-semibold text-av-white">{channel.name}</p>
                    <p className="truncate text-[11px] text-av-light-orange/70">{channel.category || "Live TV"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {gridOpen && (
        <div className="fixed inset-0 z-40 bg-black/65 px-3 py-4 backdrop-blur-md" onClick={() => setGridOpen(false)}>
          <div
            className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#050A30]/95 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-av-light-orange/70">Channel grid</p>
                <h3 className="text-lg font-semibold text-av-white">Tap a logo to switch</h3>
              </div>
              <button type="button" onClick={() => setGridOpen(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-av-white">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {orderedChannels.map((channel) => {
                  const isCurrent = channel.id === currentChannel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => goToChannel(channel.id)}
                      disabled={!!pendingChannelId && pendingChannelId !== channel.id}
                      className={`group relative overflow-hidden rounded-3xl border transition-all ${isCurrent ? "border-av-orange/50 bg-av-orange/15" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"}`}
                    >
                      <div className="aspect-square w-full">
                        {channel.logo_url ? (
                          <img src={resolveWebsiteMediaUrl(channel.logo_url)} alt={channel.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-av-orange/25 to-white/5 text-center">
                            <span className="px-2 text-sm font-semibold text-av-white">{channel.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-8">
                        <p className="truncate text-[11px] font-semibold text-white">#{formatNumber(channel.channel_number)}</p>
                        <p className="truncate text-[10px] text-av-light-orange/75">{channel.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
