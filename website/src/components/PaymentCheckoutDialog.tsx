"use client";

interface CheckoutProvider {
  id: string;
  label: string;
  enabled: boolean;
}

interface PaymentCheckoutDialogProps {
  open: boolean;
  title: string;
  subtitle: string;
  providers: CheckoutProvider[];
  provider: string;
  onProviderChange: (provider: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  amountNgn?: number;
  amountValue?: string;
  onAmountChange?: (value: string) => void;
  balanceType?: "ngn" | "vpt";
  onBalanceTypeChange?: (value: "ngn" | "vpt") => void;
}

export default function PaymentCheckoutDialog({
  open,
  title,
  subtitle,
  providers,
  provider,
  onProviderChange,
  onClose,
  onConfirm,
  confirmLabel,
  busy = false,
  error = null,
  amountNgn,
  amountValue,
  onAmountChange,
  balanceType,
  onBalanceTypeChange,
}: PaymentCheckoutDialogProps) {
  if (!open) return null;

  const enabledProviders = providers.filter((item) => item.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] border border-av-input-border/40 bg-av-card p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-av-orange/80">Secure Checkout</p>
            <h2 className="mt-2 text-2xl font-bold text-av-white">{title}</h2>
            <p className="mt-2 text-sm text-av-light-orange">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-av-input-border/30 px-3 py-1.5 text-xs font-semibold text-av-light-orange transition hover:border-av-orange/40 hover:text-av-white"
          >
            Close
          </button>
        </div>

        {typeof amountNgn === "number" ? (
          <div className="mt-5 rounded-2xl border border-av-orange/20 bg-av-orange/5 px-4 py-4">
            <p className="text-[11px] uppercase tracking-wider text-av-light-orange">Amount</p>
            <p className="mt-1 text-3xl font-extrabold text-av-white">₦{amountNgn.toLocaleString()}</p>
          </div>
        ) : null}

        {typeof amountValue === "string" && onAmountChange ? (
          <div className="mt-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
              Top-up Amount (NGN)
            </label>
            <input
              type="number"
              min="100"
              step="100"
              value={amountValue}
              onChange={(event) => onAmountChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white outline-none focus:border-av-orange/40"
              placeholder="Enter amount"
            />
          </div>
        ) : null}

        {balanceType && onBalanceTypeChange ? (
          <div className="mt-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
              Credit Destination
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onBalanceTypeChange("ngn")}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  balanceType === "ngn"
                    ? "border-av-orange/40 bg-av-orange/10 text-av-white"
                    : "border-av-input-border/30 bg-av-input-fill text-av-light-orange"
                }`}
              >
                <div className="text-sm font-semibold">NGN Wallet</div>
                <div className="mt-1 text-xs text-av-light-orange">Use for subscriptions and premium access</div>
              </button>
              <button
                onClick={() => onBalanceTypeChange("vpt")}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  balanceType === "vpt"
                    ? "border-av-orange/40 bg-av-orange/10 text-av-white"
                    : "border-av-input-border/30 bg-av-input-fill text-av-light-orange"
                }`}
              >
                <div className="text-sm font-semibold">Gift Wallet vPT</div>
                <div className="mt-1 text-xs text-av-light-orange">Use for gifts and vPT spend</div>
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-av-light-orange">
            Payment Provider
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(providers.length ? providers : enabledProviders).map((item) => (
              <button
                key={item.id}
                onClick={() => item.enabled && onProviderChange(item.id)}
                disabled={!item.enabled}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  provider === item.id
                    ? "border-av-orange/40 bg-av-orange/10"
                    : "border-av-input-border/30 bg-av-input-fill"
                } ${!item.enabled ? "cursor-not-allowed opacity-40" : "hover:border-av-orange/30"}`}
              >
                <div className="text-sm font-semibold text-av-white">{item.label}</div>
                <div className="mt-1 text-xs text-av-light-orange">
                  {item.enabled ? "Configured in admin settings" : "Not configured"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-full border border-av-input-border/30 px-5 py-3 text-sm font-semibold text-av-light-orange transition hover:border-av-orange/30 hover:text-av-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || enabledProviders.length === 0}
            className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-bold text-av-dark-blue transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Redirecting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
