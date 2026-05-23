"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  getSupportedBanksApi,
  resolveBankAccountApi,
  saveBankDetailsApi,
  type BankOption,
  type BankDetails,
} from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (details: BankDetails) => void;
}

export default function AddBankAccountModal({ open, onClose, onSaved }: Props) {
  if (!open) return null;

  return <AddBankAccountModalContent onClose={onClose} onSaved={onSaved} />;
}

interface ContentProps {
  onClose: () => void;
  onSaved: (details: BankDetails) => void;
}

function AddBankAccountModalContent({ onClose, onSaved }: ContentProps) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<{ account_name: string; account_number: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load bank list on mount
  useEffect(() => {
    let cancelled = false;
    getSupportedBanksApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "banks" in res.data) {
        const sorted = [...res.data.banks].sort((a, b) => a.name.localeCompare(b.name));
        setBanks(sorted);
      } else {
        setLoadError("Failed to load bank list. Please try again.");
      }
      setLoadingBanks(false);
    });
    return () => { cancelled = true; };
  }, []);

  const normalizedNumber = accountNumber.replace(/\D/g, "");
  const canResolve = selectedBank !== null && normalizedNumber.length === 10 && !resolving;
  const canSave = resolved !== null && !saving;

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return banks;
    const q = bankSearch.toLowerCase();
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, bankSearch]);

  const handleResolve = useCallback(async () => {
    if (!canResolve || !selectedBank) return;
    setResolving(true);
    setError(null);
    setResolved(null);
    const res = await resolveBankAccountApi(selectedBank.code, normalizedNumber);
    setResolving(false);
    if (res.ok && "account_name" in res.data) {
      setResolved({ account_name: res.data.account_name, account_number: res.data.account_number });
    } else {
      const errData = res.data as { error?: string };
      setError(errData.error || "Could not verify this account. Check details and try again.");
    }
  }, [canResolve, selectedBank, normalizedNumber]);

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedBank || !resolved) return;
    setSaving(true);
    setError(null);
    const res = await saveBankDetailsApi({
      bank_code: selectedBank.code,
      bank_name: selectedBank.name,
      account_number: resolved.account_number,
      account_name: resolved.account_name,
    });
    setSaving(false);
    if (res.ok && "bank_details" in res.data) {
      onSaved(res.data.bank_details);
    } else {
      const errData = res.data as { error?: string };
      setError(errData.error || "Failed to save bank details.");
    }
  }, [canSave, selectedBank, resolved, onSaved]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-av-input-border/30 bg-av-card shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-av-input-border/20 px-6 py-4">
          <h2 className="text-lg font-bold text-av-white">Add Bank Account</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-av-light-orange hover:bg-av-input-fill transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Warning */}
          <div className="rounded-xl border border-av-orange/40 bg-av-orange/5 p-4">
            <p className="text-xs font-bold text-av-orange mb-1">Important</p>
            <p className="text-xs text-av-light-orange leading-relaxed">
              Your bank details will be saved permanently after verification and cannot be edited.
              If you need to change them later, contact AfroVision support.
            </p>
          </div>

          {loadingBanks ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-av-error/30 bg-av-error/5 p-6 text-center">
              <p className="text-sm text-av-error mb-3">{loadError}</p>
              <button
                onClick={() => {
                  setLoadingBanks(true);
                  setLoadError(null);
                  getSupportedBanksApi().then((res) => {
                    if (res.ok && "banks" in res.data) {
                      setBanks([...res.data.banks].sort((a, b) => a.name.localeCompare(b.name)));
                    } else {
                      setLoadError("Failed to load bank list.");
                    }
                    setLoadingBanks(false);
                  });
                }}
                className="text-sm text-av-orange hover:text-av-light-orange"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Bank Selection */}
              <div>
                <label className="block text-xs font-medium text-av-light-orange mb-2 uppercase tracking-wider">
                  Select Bank
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between rounded-xl border border-av-input-border bg-av-input-fill px-4 py-3.5 text-sm text-left transition-colors focus:border-av-orange focus:outline-none"
                  >
                    <span className={selectedBank ? "text-av-white" : "text-av-hint"}>
                      {selectedBank ? selectedBank.name : "Choose your bank"}
                    </span>
                    <svg className={`h-4 w-4 text-av-light-orange transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-hidden rounded-xl border border-av-input-border bg-av-card shadow-xl shadow-black/30">
                      {/* Search */}
                      <div className="border-b border-av-input-border/20 p-2">
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search banks..."
                          className="w-full rounded-lg border border-av-input-border bg-av-input-fill px-3 py-2 text-xs text-av-white placeholder-av-hint focus:border-av-orange focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredBanks.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-av-hint">No banks match your search.</p>
                        ) : (
                          filteredBanks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => {
                                setSelectedBank(bank);
                                setDropdownOpen(false);
                                setBankSearch("");
                                setResolved(null);
                                setError(null);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-av-orange/10 ${
                                selectedBank?.code === bank.code
                                  ? "text-av-orange bg-av-orange/5"
                                  : "text-av-white"
                              }`}
                            >
                              {bank.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-medium text-av-light-orange mb-2 uppercase tracking-wider">
                  Account Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setAccountNumber(v);
                    setResolved(null);
                    setError(null);
                  }}
                  placeholder="Enter 10-digit account number"
                  className="w-full rounded-xl border border-av-input-border bg-av-input-fill px-4 py-3.5 text-sm text-av-white placeholder-av-hint focus:border-av-orange focus:outline-none transition-colors font-mono tracking-wider"
                />
                <p className="mt-1.5 text-xs text-av-light-orange">
                  Must be exactly 10 digits
                </p>
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleResolve}
                disabled={!canResolve}
                className="w-full rounded-full border-2 border-av-orange py-3 text-sm font-bold text-av-orange hover:bg-av-orange/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resolving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying…
                  </span>
                ) : (
                  "Verify Account Name"
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-av-error/30 bg-av-error/10 p-4 text-sm text-av-error">
                  {error}
                </div>
              )}

              {/* Verified Account Card */}
              {resolved && (
                <div className="rounded-xl border border-av-success/40 bg-av-success/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-av-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-bold text-av-success">Verified Account</p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-av-light-orange">Bank</p>
                      <p className="text-sm font-semibold text-av-white">{selectedBank?.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-av-light-orange">Account Name</p>
                      <p className="text-sm font-semibold text-av-white">{resolved.account_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-av-light-orange">Account Number</p>
                      <p className="text-sm font-semibold text-av-white font-mono">{resolved.account_number}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loadingBanks && !loadError && (
          <div className="border-t border-av-input-border/20 px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-av-input-border/40 py-3 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange py-3 text-sm font-bold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Save Bank Account"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
