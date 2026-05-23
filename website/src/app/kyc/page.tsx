"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api, apiFormData } from "@/lib/api";

const ID_TYPES = [
  { value: "national_id", label: "National ID Card" },
  { value: "passport", label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "nin_slip", label: "NIN Slip" },
];

interface KycRecord {
  id: string;
  status: string;
  full_name: string;
  id_type: string;
  id_number: string;
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export default function KycPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [kycStatus, setKycStatus] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("NG");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiry, setIdExpiry] = useState("");

  // File uploads
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    let cancelled = false;

    api<KycRecord | { error: string }>("/kyc/me").then((res) => {
      if (cancelled) return;
      if (res.ok && "id" in res.data) {
        setKycStatus(res.data as KycRecord);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to verify your identity.</p>
          <Link href="/login?redirect=/kyc" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  async function uploadFile(file: File, fieldSetter: (url: string) => void, fieldName: string) {
    setUploadingField(fieldName);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFormData<{ url: string } | { error: string }>("/kyc/upload-doc", {
        body: formData,
        requireAuth: true,
      });
      if (res.ok && "url" in res.data) {
        fieldSetter((res.data as { url: string }).url);
      } else {
        setError("Failed to upload file. Please try again.");
      }
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!idNumber.trim()) { setError("ID number is required"); return; }
    if (!idFrontUrl) { setError("ID front image is required"); return; }
    if (!selfieUrl) { setError("Selfie photo is required"); return; }

    setSubmitting(true);
    try {
      const res = await api<KycRecord | { error: string }>("/kyc/submit", {
        method: "POST",
        body: {
          full_name: fullName.trim(),
          date_of_birth: dob || undefined,
          nationality,
          phone: phone || undefined,
          address: address || undefined,
          id_type: idType,
          id_number: idNumber.trim(),
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl || undefined,
          id_expiry_date: idExpiry || undefined,
          selfie_url: selfieUrl,
        },
        requireAuth: true,
      });

      if (res.ok) {
        setSuccess(true);
        if ("id" in res.data) setKycStatus(res.data as KycRecord);
      } else {
        const errData = res.data as { error: string };
        setError(errData.error || "Submission failed");
      }
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Already submitted and pending/verified
  if (loading) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
      </main>
    );
  }

  if (kycStatus && ["pending", "under_review", "verified"].includes(kycStatus.status)) {
    const statusColors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      under_review: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      verified: "text-green-400 bg-green-500/10 border-green-500/20",
    };
    return (
      <>
        <title>KYC Verification — AfroVision</title>
        <main className="min-h-screen pt-24 pb-16">
          <div className="max-w-xl mx-auto px-6 lg:px-8">
            <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${statusColors[kycStatus.status] || statusColors.pending}`}>
                {kycStatus.status === "verified" ? "✓ Verified" : kycStatus.status === "under_review" ? "Under Review" : "Pending Review"}
              </div>
              <h1 className="mt-6 text-2xl font-bold text-av-white">KYC Verification</h1>
              <p className="mt-3 text-sm text-av-light-orange">
                {kycStatus.status === "verified"
                  ? "Your identity has been verified. You have full access to all platform features."
                  : "Your documents are being reviewed. This usually takes 1-2 business days."}
              </p>
              <div className="mt-6 space-y-2 text-left rounded-xl bg-av-input-fill/30 p-4">
                <p className="text-xs text-av-light-orange">Name: <span className="text-av-white">{kycStatus.full_name}</span></p>
                <p className="text-xs text-av-light-orange">ID Type: <span className="text-av-white">{kycStatus.id_type}</span></p>
                <p className="text-xs text-av-light-orange">Submitted: <span className="text-av-white">{new Date(kycStatus.submitted_at).toLocaleDateString()}</span></p>
              </div>
              <Link href="/" className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
                ← Back to Home
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (success) {
    return (
      <>
        <title>KYC Submitted — AfroVision</title>
        <main className="min-h-screen pt-24 pb-16">
          <div className="max-w-xl mx-auto px-6 lg:px-8">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-av-white">KYC Submitted</h1>
              <p className="mt-3 text-sm text-av-light-orange">Your documents are now under review. We&apos;ll notify you once verification is complete.</p>
              <Link href="/" className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
                ← Back to Home
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <title>KYC Verification — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Identity Verification</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Complete KYC</h1>
            <p className="mt-2 text-sm text-av-light-orange">
              Verify your identity to unlock all features — premium subscriptions, wallet withdrawals, and creator tools.
            </p>
          </div>

          {kycStatus?.status === "rejected" && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm font-semibold text-red-400">Previous submission was rejected</p>
              {kycStatus.rejection_reason && (
                <p className="mt-1 text-xs text-red-300/70">Reason: {kycStatus.rejection_reason}</p>
              )}
              <p className="mt-2 text-xs text-av-light-orange">Please re-submit with valid documents below.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Personal Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Full Legal Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="As on your ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="+234..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="NG"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Your residential address"
                  />
                </div>
              </div>
            </section>

            {/* ID Info */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Identity Document</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">ID Type *</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  >
                    {ID_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">ID Number *</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="ID number"
                    required
                  />
                </div>
                {idType !== "nin_slip" && idType !== "national_id" && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">ID Expiry Date</label>
                  <input
                    type="date"
                    value={idExpiry}
                    onChange={(e) => setIdExpiry(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  />
                </div>
                )}
              </div>
            </section>

            {/* Upload Docs */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Upload Documents</h2>
              <div className="space-y-4">
                <FileUploadBox
                  label="ID Front Image *"
                  uploaded={!!idFrontUrl}
                  uploading={uploadingField === "id_front"}
                  onSelect={(file) => uploadFile(file, setIdFrontUrl, "id_front")}
                  inputRef={idFrontRef}
                />
                <FileUploadBox
                  label="ID Back Image (optional)"
                  uploaded={!!idBackUrl}
                  uploading={uploadingField === "id_back"}
                  onSelect={(file) => uploadFile(file, setIdBackUrl, "id_back")}
                  inputRef={idBackRef}
                />
                <FileUploadBox
                  label="Selfie Photo *"
                  hint="Take a clear selfie matching your ID photo"
                  uploaded={!!selfieUrl}
                  uploading={uploadingField === "selfie"}
                  onSelect={(file) => uploadFile(file, setSelfieUrl, "selfie")}
                  inputRef={selfieRef}
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={submitting || !!uploadingField}
              className="w-full rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? "Submitting..." : "Submit KYC Verification"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

function FileUploadBox({
  label,
  hint,
  uploaded,
  uploading,
  onSelect,
  inputRef,
}: {
  label: string;
  hint?: string;
  uploaded: boolean;
  uploading: boolean;
  onSelect: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
        uploaded
          ? "border-green-500/30 bg-green-500/5"
          : "border-av-input-border/30 bg-av-input-fill/20 hover:border-av-orange/30 hover:bg-av-input-fill/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
          <span className="text-xs text-av-light-orange">Uploading...</span>
        </div>
      ) : uploaded ? (
        <div className="flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span className="text-xs font-medium text-green-400">{label} — Uploaded</span>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-av-light-orange">{label}</p>
          {hint && <p className="mt-1 text-[10px] text-av-light-orange">{hint}</p>}
          <p className="mt-1 text-[10px] text-av-light-orange">Click to select file</p>
        </>
      )}
    </div>
  );
}
