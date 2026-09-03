"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api, apiFormData, type StoredUser, type ErrorResponse } from "@/lib/api";
import { LocationSelect } from "@/components/LocationSelect";
import { referralSources } from "@/lib/locations";

export default function ProfileSetupPage() {
  const { isAuthenticated, isLoading, user, refreshUser, kycRequired } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralSourceDetail, setReferralSourceDetail] = useState("");

  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/profile-setup");
      return;
    }
    if (user?.profile_setup_complete && user?.role !== "admin") {
      if (kycRequired) {
        router.replace("/kyc");
      } else {
        router.replace("/");
      }
      return;
    }
    if (user?.avatar_url) setAvatarUrl(user.avatar_url);
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.lastName) setLastName(user.lastName);
    if (user?.country) setCountry(user.country);
    if (user?.state) setStateVal(user.state);
    if (user?.city) setCity(user.city);
    if (user?.address) setAddress(user.address);
    if (user?.phoneNumber) setPhoneNumber(user.phoneNumber);
    if (user?.referralSource) setReferralSource(user.referralSource);
    if (user?.referralSourceDetail) setReferralSourceDetail(user.referralSourceDetail);
    setLoading(false);
  }, [isLoading, isAuthenticated, user, router, kycRequired, refreshUser]);

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await apiFormData<{ user: StoredUser } | ErrorResponse>("/users/avatar", {
        body: formData,
        requireAuth: true,
      });
      if (res.ok && "user" in res.data) {
        const u = (res.data as { user: StoredUser }).user;
        setAvatarUrl(u.avatar_url || null);
        await refreshUser();
      } else {
        const errData = res.data as ErrorResponse;
        setError(errData.error || "Failed to upload avatar");
      }
    } catch {
      setError("Avatar upload failed. Check your connection.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }
    if (!country) {
      setError("Country is required");
      return;
    }
    if (!stateVal) {
      setError("State is required");
      return;
    }
    if (!city) {
      setError("City is required");
      return;
    }
    if (!address.trim()) {
      setError("Address is required");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!referralSource) {
      setError("Please tell us how you heard about AfroVision");
      return;
    }
    if (referralSource === "Other, please specify" && !referralSourceDetail.trim()) {
      setError("Please tell us how you heard about AfroVision");
      return;
    }
    if (!avatarUrl) {
      setError("Profile picture is required");
      return;
    }

    setSaving(true);
    try {
      const res = await api<{ user: StoredUser } | ErrorResponse>("/users/update-profile", {
        method: "PUT",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country,
          state: stateVal,
          city,
          address: address.trim(),
          phoneNumber: phoneNumber.trim(),
          referralSource,
          referralSourceDetail: referralSource === "Other, please specify" ? referralSourceDetail.trim() : null,
          name: `${firstName.trim()} ${lastName.trim()}`,
        },
        requireAuth: true,
      });

      if (res.ok && "user" in res.data) {
        await refreshUser();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 5000);
      } else {
        const errData = res.data as ErrorResponse;
        setError(errData.error || "Failed to save profile");
      }
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
      </main>
    );
  }

  return (
    <>
      <title>Complete Your Profile — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Welcome to AfroVision</p>
            <h1 className="mt-3 text-3xl font-bold text-av-white">Complete Your Profile</h1>
            <p className="mt-2 text-sm text-av-hint">
              Fill in your details below to get started. This information is required to continue.
            </p>
          </div>

          {/* Success Toast */}
          {showSuccess && (
            <div className="fixed top-20 left-1/2 z-[100] -translate-x-1/2 animate-fade-in">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-[var(--av-dark-blue)] px-5 py-3 shadow-2xl">
                <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <p className="text-sm font-medium text-white">
                  Profile data updated successfully!
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Avatar Section */}
          <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 mb-6">
            <h2 className="text-sm font-semibold text-av-white mb-1">Profile Photo *</h2>
            <p className="text-[10px] text-av-hint mb-4">Upload a profile picture to continue</p>
            <div className="flex items-center gap-5">
              <div className="relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="rounded-full object-cover w-20 h-20"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-av-orange to-av-light-orange text-3xl font-bold text-av-dark-blue">
                    {(firstName || user?.email || "?")[0]?.toUpperCase()}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-av-orange border-t-transparent" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="rounded-full border border-av-orange/30 bg-av-orange/10 px-5 py-2 text-sm font-semibold text-av-orange hover:bg-av-orange/20 disabled:opacity-50"
                >
                  {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                </button>
                <p className="mt-2 text-[10px] text-av-light-orange">JPG, PNG, or WebP. Max 5MB.</p>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        setError("File too large. Max 5MB.");
                        return;
                      }
                      handleAvatarUpload(file);
                    }
                  }}
                />
              </div>
            </div>
          </section>

          {/* Profile Form */}
          <form onSubmit={handleSubmit}>
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-av-white">Personal Information</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <LocationSelect
                country={country}
                state={stateVal}
                city={city}
                onCountryChange={setCountry}
                onStateChange={setStateVal}
                onCityChange={setCity}
              />

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
                  Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                  placeholder="Street address, building, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                  placeholder="+234 800 000 0000"
                  required
                />
              </div>
            </section>

            {/* Referral Source */}
            <section className="mt-6 rounded-2xl border border-av-input-border/30 bg-av-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-av-white">How Did You Hear About AfroVision? *</h2>
              <div>
                <select
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                  required
                >
                  <option value="">Select an option</option>
                  {referralSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
              {referralSource === "Other, please specify" && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
                    Tell us how you heard about AfroVision *
                  </label>
                  <input
                    type="text"
                    value={referralSourceDetail}
                    onChange={(e) => setReferralSourceDetail(e.target.value)}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                    placeholder="Please specify..."
                    required
                  />
                </div>
              )}
            </section>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {saving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-av-dark-blue/30 border-t-av-dark-blue" />
              )}
              {saving ? "Saving..." : "Complete Profile"}
            </button>
          </form>

          {/* Success Message */}
          {showSuccess && (
            <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-300">Your profile has been saved!</p>
              <p className="mt-2 text-sm text-av-hint">
                You may proceed to exploring the rest of the website or download our app for a better experience.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push(kycRequired ? "/kyc" : "/")}
                  className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-2.5 text-sm font-semibold text-av-dark-blue hover:shadow-lg hover:shadow-av-orange/25 transition-all"
                >
                  {kycRequired ? "Continue to Verification" : "Explore AfroVision"}
                </button>
                <button
                  onClick={() => router.push("/download")}
                  className="rounded-full border border-av-orange/30 bg-av-orange/10 px-6 py-2.5 text-sm font-semibold text-av-orange hover:bg-av-orange/20 transition-all"
                >
                  Download App
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
