"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type StoredUser,
  type AuthResponse,
  type ErrorResponse,
  getToken,
  getStoredUser,
  setAuth,
  clearAuth,
  loginApi,
  pakLoginApi,
  registerApi,
  getMeApi,
} from "@/lib/api";

interface AuthContextValue {
  user: StoredUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<{ ok: boolean; error?: string }>;
  pakLogin: (pak: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    referralCode?: string,
    captchaToken?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(() => !!getToken());

  // On mount: validate existing token against backend
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    getMeApi()
      .then((res) => {
        if (res.ok && "user" in res.data) {
          const freshUser = (res.data as { user: StoredUser }).user;
          setUser(freshUser);
          setAuth(token, freshUser); // Update cached user
        } else {
          // Token invalid — clear everything
          clearAuth();
          setUser(null);
        }
      })
      .catch(() => {
        // Network error — keep cached user to avoid logout on flaky connections
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const res = await loginApi(email, password, captchaToken);
    if (res.ok && "token" in res.data) {
      const authData = res.data as AuthResponse;
      setAuth(authData.token, authData.user);
      setUser(authData.user);
      return { ok: true };
    }
    const errorData = res.data as ErrorResponse;
    return { ok: false, error: errorData.error || "Login failed" };
  }, []);

  const pakLogin = useCallback(async (pak: string) => {
    const res = await pakLoginApi(pak);
    if (res.ok && "token" in res.data) {
      const authData = res.data as AuthResponse;
      setAuth(authData.token, authData.user);
      setUser(authData.user);
      return { ok: true };
    }
    const errorData = res.data as ErrorResponse;
    return { ok: false, error: errorData.error || "PAK login failed" };
  }, []);

  const register = useCallback(
    async (email: string, password: string, referralCode?: string, captchaToken?: string) => {
      const res = await registerApi(email, password, referralCode, captchaToken);
      if (res.ok && "token" in res.data) {
        // Backend returns token on register — auto-login
        const authData = res.data as AuthResponse;
        setAuth(authData.token, authData.user);
        setUser(authData.user);
        return { ok: true };
      }
      const errorData = res.data as ErrorResponse;
      return { ok: false, error: errorData.error || "Registration failed" };
    },
    []
  );

  const logout = useCallback(() => {
    // Match Flutter: just delete token, no backend call
    clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await getMeApi();
    if (res.ok && "user" in res.data) {
      const freshUser = (res.data as { user: StoredUser }).user;
      setUser(freshUser);
      setAuth(token, freshUser);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        pakLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
