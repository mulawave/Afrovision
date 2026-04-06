"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createChannelWithMediaApi, getCategoriesApi, type Category } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function CreateChannelPage() {
  const { isAuthenticated, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCategoriesApi().then((res) => {
      if (cancelled) return;
      if (res.ok && "categories" in res.data) {
        setCategories(res.data.categories);
        setCategory(res.data.categories[0]?.name || "");
      } else {
        setError("Could not load categories.");
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const canCreatePrivate = useMemo(
    () => user?.role === "admin" || !!user?.is_premium_creator,
    [user]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !category) {
      setError("Name, description, and category are required.");
      return;
    }
    if (type === "private" && !canCreatePrivate) {
      setError("Only premium creators can create private channels.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessLink(null);

    const res = await createChannelWithMediaApi({
      name: name.trim(),
      description: description.trim(),
      category,
      type,
      logo,
      banner,
    });

    if (res.ok && "channel" in res.data) {
      setSuccessLink(`/channel/${res.data.channel.id}`);
      setName("");
      setDescription("");
      setType("public");
      setLogo(null);
      setBanner(null);
    } else {
      setError("error" in res.data ? res.data.error : "Failed to create channel.");
    }

    setSaving(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-hint">Sign in to create a channel.</p>
          <Link href="/login?redirect=/create-channel" className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (user?.role === "viewer") {
    return (
      <main className="min-h-screen px-6 pb-16 pt-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Creator Access</p>
          <h1 className="mt-3 text-3xl font-bold text-av-white">Channel creation is reserved for creator accounts</h1>
          <p className="mt-4 text-sm text-av-hint">
            Your account is currently a viewer profile. Upgrade to a creator plan before creating public or private channels.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/profile" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white">
              Open profile
            </Link>
            <Link href="/wallet" className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue">
              Review wallet and creator readiness
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <title>Create Channel — AfroVision</title>
      <main className="min-h-screen pb-16 pt-20">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Publishing</p>
            <h1 className="mt-2 text-3xl font-bold text-av-white">Create Channel</h1>
            <p className="mt-2 max-w-2xl text-sm text-av-hint">
              Launch a polished public channel or a premium private room. Add brand media now so the channel is ready for discovery and live playback immediately.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/creator-studio" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white">
              Creator Studio
            </Link>
            <Link href="/channels" className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-white/80 hover:border-av-orange/40 hover:text-av-white">
              Browse channels
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
            <div className="grid gap-5">
              <Field label="Channel name">
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="h-12 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-hint/60 focus:border-av-orange/50 focus:outline-none" placeholder="Afrobeats World" />
              </Field>

              <Field label="Description">
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={5} className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder:text-av-hint/60 focus:border-av-orange/50 focus:outline-none" placeholder="Tell members what makes this channel worth following." />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Category">
                  <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={loading} className="h-12 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none">
                    {categories.map((item) => (
                      <option key={item.id || item.name} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Visibility">
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-av-input-border/30 bg-av-input-fill p-1">
                    {(["public", "private"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        disabled={value === "private" && !canCreatePrivate}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${type === value ? "bg-av-orange text-av-dark-blue" : "text-av-white/70"} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FileField label="Logo" note="Square artwork works best.">
                  <input type="file" accept="image/*" onChange={(event) => setLogo(event.target.files?.[0] || null)} className="block w-full text-sm text-av-white file:mr-4 file:rounded-full file:border-0 file:bg-av-orange file:px-4 file:py-2 file:font-semibold file:text-av-dark-blue" />
                </FileField>
                <FileField label="Banner" note="Recommended for live and profile headers.">
                  <input type="file" accept="image/*" onChange={(event) => setBanner(event.target.files?.[0] || null)} className="block w-full text-sm text-av-white file:mr-4 file:rounded-full file:border-0 file:bg-av-orange file:px-4 file:py-2 file:font-semibold file:text-av-dark-blue" />
                </FileField>
              </div>

              {error ? <p className="rounded-xl border border-av-error/30 bg-av-error/5 px-4 py-3 text-sm text-av-error">{error}</p> : null}
              {successLink ? <p className="rounded-xl border border-av-orange/30 bg-av-orange/10 px-4 py-3 text-sm text-av-white/80">Channel created successfully. <Link href={successLink} className="font-semibold text-av-light-orange">Open channel →</Link></p> : null}

              <button type="submit" disabled={saving || loading} className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60">
                {saving ? "Creating..." : "Create channel"}
              </button>
            </div>
          </form>

          <section className="space-y-6">
            <InfoCard title="Publishing rules" copy="Public channels are listed in discovery immediately. Private channels stay hidden from listings and are only accessible through the channel number." />
            <InfoCard title="Premium private rooms" copy={canCreatePrivate ? "Your account can create private channels right now." : "Private channels require a premium creator account. Public channels remain available to all creator accounts."} />
            <InfoCard title="Next steps" copy="After creation, open Creator Studio to upload videos, build your schedule, and trigger go-live alerts for subscribers." />
          </section>
        </div>
      </div>
    </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-av-white/70">{label}</span>
      {children}
    </label>
  );
}

function FileField({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-input-fill/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-av-white/70">{label}</p>
      <p className="mt-1 text-xs text-av-hint">{note}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
      <h2 className="text-lg font-semibold text-av-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-av-hint">{copy}</p>
    </div>
  );
}
