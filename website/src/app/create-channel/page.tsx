"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  createChannelWithMediaApi,
  getCategoriesApi,
  resolveSourceApi,
  updateExclusiveSettingsApi,
  updateExternalSourceApi,
  type Category,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type StreamSourceMode =
  | "external_url"
  | "external_youtube"
  | "external_hls"
  | "external_dash";

const SOURCE_MODES: { value: StreamSourceMode; label: string; desc: string }[] = [
  {
    value: "external_url",
    label: "External URL",
    desc: "Simple direct link (no strict validation)",
  },
  {
    value: "external_youtube",
    label: "YouTube Live",
    desc: "Link a YouTube live stream or video",
  },
  {
    value: "external_hls",
    label: "HLS Stream",
    desc: "Direct .m3u8 manifest URL",
  },
  {
    value: "external_dash",
    label: "DASH Stream",
    desc: "Direct .mpd manifest URL",
  },
];

export default function CreateChannelPage() {
  const { isAuthenticated, user, isMinor } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"public" | "private" | "exclusive">("public");
  const [exclusiveMonthlyFee, setExclusiveMonthlyFee] = useState("5000");
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);

  const [streamSourceMode, setStreamSourceMode] =
    useState<StreamSourceMode>("external_url");
  const [externalUrl, setExternalUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [detectedMode, setDetectedMode] = useState<StreamSourceMode | null>(
    null,
  );
  const lastValidationResult = useRef<null | {
    stream_status: string;
    resolved_playback_url: string;
    external_provider: string;
    provider_metadata: unknown;
    last_checked_at: string;
  }>(null);

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
    [user],
  );
  const canCreateExclusive = canCreatePrivate;

  async function handleValidateUrl() {
    const url = externalUrl.trim();
    if (!url) return;
    if (streamSourceMode === "external_url") {
      setUrlValidation({ ok: true, message: "URL accepted. Validation is not required for External URL mode." });
      setDetectedMode("external_url");
      return;
    }
    setValidating(true);
    setUrlValidation(null);
    setDetectedMode(null);

    const res = await resolveSourceApi(url);

    setValidating(false);
    if (res.ok && "stream_source_mode" in res.data) {
      const mode = res.data.stream_source_mode as StreamSourceMode;
      setDetectedMode(mode);
      setStreamSourceMode(mode);
      lastValidationResult.current = {
        stream_status: res.data.stream_status,
        resolved_playback_url: res.data.resolved_playback_url,
        external_provider: res.data.external_provider,
        provider_metadata: res.data.provider_metadata,
        last_checked_at: res.data.last_checked_at,
      };
      setUrlValidation({
        ok: true,
        message: `Valid ${sourceModeLabel(mode)} · Status: ${res.data.stream_status}`,
      });
    } else {
      const msg =
        "error" in res.data
          ? res.data.error
          : "URL could not be resolved. Check the format and try again.";
      setUrlValidation({ ok: false, message: msg });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !description.trim() || !category) {
      setError("Name, description, and category are required.");
      return;
    }
    if ((type === "private" && !canCreatePrivate) || (type === "exclusive" && !canCreateExclusive)) {
      setError("Only premium creators can create private or exclusive channels.");
      return;
    }
    if (type === "exclusive") {
      const fee = Number(exclusiveMonthlyFee);
      if (!Number.isFinite(fee) || fee <= 0) {
        setError("Enter a valid monthly entrance fee for the exclusive channel.");
        return;
      }
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

    if (!res.ok || !("channel" in res.data)) {
      setError("error" in res.data ? res.data.error : "Failed to create channel.");
      setSaving(false);
      return;
    }

    const channelId = res.data.channel.id;

    if (type === "exclusive") {
      const feeRes = await updateExclusiveSettingsApi(channelId, {
        monthly_fee_ngn: Number(exclusiveMonthlyFee),
      });
      if (!feeRes.ok) {
        setError(
          "Channel created, but exclusive monthly fee could not be saved. Update it in Creator Studio.",
        );
      }
    }

    if (externalUrl.trim()) {
      const lv = lastValidationResult.current;
      const extRes = await updateExternalSourceApi(channelId,
        lv && lv.stream_status
          ? {
              stream_source_mode: streamSourceMode,
              external_url: externalUrl.trim(),
              stream_status: lv.stream_status,
              resolved_playback_url: lv.resolved_playback_url,
              external_provider: lv.external_provider,
              provider_metadata: lv.provider_metadata as Record<string, unknown> | null,
              last_checked_at: lv.last_checked_at,
            }
          : { stream_source_mode: streamSourceMode, external_url: externalUrl.trim() },
      );
      if (!extRes.ok) {
        setError(
          "Channel created but stream URL could not be saved. Edit it later in Creator Studio.",
        );
      }
    }

    setSuccessLink(`/channel/${channelId}`);
    setName("");
    setDescription("");
    setType("public");
    setExclusiveMonthlyFee("5000");
    setLogo(null);
    setBanner(null);
    setStreamSourceMode("external_url");
    setExternalUrl("");
    setUrlValidation(null);
    setDetectedMode(null);
    setSaving(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-sm text-av-light-orange">Sign in to create a channel.</p>
          <Link
            href="/login?redirect=/create-channel"
            className="mt-4 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange"
          >
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  if (isMinor) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="max-w-md rounded-2xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">Create Channel</p>
          <h1 className="mt-3 text-2xl font-bold text-av-white">Not available for minors</h1>
          <p className="mt-4 text-sm text-av-light-orange">Channel creation is restricted to users aged 18 and above.</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-av-orange hover:text-av-light-orange">
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (user?.role === "viewer") {
    return (
      <main className="min-h-screen px-6 pb-16 pt-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-av-input-border/30 bg-av-card p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
            Creator Access
          </p>
          <h1 className="mt-3 text-3xl font-bold text-av-white">
            Channel creation is reserved for creator accounts
          </h1>
          <p className="mt-4 text-sm text-av-light-orange">
            Your account is currently a viewer profile. Upgrade to a creator plan
            before creating public, private, or exclusive channels.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
            >
              Open profile
            </Link>
            <Link
              href="/wallet"
              className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-5 py-2.5 text-sm font-semibold text-av-dark-blue"
            >
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
              <p className="text-xs uppercase tracking-[0.3em] text-av-light-orange">
                Publishing
              </p>
              <h1 className="mt-2 text-3xl font-bold text-av-white">
                Create Channel
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-av-light-orange">
                Launch a polished public channel, premium private room, or premium exclusive access channel. Link a
                live stream URL or upload content in Creator Studio after creation.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/creator-studio"
                className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
              >
                Creator Studio
              </Link>
              <Link
                href="/channels"
                className="rounded-full border border-av-input-border/30 px-5 py-2.5 text-sm font-semibold text-av-light-orange hover:border-av-orange/40 hover:text-av-white"
              >
                Browse channels
              </Link>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-av-input-border/30 bg-av-card p-6"
            >
              <div className="grid gap-5">
                <Field label="Channel name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    className="h-12 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
                    placeholder="Afrobeats World"
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 py-3 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
                    placeholder="Tell members what makes this channel worth following."
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Category">
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      disabled={loading}
                      className="h-12 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
                    >
                      {categories.map((item) => (
                        <option key={item.id || item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Visibility">
                    <div className="w-full overflow-hidden rounded-xl border border-av-input-border/30 bg-av-input-fill p-1">
                      <div className="grid w-full grid-cols-3 gap-2">
                      {(["public", "private", "exclusive"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setType(value)}
                          disabled={(value === "private" && !canCreatePrivate) || (value === "exclusive" && !canCreateExclusive)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                            type === value
                              ? "bg-av-orange text-av-dark-blue"
                              : "text-av-light-orange"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {value}
                        </button>
                      ))}
                      </div>
                    </div>
                  </Field>
                </div>

                {type === "exclusive" ? (
                  <Field label="Exclusive Monthly Entrance Fee (NGN)">
                    <input
                      value={exclusiveMonthlyFee}
                      onChange={(event) => setExclusiveMonthlyFee(event.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="h-12 w-full rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange focus:border-av-orange/50 focus:outline-none"
                      placeholder="5000"
                    />
                  </Field>
                ) : null}

                <div className="rounded-2xl border border-av-input-border/30 bg-av-input-fill/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-av-light-orange">
                    Stream Source
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SOURCE_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setStreamSourceMode(m.value);
                          setUrlValidation(null);
                          setDetectedMode(null);
                        }}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          streamSourceMode === m.value
                            ? "border-av-orange/60 bg-av-orange/10 text-av-white"
                            : "border-av-input-border/30 text-av-light-orange hover:border-av-orange/30"
                        }`}
                      >
                        <p className="text-xs font-bold">{m.label}</p>
                        <p className="mt-0.5 text-[10px] leading-snug opacity-70">
                          {m.desc}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-av-light-orange">
                      {streamSourceMode === "external_url"
                        ? "External URL"
                        : streamSourceMode === "external_youtube"
                          ? "YouTube URL"
                          : streamSourceMode === "external_hls"
                            ? "HLS Manifest URL (.m3u8)"
                            : "DASH Manifest URL (.mpd)"}
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={externalUrl}
                        onChange={(e) => {
                          setExternalUrl(e.target.value);
                          setUrlValidation(null);
                          setDetectedMode(null);
                          lastValidationResult.current = null;
                        }}
                        placeholder={
                          streamSourceMode === "external_url"
                            ? "https://example.com/live/channel-link"
                            : streamSourceMode === "external_youtube"
                              ? "https://www.youtube.com/watch?v=..."
                              : "https://example.com/stream.m3u8"
                        }
                        className="h-11 flex-1 rounded-xl border border-av-input-border/30 bg-av-input-fill px-4 text-sm text-av-white placeholder:text-av-light-orange/50 focus:border-av-orange/50 focus:outline-none"
                      />
                      {streamSourceMode !== "external_url" && (
                        <button
                          type="button"
                          onClick={handleValidateUrl}
                          disabled={validating || !externalUrl.trim()}
                          className="h-11 whitespace-nowrap rounded-xl border border-av-orange/30 bg-av-orange/10 px-4 text-xs font-bold text-av-orange hover:bg-av-orange/20 disabled:opacity-40"
                        >
                          {validating ? "Checking..." : "Validate"}
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-av-light-orange/75">
                      Optional at creation. You can set or change stream source later in Creator Studio.
                    </p>
                    {urlValidation && (
                      <p
                        className={`mt-2 text-xs ${
                          urlValidation.ok ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {urlValidation.ok ? "OK" : "Error"} {urlValidation.message}
                        {detectedMode && detectedMode !== streamSourceMode && (
                          <span className="ml-1 text-av-light-orange">
                            (Mode updated to {sourceModeLabel(detectedMode)})
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-av-light-orange/50">
                      {streamSourceMode === "external_url"
                        ? "External URL mode accepts simple links directly with no strict source validation."
                        : "Only HTTPS sources are accepted. YouTube, HLS (.m3u8), and DASH (.mpd) are supported."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <FileField label="Logo" note="Square artwork works best.">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setLogo(event.target.files?.[0] || null)
                      }
                      className="block w-full text-sm text-av-white file:mr-4 file:rounded-full file:border-0 file:bg-av-orange file:px-4 file:py-2 file:font-semibold file:text-av-dark-blue"
                    />
                  </FileField>
                  <FileField
                    label="Banner"
                    note="Recommended for live and profile headers."
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setBanner(event.target.files?.[0] || null)
                      }
                      className="block w-full text-sm text-av-white file:mr-4 file:rounded-full file:border-0 file:bg-av-orange file:px-4 file:py-2 file:font-semibold file:text-av-dark-blue"
                    />
                  </FileField>
                </div>

                {error ? (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                    {error}
                  </p>
                ) : null}
                {successLink ? (
                  <p className="rounded-xl border border-av-orange/30 bg-av-orange/10 px-4 py-3 text-sm text-av-light-orange">
                    Channel created successfully. {" "}
                    <Link
                      href={successLink}
                      className="font-semibold text-av-light-orange"
                    >
                      Open channel →
                    </Link>
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={saving || loading}
                  className="rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-6 py-3 text-sm font-semibold text-av-dark-blue disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create channel"}
                </button>
              </div>
            </form>

            <section className="space-y-6">
              <InfoCard
                title="Stream source modes"
                copy="External URL accepts simple live links directly. YouTube Live, HLS, and DASH modes provide source-specific playback paths."
              />
              <InfoCard
                title="Publishing rules"
                copy="Public channels are listed in discovery immediately. Private channels stay hidden from listings and are only accessible through the channel number. Exclusive channels are only visible to logged-in users with adult KYC verification."
              />
              <InfoCard
                title="Premium private rooms"
                copy={
                  canCreatePrivate
                    ? "Your account can create private and exclusive channels right now."
                    : "Private and exclusive channels require a premium creator account. Public channels remain available to all creator accounts."
                }
              />
              <InfoCard
                title="Next steps"
                copy="After creation, open Creator Studio to configure continuous URL playback or upload videos and build a schedule."
              />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function sourceModeLabel(mode: string) {
  switch (mode) {
    case "external_youtube":
      return "YouTube";
    case "external_url":
      return "External URL";
    case "external_hls":
      return "HLS Stream";
    case "external_dash":
      return "DASH Stream";
    default:
      return "External URL";
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-av-light-orange">
        {label}
      </span>
      {children}
    </label>
  );
}

function FileField({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-av-input-border/30 bg-av-input-fill/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-av-light-orange">
        {label}
      </p>
      <p className="mt-1 text-xs text-av-light-orange">{note}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-3xl border border-av-input-border/30 bg-av-card p-6">
      <h2 className="text-lg font-semibold text-av-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-av-light-orange">{copy}</p>
    </div>
  );
}
