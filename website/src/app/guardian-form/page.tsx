"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api, apiFormData } from "@/lib/api";

const RELATIONSHIPS = [
  { value: "parent", label: "Parent" },
  { value: "legal_guardian", label: "Legal Guardian" },
  { value: "sibling", label: "Sibling" },
  { value: "relative", label: "Relative" },
  { value: "other", label: "Other" },
];

const ID_TYPES = [
  { value: "national_id", label: "National ID Card" },
  { value: "international_passport", label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "nin_slip", label: "NIN Slip" },
  { value: "residence_permit", label: "Residence Permit" },
];

interface GuardianRecord {
  id: string;
  status: string;
  guardian_full_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_relationship: string;
  created_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export default function GuardianFormPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [existing, setExisting] = useState<GuardianRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [idType, setIdType] = useState("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [linkExistingAccount, setLinkExistingAccount] = useState(false);
  const [accountUid, setAccountUid] = useState("");
  const [signature, setSignature] = useState("");

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

    api<GuardianRecord | { error: string }>("/guardian/me", { requireAuth: true }).then((res) => {
      if (cancelled) return;
      if (res.ok && "id" in res.data) {
        setExisting(res.data as GuardianRecord);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading]);

  if (isLoading || loading) {
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
          <p className="text-sm text-av-light-orange">Sign in to submit a guardian consent form.</p>
          <Link href="/login?redirect=/guardian-form" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (existing && ["pending", "verified"].includes(existing.status)) {
    const statusColors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      verified: "text-green-400 bg-green-500/10 border-green-500/20",
    };
    return (
      <>
        <title>Guardian Consent — AfroVision</title>
        <main className="min-h-screen pt-24 pb-16">
          <div className="max-w-xl mx-auto px-6 lg:px-8">
            <div className="rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${statusColors[existing.status] || statusColors.pending}`}>
                {existing.status === "verified" ? "✓ Verified" : "Pending Review"}
              </div>
              <h1 className="mt-6 text-2xl font-bold text-av-white">Guardian Consent</h1>
              <p className="mt-3 text-sm text-av-light-orange">
                {existing.status === "verified"
                  ? "Your guardian consent has been approved. You now have restricted access as a minor user."
                  : "Your guardian form is under review. This usually takes 1-2 business days."}
              </p>
              <div className="mt-6 space-y-2 text-left rounded-xl bg-av-input-fill/30 p-4">
                <p className="text-xs text-av-light-orange">Guardian: <span className="text-av-white">{existing.guardian_full_name}</span></p>
                <p className="text-xs text-av-light-orange">Relationship: <span className="text-av-white">{existing.guardian_relationship}</span></p>
                <p className="text-xs text-av-light-orange">Submitted: <span className="text-av-white">{new Date(existing.created_at).toLocaleDateString()}</span></p>
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

  if (existing && existing.status === "rejected") {
    return (
      <>
        <title>Guardian Consent — AfroVision</title>
        <main className="min-h-screen pt-24 pb-16">
          <div className="max-w-xl mx-auto px-6 lg:px-8">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold text-red-400 bg-red-500/10 border-red-500/20">
                ✕ Rejected
              </div>
              <h1 className="mt-6 text-2xl font-bold text-av-white">Guardian Consent Rejected</h1>
              <p className="mt-3 text-sm text-av-light-orange">
                Your guardian consent form was not approved. Please review the reason below and submit a new form.
              </p>
              {existing.rejection_reason && (
                <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-left">
                  <p className="text-xs font-semibold text-red-400">Rejection Reason:</p>
                  <p className="mt-1 text-sm text-av-white">{existing.rejection_reason}</p>
                </div>
              )}
              <button
                onClick={() => { setExisting(null); }}
                className="mt-6 inline-block rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-av-dark-blue transition-all hover:bg-orange-400"
              >
                Submit New Form →
              </button>
              <Link href="/" className="mt-3 block text-sm font-semibold text-av-orange hover:text-av-light-orange">
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
        <title>Guardian Form Submitted — AfroVision</title>
        <main className="min-h-screen pt-24 pb-16">
          <div className="max-w-xl mx-auto px-6 lg:px-8">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-green-400">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-av-white">Guardian Form Submitted</h1>
              <p className="mt-3 text-sm text-av-light-orange">Your guardian consent form is now under review. We&apos;ll notify you once it&apos;s processed.</p>
              <Link href="/" className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
                ← Back to Home
              </Link>
            </div>
          </div>
        </main>
      </>
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

    if (!fullName.trim()) { setError("Guardian full name is required"); return; }
    if (!email.trim()) { setError("Guardian email is required"); return; }
    if (!phone.trim()) { setError("Guardian phone number is required"); return; }
    if (!signature.trim()) { setError("Consent signature is required"); return; }

    if (linkExistingAccount) {
      if (!accountUid.trim()) { setError("Guardian account UID is required"); return; }
    } else {
      if (!idNumber.trim()) { setError("Guardian ID number is required"); return; }
      if (!idFrontUrl) { setError("Guardian ID front image is required"); return; }
      if (!selfieUrl) { setError("Guardian selfie photo is required"); return; }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        guardian_full_name: fullName.trim(),
        guardian_email: email.trim(),
        guardian_phone: phone.trim(),
        guardian_relationship: relationship,
        guardian_address: address || undefined,
        consent_declaration: true,
        consent_signature: signature.trim(),
      };

      if (linkExistingAccount) {
        body.guardian_account_uid = accountUid.trim();
      } else {
        body.guardian_id_type = idType;
        body.guardian_id_number = idNumber.trim();
        body.guardian_id_front_url = idFrontUrl;
        body.guardian_selfie_url = selfieUrl;
        if (idBackUrl) body.guardian_id_back_url = idBackUrl;
      }

      const res = await api<GuardianRecord | { error: string }>("/guardian/submit", {
        method: "POST",
        body,
        requireAuth: true,
      });

      if (res.ok) {
        setSuccess(true);
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

  return (
    <>
      <title>Guardian Consent Form — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Guardian Consent</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Guardian Consent Form</h1>
            <p className="mt-2 text-sm text-av-light-orange">
              As a guardian, please provide your details and ID to verify consent for this minor user.
            </p>
          </div>

          {existing?.status === "rejected" && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm font-semibold text-red-400">Previous submission was rejected</p>
              {existing.rejection_reason && (
                <p className="mt-1 text-xs text-red-300/70">Reason: {existing.rejection_reason}</p>
              )}
              <p className="mt-2 text-xs text-av-light-orange">Please submit a new form below.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Guardian Info */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Guardian Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Guardian full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="guardian@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Phone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="+234..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Relationship *</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Residential address"
                  />
                </div>
              </div>
            </section>

            {/* Verification Method */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Verification Method</h2>
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkExistingAccount}
                  onChange={(e) => setLinkExistingAccount(e.target.checked)}
                  className="h-4 w-4 rounded border-av-input-border accent-av-orange"
                />
                <div>
                  <p className="text-sm text-av-white">Link existing AfroVision account</p>
                  <p className="text-xs text-av-light-orange">If guardian has an existing verified account</p>
                </div>
              </label>

              {linkExistingAccount ? (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Guardian Account UID *</label>
                  <input
                    type="text"
                    value={accountUid}
                    onChange={(e) => setAccountUid(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Enter AfroVision UID"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-4">
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
                        placeholder="Guardian ID number"
                        required
                      />
                    </div>
                  </div>
                  <FileUploadBox
                    label="ID Front Image *"
                    uploaded={!!idFrontUrl}
                    uploading={uploadingField === "guardian_id_front"}
                    onSelect={(file) => uploadFile(file, setIdFrontUrl, "guardian_id_front")}
                    inputRef={idFrontRef}
                  />
                  <FileUploadBox
                    label="ID Back Image (optional)"
                    uploaded={!!idBackUrl}
                    uploading={uploadingField === "guardian_id_back"}
                    onSelect={(file) => uploadFile(file, setIdBackUrl, "guardian_id_back")}
                    inputRef={idBackRef}
                  />
                  <FileUploadBox
                    label="Selfie Photo *"
                    hint="Clear selfie matching guardian ID"
                    uploaded={!!selfieUrl}
                    uploading={uploadingField === "guardian_selfie"}
                    onSelect={(file) => uploadFile(file, setSelfieUrl, "guardian_selfie")}
                    inputRef={selfieRef}
                  />
                </div>
              )}
            </section>

            {/* Consent Declaration */}
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6">
              <h2 className="text-sm font-semibold text-av-white mb-4">Consent Declaration</h2>
              <p className="text-xs text-av-light-orange leading-relaxed mb-4">
                I, the undersigned, declare that I am the parent/legal guardian of this user and give consent for them to use the AfroVision platform with restricted access as a minor.
              </p>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">Type your full name as signature *</label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                  placeholder="Your full name"
                  required
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={submitting || !!uploadingField}
              className="w-full rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? "Submitting..." : "Submit Guardian Form"}
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
