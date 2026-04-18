"use client";

import { useState, useCallback, useEffect } from "react";
import { type GiftItem, getGiftsApi } from "@/lib/api";

function giftTier(gift: GiftItem): "basic" | "premium" | "ultra" {
  if (gift.vpt_units >= 500) return "ultra";
  if (gift.vpt_units >= 50) return "premium";
  return "basic";
}

const TIER_STYLES: Record<"basic" | "premium" | "ultra", { border: string; glow: string; label: string }> = {
  basic: { border: "border-av-input-border/30", glow: "", label: "" },
  premium: { border: "border-av-orange/40", glow: "shadow-sm shadow-av-orange/10", label: "Premium" },
  ultra: { border: "border-av-error/40", glow: "shadow-md shadow-av-error/15", label: "Ultra" },
};

interface GiftPanelProps {
  walletBalance: number;
  onSendGift: (gift: GiftItem) => void;
}

export function GiftPanel({ walletBalance, onSendGift }: GiftPanelProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGiftsApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "gifts" in res.data) {
        setGifts(res.data.gifts.sort((a, b) => a.sort_order - b.sort_order));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSend = useCallback(() => {
    if (!selectedGift) return;
    if (walletBalance < selectedGift.vpt_units) return;

    setSending(true);
    setLastSent(selectedGift.icon);
    onSendGift(selectedGift);

    setTimeout(() => {
      setSending(false);
      setSelectedGift(null);
      setLastSent(null);
    }, 1500);
  }, [selectedGift, walletBalance, onSendGift]);

  const canAfford = selectedGift ? walletBalance >= selectedGift.vpt_units : true;

  return (
    <div className="rounded-xl bg-av-card border border-av-input-border/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-av-input-border/20">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-av-white">Send Gift</h3>
          <span className="text-[10px] text-av-light-orange font-medium">💰 Support the creator</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-av-orange/10 border border-av-orange/20">
          <span className="text-[10px] font-bold text-av-orange">💎 {walletBalance.toLocaleString()}</span>
          <span className="text-[9px] text-av-light-orange">vPT</span>
        </div>
      </div>

      {/* Gift grid */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-av-orange border-t-transparent animate-spin" />
          </div>
        ) : gifts.length === 0 ? (
          <p className="text-center text-[11px] text-av-light-orange py-6">No gifts available</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {gifts.map((gift) => {
              const tier = giftTier(gift);
              const style = TIER_STYLES[tier];
              const isSelected = selectedGift?.id === gift.id;
              const tooExpensive = walletBalance < gift.vpt_units;

              return (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(isSelected ? null : gift)}
                  disabled={tooExpensive}
                  className={`relative flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? "border-av-orange bg-av-orange/10 scale-105"
                      : `${style.border} bg-av-input-fill/50 hover:bg-av-input-fill hover:scale-105`
                  } ${style.glow} ${tooExpensive ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {tier !== "basic" && (
                    <span className={`absolute -top-1.5 right-1 px-1.5 py-0 rounded text-[7px] font-bold uppercase tracking-wider text-white ${tier === "ultra" ? "bg-av-error/80" : "bg-av-orange/80"}`}>
                      {style.label}
                    </span>
                  )}

                  <span className="text-2xl">{gift.icon}</span>
                  <span className="text-[10px] text-av-light-orange font-medium truncate w-full text-center">
                    {gift.name}
                  </span>
                  <span className="text-[10px] font-bold text-av-orange">
                    {gift.vpt_units}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Send action */}
      <div className="px-3 pb-3">
        {selectedGift ? (
          <button
            onClick={handleSend}
            disabled={sending || !canAfford}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              sending
                ? "bg-green-500/20 text-green-400 cursor-wait"
                : canAfford
                ? "bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 active:scale-[0.98]"
                : "bg-av-error/20 text-av-error cursor-not-allowed"
            }`}
          >
            {sending ? (
              <span className="gift-send-animation inline-block">{lastSent} Sent!</span>
            ) : canAfford ? (
              `Send ${selectedGift.icon} ${selectedGift.name} — ${selectedGift.vpt_units} vPT`
            ) : (
              "Insufficient vPT Balance"
            )}
          </button>
        ) : (
          <p className="text-center text-[11px] text-av-light-orange py-2">
            Select a gift to send to the creator
          </p>
        )}
      </div>
    </div>
  );
}
