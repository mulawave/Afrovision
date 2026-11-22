"use client";

import { useEffect, useState } from "react";
import { clearAuth, getMeApi, setAuth, type StoredUser } from "@/lib/api";

const IMPERSONATION_STORAGE_KEY = "av_impersonation_user";

export default function ImpersonatePage() {
  const [status, setStatus] = useState("Signing in as user...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function activate() {
      try {
        const rawHash = window.location.hash.replace(/^#/, "");
        const hashParams = new URLSearchParams(rawHash);
        const queryParams = new URLSearchParams(window.location.search);
        const token =
          hashParams.get("token")?.trim() || queryParams.get("token")?.trim();

        if (!token) {
          setError(
            "Missing impersonation token. Please launch this link from the Admin Panel.",
          );
          return;
        }

        // Strip the token from the browser URL bar immediately.
        window.history.replaceState(null, "", "/impersonate");

        // Store token and validate against /auth/me to hydrate the target user profile.
        localStorage.setItem("av_token", token);
        const res = await getMeApi();
        if (cancelled) return;

        if (!res.ok || !("user" in res.data)) {
          clearAuth();
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
          setError("Impersonation token is invalid or expired.");
          return;
        }

        const user = (res.data as { user: StoredUser }).user;
        setAuth(token, user);
        localStorage.setItem(
          IMPERSONATION_STORAGE_KEY,
          JSON.stringify({
            id: user.id,
            email: user.email || "",
            name: user.name || "",
            role: user.role || "viewer",
          }),
        );

        setStatus(
          `Signed in as ${user.email || user.name || "user"}. Opening user account...`,
        );
        // Land directly on the user's account profile so the admin immediately
        // sees the user's account instead of the generic home page.
        window.location.replace("/profile");
      } catch (err) {
        if (!cancelled) {
          clearAuth();
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
          setError(
            err instanceof Error ? err.message : "Unable to start user session.",
          );
        }
      }
    }

    activate();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-av-card border border-av-input-border/40 p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-av-error mb-2">
              Session Failed
            </h1>
            <p className="text-sm text-av-light-orange mb-6">{error}</p>
            <a
              href="/login"
              className="inline-flex px-5 py-2.5 rounded-xl bg-av-orange text-av-dark-blue text-sm font-semibold"
            >
              Go to Login
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-av-orange/30 border-t-av-orange" />
            <h1 className="text-lg font-bold text-av-white mb-1">
              Admin Impersonation
            </h1>
            <p className="text-sm text-av-light-orange">{status}</p>
          </>
        )}
      </div>
    </main>
  );
}
