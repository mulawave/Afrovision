"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  cancelAiVideoJobApi,
  getAiVideoConfigApi,
  getAiVideoJobsApi,
  retryAiVideoJobApi,
  type AiVideoConfigResponse,
  type AiVideoJob,
} from "@/lib/ai-video";

export default function CreatorStudioAiVideoPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [payload, setPayload] = useState<AiVideoConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AiVideoJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobActionId, setJobActionId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await getAiVideoConfigApi(user);
        if (!alive) return;
        if (!res.ok) {
          const message = typeof res.data === "object" && res.data && "error" in res.data
            ? res.data.error
            : "Failed to load AI video config";
          setError(message);
          setPayload(null);
          return;
        }
        setPayload(res.data as AiVideoConfigResponse);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load AI video config");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    if (!isAuthenticated) {
      setJobs([]);
      setJobsLoading(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        setJobsLoading(true);
        const res = await getAiVideoJobsApi();
        if (!alive) return;
        if (!res.ok) {
          const message = typeof res.data === "object" && res.data && "error" in res.data
            ? res.data.error
            : "Failed to load AI video jobs";
          setError(message);
          setJobs([]);
          return;
        }
        if ("jobs" in res.data) {
          setJobs(res.data.jobs || []);
        } else {
          setJobs([]);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load AI video jobs");
      } finally {
        if (alive) setJobsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  async function refreshJobs() {
    try {
      setJobsLoading(true);
      const res = await getAiVideoJobsApi();
      if (!res.ok) {
        const message = typeof res.data === "object" && res.data && "error" in res.data
          ? res.data.error
          : "Failed to load AI video jobs";
        setError(message);
        return;
      }
      if ("jobs" in res.data) {
        setJobs(res.data.jobs || []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI video jobs");
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleCancel(jobId: string) {
    try {
      setJobActionId(jobId);
      const res = await cancelAiVideoJobApi(jobId);
      if (!res.ok) {
        const message = typeof res.data === "object" && res.data && "error" in res.data
          ? res.data.error
          : "Failed to cancel AI video job";
        setError(message);
        return;
      }
      if ("job" in res.data) {
        const updatedJob = res.data.job;
        setJobs((prev) => prev.map((job) => (job.id === jobId ? updatedJob : job)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel AI video job");
    } finally {
      setJobActionId(null);
    }
  }

  async function handleRetry(jobId: string) {
    try {
      setJobActionId(jobId);
      const res = await retryAiVideoJobApi(jobId);
      if (!res.ok) {
        const message = typeof res.data === "object" && res.data && "error" in res.data
          ? res.data.error
          : "Failed to retry AI video job";
        setError(message);
        return;
      }
      if ("job" in res.data) {
        const updatedJob = res.data.job;
        setJobs((prev) => prev.map((job) => (job.id === jobId ? updatedJob : job)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry AI video job");
    } finally {
      setJobActionId(null);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-6 py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#F5C16C] border-t-transparent" />
      </div>
    );
  }

  const eligibility = payload?.eligibility;
  const config = payload?.config;
  const provider = payload?.provider;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#173A6D_0%,#050A30_100%)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-[#F5C16C]">Creator Studio</p>
              <h1 className="mt-3 text-4xl font-semibold">AI Video Generator</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68">
                Phase 1 web foundation is now wired to the backend feature config. Full generation,
                upload, queue management, and publish-to-Waves tooling land in the next implementation phases.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/72">
              {config?.enabled ? "Feature configured" : "Feature disabled"}
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-semibold">Login Required</h2>
            <p className="mt-3 text-sm text-white/65">You need to sign in with a creator account to access AI video tools.</p>
            <Link href="/login?redirect=/creator-studio/ai-video" className="mt-6 inline-flex rounded-full bg-[#F49617] px-6 py-3 text-sm font-semibold text-[#050A30]">
              Login to Continue
            </Link>
          </section>
        ) : error ? (
          <section className="rounded-[2rem] border border-red-300/20 bg-red-500/10 p-8 text-sm text-red-100">
            {error}
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-sm uppercase tracking-[0.24em] text-[#F5C16C]">Eligibility</h2>
                <div className="mt-4 text-2xl font-semibold">{eligibility?.eligible ? "Eligible" : "Blocked"}</div>
                <p className="mt-2 text-sm text-white/65">{eligibility?.reason || "You can proceed when the next phase UI is enabled."}</p>
              </article>
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-sm uppercase tracking-[0.24em] text-[#F5C16C]">Policy</h2>
                <div className="mt-4 space-y-2 text-sm text-white/72">
                  <div>Mode: <strong className="text-white">{config?.mode || "disabled"}</strong></div>
                  <div>Minimum plan: <strong className="text-white">{config?.minimum_creator_plan || "none"}</strong></div>
                  <div>Post to Waves: <strong className="text-white">{config?.allow_post_to_waves ? "Allowed" : "Blocked"}</strong></div>
                </div>
              </article>
              <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-sm uppercase tracking-[0.24em] text-[#F5C16C]">Provider</h2>
                <div className="mt-4 space-y-2 text-sm text-white/72">
                  <div>Name: <strong className="text-white">{provider?.provider_key || "n/a"}</strong></div>
                  <div>Model: <strong className="text-white">{provider?.model_name || "n/a"}</strong></div>
                  <div>Image to video: <strong className="text-white">{provider?.supports_image_to_video ? "Yes" : "No"}</strong></div>
                </div>
              </article>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <h2 className="text-2xl font-semibold">Next in Phase 2 and 3</h2>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-white/68">
                <li>Prompt studio with text-to-video and image-to-video modes</li>
                <li>Preset templates, limits, and generation queue states</li>
                <li>My AI Videos library with retry, preview, and Post to Waves handoff</li>
              </ul>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">My AI Video Jobs</h2>
                  <p className="mt-2 text-sm text-white/65">
                    This history is now backed by the real AI video job APIs. Generation creation UI lands next.
                  </p>
                </div>
                <button
                  onClick={refreshJobs}
                  disabled={jobsLoading}
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75 disabled:opacity-50"
                >
                  {jobsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {jobsLoading && jobs.length === 0 ? (
                <div className="mt-6 text-sm text-white/55">Loading jobs...</div>
              ) : jobs.length === 0 ? (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                  No AI video jobs yet. The next phase adds prompt entry, image upload, and create-job flow.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {jobs.map((job) => {
                    const canRetry = ["failed", "cancelled", "blocked"].includes(job.status);
                    const canCancel = ["draft", "queued", "submitted", "processing"].includes(job.status);
                    return (
                      <article key={job.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.22em] text-[#F5C16C]">{job.request_type.replaceAll("_", " ")}</div>
                            <div className="mt-2 text-lg font-semibold text-white">{job.prompt || "Prompt pending"}</div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70">{job.status}</span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-white/65">
                          <div>Duration: <strong className="text-white">{job.duration_seconds}s</strong></div>
                          <div>Resolution: <strong className="text-white">{job.resolution}</strong></div>
                          <div>Moderation: <strong className="text-white">{job.moderation_status}</strong></div>
                          <div>Created: <strong className="text-white">{new Date(job.created_at).toLocaleString()}</strong></div>
                          {job.failure_message ? <div className="text-rose-200">Failure: {job.failure_message}</div> : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={!canRetry || jobActionId === job.id}
                            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-white/80 disabled:opacity-40"
                          >
                            {jobActionId === job.id && canRetry ? "Working..." : "Retry"}
                          </button>
                          <button
                            onClick={() => handleCancel(job.id)}
                            disabled={!canCancel || jobActionId === job.id}
                            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-white/80 disabled:opacity-40"
                          >
                            {jobActionId === job.id && canCancel ? "Working..." : "Cancel"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
