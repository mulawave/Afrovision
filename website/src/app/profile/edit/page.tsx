"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { api, apiFormData, getMeApi, type StoredUser, type ErrorResponse } from "@/lib/api";

export default function EditProfilePage() {
  const { isAuthenticated, user: authUser, isLoading, refreshUser } = useAuth();
  const [profile, setProfile] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    getMeApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "user" in res.data) {
        const u = (res.data as { user: StoredUser }).user;
        setProfile(u);
        setName(u.name || "");
        setEmail(u.email || "");
      }
      setLoading(false);
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
          <p className="text-sm text-av-hint">Sign in to edit your profile.</p>
          <Link href="/login?redirect=/profile/edit" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await apiFormData<{ user: StoredUser } | ErrorResponse>("/users/avatar", {
        body: formData,
        requireAuth: true,
      });
      if (res.ok && "user" in res.data) {
        const u = (res.data as { user: StoredUser }).user;
        setProfile(u);
        setSuccess("Avatar updated");
        refreshUser();
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Valid email is required");
      return;
    }

    setSaving(true);
    try {
      const res = await api<{ user: StoredUser } | ErrorResponse>("/users/update-profile", {
        method: "PUT",
        body: { name: trimmedName, email: trimmedEmail },
        requireAuth: true,
      });

      if (res.ok && "user" in res.data) {
        const u = (res.data as { user: StoredUser }).user;
        setProfile(u);
        setName(u.name || "");
        setEmail(u.email || "");
        setSuccess("Profile updated successfully");
        refreshUser();
      } else {
        const errData = res.data as ErrorResponse;
        setError(errData.error || "Failed to update profile");
      }
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <title>Edit Profile — AfroVision</title>
      <main className="min-h-screen pt-20 pb-16">
        <div className="max-w-xl mx-auto px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/profile" className="text-xs font-semibold text-av-orange hover:text-av-light-orange">
              ← Back to Profile
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-av-light-orange">Account</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Edit Profile</h1>
          </div>

          {/* Feedback */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-400">
              {success}
            </div>
          )}

          {/* Avatar Section */}
          <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 mb-6">
            <h2 className="text-sm font-semibold text-av-white mb-4">Profile Photo</h2>
            <div className="flex items-center gap-5">
              <div className="relative">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="rounded-full object-cover w-20 h-20"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-av-orange to-av-light-orange text-3xl font-bold text-av-dark-blue">
                    {(profile?.name || profile?.email || "?")[0]?.toUpperCase()}
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
                  {uploadingAvatar ? "Uploading..." : "Change Photo"}
                </button>
                <p className="mt-2 text-[10px] text-av-hint">JPG, PNG, or WebP. Max 5MB.</p>
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
          <form onSubmit={handleSave}>
            <section className="rounded-2xl border border-av-input-border/30 bg-av-card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-av-white">Account Details</h2>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-av-hint mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                  placeholder="Your display name"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-av-hint mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white placeholder-av-hint focus:border-av-orange/50 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-av-orange to-av-light-orange text-av-dark-blue transition-all hover:shadow-lg hover:shadow-av-orange/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
