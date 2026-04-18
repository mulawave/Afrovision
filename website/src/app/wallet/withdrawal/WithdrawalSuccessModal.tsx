"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  open: boolean;
  amount: number;
  totalDebit: number;
  transactionFee: number;
  serviceCharge: number;
  vatAmount: number;
  bankName: string;
  onClose: () => void;
}

export default function WithdrawalSuccessModal({ open, amount, totalDebit, transactionFee, serviceCharge, vatAmount, bankName, onClose }: Props) {
  const [animStage, setAnimStage] = useState(0);

  useEffect(() => {
    if (!open) {
      setAnimStage(0);
      return;
    }
    // Staggered animation: 0 → circle, 1 → check, 2 → content
    const t1 = setTimeout(() => setAnimStage(1), 300);
    const t2 = setTimeout(() => setAnimStage(2), 700);
    const t3 = setTimeout(() => setAnimStage(3), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-av-input-border/30 bg-av-card shadow-2xl shadow-black/40 p-8 text-center">

        {/* Animated Check Circle */}
        <div className="mx-auto mb-6 relative h-24 w-24">
          {/* Outer ring */}
          <svg className="absolute inset-0 h-24 w-24" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={`text-av-success transition-all duration-500 ease-out ${
                animStage >= 1 ? "opacity-100" : "opacity-0"
              }`}
              strokeDasharray="276.5"
              strokeDashoffset={animStage >= 1 ? 0 : 276.5}
              style={{ transition: "stroke-dashoffset 0.6s ease-out, opacity 0.3s" }}
            />
          </svg>
          {/* Inner filled circle */}
          <div
            className={`absolute inset-2 rounded-full bg-av-success/15 border-2 border-av-success/30 flex items-center justify-center transition-all duration-300 ${
              animStage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            {/* Checkmark */}
            <svg
              className={`h-10 w-10 text-av-success transition-all duration-400 ${
                animStage >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-50"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeDasharray="24"
                strokeDashoffset={animStage >= 2 ? 0 : 24}
                style={{ transition: "stroke-dashoffset 0.4s ease-out 0.1s" }}
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div
          className={`transition-all duration-500 ${
            animStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="text-xl font-bold text-av-white mb-2">Withdrawal Request Submitted</h2>
          <p className="text-2xl font-bold text-av-success mb-4">₦{amount.toLocaleString()}</p>

          {/* Fee breakdown */}
          <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 p-4 mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-av-light-orange">You will receive</span>
              <span className="font-semibold text-av-white">₦{amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-av-light-orange">Transaction fee</span>
              <span className="text-av-light-orange">₦{transactionFee.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-av-light-orange">Service charge</span>
              <span className="text-av-light-orange">₦{serviceCharge.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-av-light-orange">VAT (7.5%)</span>
              <span className="text-av-light-orange">₦{vatAmount.toLocaleString()}</span>
            </div>
            <div className="border-t border-av-input-border/30 pt-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-av-white">Total debited</span>
              <span className="font-bold text-av-orange">₦{totalDebit.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl border border-av-input-border/20 bg-av-input-fill/30 p-4 mb-5 text-left space-y-3">
            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-av-light-orange mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-av-light-orange leading-relaxed">
                Your withdrawal request is now being reviewed by the AfroVision team.
                This process typically takes <span className="font-semibold text-av-white">1–3 business days</span>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-av-light-orange mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-xs text-av-light-orange leading-relaxed">
                Once approved, <span className="font-semibold text-av-white">₦{amount.toLocaleString()}</span> will be
                sent directly to your <span className="font-semibold text-av-white">{bankName}</span> bank account on file.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-av-light-orange mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-xs text-av-light-orange leading-relaxed">
                The requested amount has been reserved from your balance. If the request is
                declined, the funds will be returned to your wallet automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onClose}
              className="w-full rounded-full bg-gradient-to-r from-av-orange to-av-light-orange py-3.5 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
            >
              Done
            </button>
            <Link
              href="/wallet/withdrawal/history"
              className="inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange transition-colors"
            >
              View Withdrawal History →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
