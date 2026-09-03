"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const DIST_TOKEN_KEY = "av_dist_token";
const DIST_USER_KEY = "av_dist_user";

export interface DistributorUser {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  quota_total: number;
  quota_used: number;
  license_expires_at: string;
  license_fee_ngn: number;
  split_percent_afrovision: number | null;
  created_at: string;
}

interface DistributorAuthContextValue {
  distributor: DistributorUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshDistributor: () => Promise<void>;
}

const DistributorAuthContext = createContext<DistributorAuthContextValue | null>(null);

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DIST_TOKEN_KEY);
}

function getStoredDistributor(): DistributorUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(DIST_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function distApi<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/proxy${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem(DIST_TOKEN_KEY);
      localStorage.removeItem(DIST_USER_KEY);
    }
    return { ok: res.ok, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, data: { error: "Network request failed" } as T };
  }
}

export function DistributorAuthProvider({ children }: { children: ReactNode }) {
  const [distributor, setDistributor] = useState<DistributorUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDistributor = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    const res = await distApi<{ distributor: DistributorUser } | { error: string }>("/distribution/distributor/me");
    if (res.ok && "distributor" in res.data) {
      const d = res.data.distributor;
      setDistributor(d);
      localStorage.setItem(DIST_USER_KEY, JSON.stringify(d));
    } else {
      setDistributor(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setIsLoading(false);
      return;
    }
    setToken(t);
    const cached = getStoredDistributor();
    if (cached) setDistributor(cached);
    refreshDistributor().finally(() => setIsLoading(false));
  }, [refreshDistributor]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await distApi<{ token: string; distributor: DistributorUser } | { error: string }>(
      "/distribution/distributor/login",
      { method: "POST", body: { email, password } }
    );
    if (res.ok && "token" in res.data) {
      const { token: newToken, distributor: dist } = res.data;
      localStorage.setItem(DIST_TOKEN_KEY, newToken);
      localStorage.setItem(DIST_USER_KEY, JSON.stringify(dist));
      setToken(newToken);
      setDistributor(dist);
      return { ok: true };
    }
    const err = res.data as { error: string };
    return { ok: false, error: err.error || "Login failed" };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(DIST_TOKEN_KEY);
    localStorage.removeItem(DIST_USER_KEY);
    setDistributor(null);
    setToken(null);
  }, []);

  return (
    <DistributorAuthContext.Provider
      value={{
        distributor,
        token,
        isLoading,
        isAuthenticated: !!token && !!distributor,
        login,
        logout,
        refreshDistributor,
      }}
    >
      {children}
    </DistributorAuthContext.Provider>
  );
}

export function useDistributorAuth() {
  const ctx = useContext(DistributorAuthContext);
  if (!ctx) throw new Error("useDistributorAuth must be used within <DistributorAuthProvider>");
  return ctx;
}

export { distApi };
