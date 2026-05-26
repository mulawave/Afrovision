const PRIMARY_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://afrovision-backend-134538542038.us-central1.run.app";

const API_BASE_CANDIDATES = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_API_BASE_URL,
      "https://afrovision-backend-134538542038.us-central1.run.app",
      "https://afrovision-backend-zoeqld5lsa-uc.a.run.app",
    ].filter((value): value is string => Boolean(value && value.trim()))
  )
);

export const API_BASE = PRIMARY_API_BASE;

// In the browser, route through Next.js /api/proxy to avoid CORS restrictions.
// Next.js rewrites /api/proxy/:path* to the backend, so requests are same-origin.
const BROWSER_PROXY_BASE = "/api/proxy";

async function fetchWithBackendFailover(
  path: string,
  init: RequestInit,
): Promise<Response> {
  // Browser: always go through the Next.js proxy (no CORS preflight needed).
  if (typeof window !== "undefined") {
    return fetch(BROWSER_PROXY_BASE + path, init);
  }

  // Server-side (SSR/RSC): direct backend with failover.
  const bases = [PRIMARY_API_BASE, ...API_BASE_CANDIDATES.filter((b) => b !== PRIMARY_API_BASE)];
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      return await fetch(base + path, init);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All backend endpoints failed");
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

interface FormDataOptions {
  method?: string;
  body: FormData;
  requireAuth?: boolean;
}

/**
 * Core API client - attaches Bearer token to every authenticated request.
 * Backend is the ONLY source of truth. Frontend never generates UIDs,
 * wallet data, or auth tokens.
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, requireAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Attach token if available
  const token = getToken();
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  } else if (requireAuth) {
    // No token - return 401 without redirecting. Callers handle this.
    return { ok: false, status: 401, data: { error: "Not authenticated" } as T };
  }

  try {
    const res = await fetchWithBackendFailover(path, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      next: { revalidate: 0 },
    });

    const data = await res.json().catch(() => ({}));

    // Handle 401 — token expired or invalid. Clear local auth but do NOT redirect.
    if (res.status === 401 && typeof window !== "undefined") {
      clearAuth();
    }

    return { ok: res.ok, status: res.status, data: data as T };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Network request failed" } as T,
    };
  }
}

export async function apiFormData<T = unknown>(
  path: string,
  options: FormDataOptions
): Promise<ApiResponse<T>> {
  const { method = "POST", body, requireAuth = false } = options;
  const requestHeaders: Record<string, string> = {};
  const token = getToken();

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  } else if (requireAuth) {
    return { ok: false, status: 401, data: { error: "Not authenticated" } as T };
  }

  try {
    const res = await fetchWithBackendFailover(path, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      next: { revalidate: 0 },
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && typeof window !== "undefined") {
      clearAuth();
    }

    return { ok: res.ok, status: res.status, data: data as T };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Network request failed" } as T,
    };
  }
}

// ── Token storage ──────────────────────────────────────────────

const TOKEN_KEY = "av_token";
const USER_KEY = "av_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Types matching backend response shapes ─────────────────────

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: "viewer" | "creator" | "admin";
  is_premium_creator: boolean;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  subscription_plan: string | null;
  subscription_plan_type?: "creator" | "viewer" | null;
  subscription_status: "inactive" | "active" | "expired";
  subscription_expiry: string | null;
  avatar_url: string | null;
  preferred_currency: string;
  vpt: number;
  bsc_address: string | null;
  first_subscription_at: string | null;
  following_creator_ids?: string[];
  following_creators_count?: number;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: StoredUser;
}

export interface ErrorResponse {
  error: string;
}

// ── Auth API methods ───────────────────────────────────────────

export async function loginApi(email: string, password: string, captchaToken?: string) {
  return api<AuthResponse | ErrorResponse>("/auth/login", {
    method: "POST",
    body: { email, password, captchaToken },
  });
}

export async function pakLoginApi(pak: string) {
  return api<AuthResponse | ErrorResponse>("/auth/pak-login", {
    method: "POST",
    body: { pak },
  });
}

export async function walletLoginApi(address: string) {
  return api<AuthResponse | ErrorResponse>("/auth/wallet-login", {
    method: "POST",
    body: { address },
  });
}

export async function registerApi(
  email: string,
  password: string,
  referralCode?: string,
  captchaToken?: string
) {
  const body: Record<string, string | undefined> = { email, password, captchaToken };
  if (referralCode) body.referral_code = referralCode;
  return api<AuthResponse | ErrorResponse>("/auth/register", {
    method: "POST",
    body,
  });
}

export async function getMeApi() {
  // Do NOT use requireAuth — this is a silent token validation.
  // The AuthContext handles 401 gracefully without redirect.
  const token = getToken();
  if (!token) return { ok: false, status: 401, data: { error: "Not authenticated" } as { user: StoredUser } | ErrorResponse };
  return api<{ user: StoredUser } | ErrorResponse>("/auth/me");
}

export async function forgotPasswordApi(email: string) {
  return api<{ message: string; resetToken?: string } | ErrorResponse>(
    "/auth/forgot-password",
    { method: "POST", body: { email } }
  );
}

export async function resetPasswordApi(token: string, password: string) {
  return api<{ message: string } | ErrorResponse>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
}

// ── Interaction API methods ────────────────────────────────

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  animation: string | null;
  currency: "vpt" | "ngn";
  vpt_units: number;
  naira_value: number;
  sort_order: number;
}

export interface GiftWallet {
  vpt: number;
  cash: number;
  coins: number;
  blockchain_tokens: string | null;
}

export interface CheckoutProvider {
  id: "paystack" | "flutterwave";
  label: string;
  enabled: boolean;
}

export interface CheckoutPayment {
  id: string;
  purpose: "platform_plan" | "wallet_topup";
  provider: "paystack" | "flutterwave";
  status: string;
  amount_ngn: number;
  balance_type?: "ngn" | "vpt" | null;
  plan_id?: string | null;
  billing_cycle?: "monthly" | "yearly" | null;
  reference?: string | null;
  checkout_url?: string | null;
  raw_status?: string | null;
  error?: string | null;
  verified_at?: number | null;
  applied_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface Plan {
  id: string;
  name: string;
  type: "creator" | "viewer";
  price: number;
  yearly_price?: number | null;
  currency: string;
  features: string[];
  display_labels: Record<string, string>;
  badge: string | null;
  reward_multiplier?: number | null;
  is_active: boolean;
}

const GIFTS_CACHE_TTL_MS = 5 * 60 * 1000;
const GIFTS_CACHE_KEY = "afrovision:gifts-cache";
let cachedGifts: GiftItem[] | null = null;
let cachedGiftsAt = 0;

export async function getPlansApi() {
  return api<{ plans: Plan[] }>("/subscriptions/plans");
}

export async function getCheckoutProvidersApi() {
  return api<{ providers: CheckoutProvider[] } | ErrorResponse>("/payments/providers", {
    requireAuth: true,
  });
}

export async function initializeCheckoutApi(input: {
  purpose: "platform_plan" | "wallet_topup";
  provider: "paystack" | "flutterwave";
  return_url?: string;
  planId?: string;
  billingCycle?: "monthly" | "yearly";
  amount_ngn?: number;
  balanceType?: "ngn" | "vpt";
}) {
  return api<{ payment: CheckoutPayment } | ErrorResponse>("/payments/checkout/initialize", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export async function verifyCheckoutApi(paymentId: string) {
  return api<{
    payment: CheckoutPayment;
    user: StoredUser | null;
    wallet: GiftWallet | null;
    plan: Plan | null;
  } | ErrorResponse>(`/payments/checkout/${paymentId}/verify`, {
    method: "POST",
    body: {},
    requireAuth: true,
  });
}

export async function getGiftsApi() {
  const now = Date.now();
  if (typeof window !== "undefined") {
    if (cachedGifts && now - cachedGiftsAt < GIFTS_CACHE_TTL_MS) {
      return { ok: true, status: 200, data: { gifts: cachedGifts } };
    }
    try {
      const raw = window.sessionStorage.getItem(GIFTS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; gifts: GiftItem[] };
        if (Array.isArray(parsed.gifts) && now - parsed.at < GIFTS_CACHE_TTL_MS) {
          cachedGifts = parsed.gifts;
          cachedGiftsAt = parsed.at;
          return { ok: true, status: 200, data: { gifts: parsed.gifts } };
        }
      }
    } catch {
      // ignore cache read errors
    }
  }

  const res = await api<{ gifts: GiftItem[] }>("/interactions/gifts", {
    requireAuth: true,
  });

  if (res.ok && "gifts" in res.data) {
    cachedGifts = res.data.gifts;
    cachedGiftsAt = now;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          GIFTS_CACHE_KEY,
          JSON.stringify({ at: cachedGiftsAt, gifts: cachedGifts }),
        );
      } catch {
        // ignore cache write errors
      }
    }
  }

  return res;
}

export async function getGiftWalletApi() {
  return api<{ wallet: GiftWallet }>("/interactions/wallet", {
    requireAuth: true,
  });
}

// ── Exchange rates & Ravens↔vPT conversion ────────────────

export interface ExchangeRates {
  vpt_raven_rate: number;
  raven_ngn_rate: number;
  vpt_price_ngn: number;
}

export async function getExchangeRatesApi() {
  return api<{ rates: ExchangeRates }>("/interactions/exchange/rates", {
    requireAuth: true,
  });
}

export async function exchangeAssetsApi(from: "ravens" | "vpt", to: "ravens" | "vpt", amount: number) {
  return api<{ message: string; wallet: { vpt: number; cash: number; coins: number } }>(
    "/interactions/exchange",
    {
      method: "POST",
      body: { from, to, amount },
      requireAuth: true,
    }
  );
}

// ── Reputation API ─────────────────────────────────────────

export interface Reputation {
  user_id: string;
  total_reps: number;
  level: number;
  total_gifting_ngn: number;
  total_gifting_vpt: number;
  community_pool_eligible: boolean;
  leaderboard_rank: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  total_reps: number;
  level: number;
}

export async function getMyReputationApi() {
  return api<{ reputation: Reputation } | ErrorResponse>("/reputation/me", {
    requireAuth: true,
  });
}

export async function getLeaderboardApi(limit = 50, offset = 0) {
  return api<{ leaderboard: LeaderboardEntry[]; limit: number; offset: number }>(
    `/reputation/leaderboard?limit=${limit}&offset=${offset}`
  );
}

export async function sendGiftApi(channelId: string, giftId: string) {
  return api<{
    message: string;
    gift_name: string;
    gift_icon: string;
    animation: string | null;
    sender_name: string;
  } | ErrorResponse>("/interactions/gifts/send", {
    method: "POST",
    body: { channel_id: channelId, gift_id: giftId },
    requireAuth: true,
  });
}

export async function sendReactionApi(channelId: string, emoji: string) {
  return api<{ message: string } | ErrorResponse>("/interactions/reactions", {
    method: "POST",
    body: { channel_id: channelId, emoji },
    requireAuth: true,
  });
}

export interface ChannelEvent {
  id: string;
  type: "reaction" | "gift";
  sender_name: string;
  sender_rep_level?: number;
  created_at: number;
  emoji?: string;
  gift_name?: string;
  gift_icon?: string;
  animation?: string | null;
}

export async function getChannelEventsApi(channelId: string) {
  return api<{ events: ChannelEvent[] }>(`/interactions/events/${channelId}`, {
    requireAuth: true,
  });
}

export async function getChannelEventsSinceApi(channelId: string, after: number) {
  return api<{ events: ChannelEvent[] }>(
    `/interactions/events/${channelId}?after=${after}`,
    { requireAuth: true }
  );
}

export interface LiveChatMessage {
  id: string;
  channel_id: string;
  sender_name: string;
  badge?: "mod" | "vip" | "sub" | null;
  text: string;
  created_at: number;
  is_own: boolean;
}

export async function getChatMessagesApi(channelId: string, limit = 75) {
  return api<{ messages: LiveChatMessage[] } | ErrorResponse>(
    `/interactions/chat/${channelId}/messages?limit=${limit}`,
    { requireAuth: true }
  );
}

// ── Channel API methods ────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  description: string;
  category: string;
  type: "public" | "private" | "exclusive";
  channel_number: number;
  logo_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  owner_name: string;
  owner_display_mode?: "show_owner" | "hide_owner" | "brand_only";
  owner_brand_name?: string | null;
  owner_details_visible?: boolean;
  public_owner_name?: string;
  followers_count?: number;
  requires_payment?: boolean;
  entry_fee_type?: "vpt" | "ngn" | null;
  entry_fee_vpt_units?: number;
  entry_fee_ngn?: number;
  access_duration_minutes?: number;
  is_live?: boolean;
  viewer_count?: number;
  is_premium_channel?: boolean;
  subscription_price_ngn?: number;
  subscription_interval_count?: number;
  subscription_interval_unit?: string;
  premium_elevation_status?: string;
  exclusive_monthly_fee_ngn?: number;
  exclusive_fee_currency?: string;
  exclusive_fee_last_updated_at?: string | null;
  exclusive_fee_last_updated_by?: string | null;
  // External stream source fields (AV-STR-002)
  stream_source_mode?: "native" | "external_url" | "external_youtube" | "external_hls" | "external_dash";
  external_provider?: string | null;
  external_url?: string | null;
  resolved_playback_url?: string | null;
  // stream_status: unknown | valid | live | scheduled | offline | invalid | access_denied
  stream_status?: string;
  last_checked_at?: string | null;
  provider_metadata?: Record<string, unknown> | null;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  is_active?: boolean;
}

const CHANNELS_CACHE_TTL_MS = 60 * 1000;
const CHANNELS_CACHE_KEY = "afrovision:channels-cache";
let cachedChannels: Channel[] | null = null;
let cachedChannelsAt = 0;

function clearChannelsCache() {
  cachedChannels = null;
  cachedChannelsAt = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(CHANNELS_CACHE_KEY);
    } catch {
      // ignore cache clear errors
    }
  }
}

export async function getChannelApi(id: string) {
  const direct = await api<{ channel: Channel } | ErrorResponse>(`/channels/${id}`);
  if (direct.ok) {
    return direct;
  }

  // Backward-compat fallback for deployments where /channels/:id is still auth-protected.
  if (direct.status === 401 || direct.status === 403) {
    const listRes = await getChannelsApi();
    if (listRes.ok && "channels" in listRes.data) {
      const matched = listRes.data.channels.find((channel) => channel.id === id);
      if (matched) {
        return { ok: true, status: 200, data: { channel: matched } };
      }
      return { ok: false, status: 404, data: { error: "Channel not found" } };
    }
  }

  return direct;
}

export async function getChannelsApi() {
  const now = Date.now();
  if (typeof window !== "undefined") {
    if (cachedChannels && now - cachedChannelsAt < CHANNELS_CACHE_TTL_MS) {
      return { ok: true, status: 200, data: { channels: cachedChannels } };
    }
    try {
      const raw = window.sessionStorage.getItem(CHANNELS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; channels: Channel[] };
        if (Array.isArray(parsed.channels) && now - parsed.at < CHANNELS_CACHE_TTL_MS) {
          cachedChannels = parsed.channels;
          cachedChannelsAt = parsed.at;
          return { ok: true, status: 200, data: { channels: parsed.channels } };
        }
      }
    } catch {
      // ignore cache read errors
    }
  }

  const res = await api<{ channels: Channel[] }>("/channels/");
  if (res.ok && "channels" in res.data) {
    cachedChannels = res.data.channels;
    cachedChannelsAt = now;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          CHANNELS_CACHE_KEY,
          JSON.stringify({ at: cachedChannelsAt, channels: cachedChannels }),
        );
      } catch {
        // ignore cache write errors
      }
    }
  }

  return res;
}

export async function getMyChannelsApi() {
  return api<{ channels: Channel[] } | ErrorResponse>("/channels/me", {
    requireAuth: true,
  });
}

export async function updateChannelApi(
  channelId: string,
  input: { name?: string; description?: string; category?: string },
) {
  const res = await api<{ channel: Channel } | ErrorResponse>(`/channels/${channelId}`, {
    method: "PATCH",
    body: input,
    requireAuth: true,
  });
  if (res.ok) clearChannelsCache();
  return res;
}

export async function uploadChannelMediaApi(
  channelId: string,
  mediaType: "logo" | "banner",
  file: File,
) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFormData<{ channel: Channel } | ErrorResponse>(
    `/channels/${channelId}/upload/${mediaType}`,
    {
      method: "POST",
      body: formData,
      requireAuth: true,
    },
  );
  if (res.ok) clearChannelsCache();
  return res;
}

export async function deleteChannelApi(channelId: string) {
  const res = await api<{ message: string } | ErrorResponse>(`/channels/${channelId}`, {
    method: "DELETE",
    requireAuth: true,
  });
  if (res.ok) clearChannelsCache();
  return res;
}

export async function getChannelByNumberApi(channelNumber: string) {
  return api<{ channel: Channel } | ErrorResponse>(`/channels/number/${channelNumber}`, {
    requireAuth: true,
  });
}

export async function getSubscriberFeedApi() {
  return api<{ channels: Channel[] }>("/channels/subscriber-feed", {
    requireAuth: true,
  });
}

export async function checkChannelAccessApi(channelId: string) {
  return api<{
    has_access: boolean;
    expires_at?: string;
    access_id?: string;
    reason?: string;
    entry_fee_type?: string;
    entry_fee_vpt_units?: number;
    entry_fee_ngn?: number;
    access_duration_minutes?: number;
  }>(`/channels/${channelId}/access`, { requireAuth: true });
}

export async function payForAccessApi(channelId: string) {
  return api<{
    has_access: boolean;
    expires_at?: number;
    access_id?: string;
  }>(`/channels/${channelId}/pay`, { method: "POST", requireAuth: true });
}

export async function recordChannelViewApi(channelId: string) {
  return api(`/channels/${channelId}/view`, { method: "POST", requireAuth: true });
}

export interface FollowStatus {
  followed: boolean;
  followers_count: number;
}

export async function getFollowStatusApi(creatorUid: string) {
  return api<FollowStatus | ErrorResponse>(`/users/follows/${creatorUid}`, {
    requireAuth: true,
  });
}

export async function followCreatorApi(creatorUid: string) {
  return api<FollowStatus | ErrorResponse>(`/users/follows/${creatorUid}`, {
    method: "POST",
    requireAuth: true,
  });
}

export async function unfollowCreatorApi(creatorUid: string) {
  return api<FollowStatus | ErrorResponse>(`/users/follows/${creatorUid}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function getChannelFollowStatusApi(channelId: string) {
  return api<FollowStatus | ErrorResponse>(`/users/channel-follows/${channelId}`, {
    requireAuth: true,
  });
}

export async function followChannelApi(channelId: string) {
  return api<FollowStatus | ErrorResponse>(`/users/channel-follows/${channelId}`, {
    method: "POST",
    requireAuth: true,
  });
}

export async function unfollowChannelApi(channelId: string) {
  return api<FollowStatus | ErrorResponse>(`/users/channel-follows/${channelId}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function getCategoriesApi() {
  return api<{ categories: Category[] }>("/categories/");
}

export async function createChannelWithMediaApi(input: {
  name: string;
  description: string;
  category: string;
  type: "public" | "private" | "exclusive";
  logo?: File | null;
  banner?: File | null;
}) {
  const formData = new FormData();
  formData.append("name", input.name);
  formData.append("description", input.description);
  formData.append("category", input.category);
  formData.append("type", input.type);
  if (input.logo) formData.append("logo", input.logo);
  if (input.banner) formData.append("banner", input.banner);

  const res = await apiFormData<{ channel: Channel } | ErrorResponse>(
    "/channels/create-with-media",
    {
      method: "POST",
      body: formData,
      requireAuth: true,
    }
  );
  if (res.ok) clearChannelsCache();
  return res;
}

export async function updateExclusiveSettingsApi(
  channelId: string,
  input: { monthly_fee_ngn: number },
) {
  return api<{ channel: Channel } | ErrorResponse>(
    `/channels/${channelId}/exclusive-settings`,
    {
      method: "PATCH",
      body: input,
      requireAuth: true,
    },
  );
}

export interface ExclusiveAccessStatusResponse {
  eligibleByKyc: boolean;
  hasActiveEntitlement: boolean;
  renewalRequired: boolean;
  expiresAt: string | null;
  monthlyFeeNgn?: number;
}

export interface ExclusivePurchaseResponse {
  has_access: boolean;
  access_id?: string;
  expires_at?: string;
  personal_identifier_code?: string;
  already_active?: boolean;
}

export interface ExclusivePicVerifyResponse {
  valid: boolean;
  expires_at?: string;
  access_id?: string;
}

export async function getExclusiveAccessStatusApi(channelId: string) {
  return api<ExclusiveAccessStatusResponse | ErrorResponse>(
    `/channels/${channelId}/exclusive/access-status`,
    { requireAuth: true },
  );
}

export async function purchaseExclusiveAccessApi(channelId: string) {
  return api<ExclusivePurchaseResponse | ErrorResponse>(
    `/channels/${channelId}/exclusive/purchase`,
    { method: "POST", requireAuth: true },
  );
}

export async function renewExclusiveAccessApi(channelId: string) {
  return api<ExclusivePurchaseResponse | ErrorResponse>(
    `/channels/${channelId}/exclusive/renew`,
    { method: "POST", requireAuth: true },
  );
}

export async function verifyExclusivePicApi(channelId: string, pic: string) {
  return api<ExclusivePicVerifyResponse | ErrorResponse>(
    `/channels/${channelId}/exclusive/verify-pic`,
    { method: "POST", body: { pic }, requireAuth: true },
  );
}

// ── External stream source API (AV-STR-002 / AV-STR-004) ──────────────────

/** Validates a URL against the resolver without persisting anything. */
export async function resolveSourceApi(url: string) {
  return api<{
    stream_source_mode: string;
    external_provider: string;
    external_url: string;
    resolved_playback_url: string;
    stream_status: string;
    provider_metadata?: Record<string, unknown>;
  } | ErrorResponse>("/channels/resolve-source", {
    method: "POST",
    body: { url },
    requireAuth: true,
  });
}

/** Updates the external stream source for a channel. The backend classifies
 *  and probes the URL, returning the enriched channel record. */
export async function updateExternalSourceApi(
  channelId: string,
  input: {
    stream_source_mode: string;
    external_url?: string | null;
    external_provider?: string | null;
    resolved_playback_url?: string | null;
    stream_status?: string | null;
    last_checked_at?: string | null;
    provider_metadata?: Record<string, unknown> | null;
  },
) {
  return api<{ channel: Channel } | ErrorResponse>(
    `/channels/${channelId}/external-source`,
    { method: "PATCH", body: input, requireAuth: true },
  );
}

/** Re-probes the currently configured source URL and refreshes stream_status. */
export async function recheckStreamHealthApi(channelId: string) {
  return api<{ channel: Channel } | ErrorResponse>(
    `/channels/${channelId}/recheck-source`,
    { method: "POST", requireAuth: true },
  );
}

// ── Referral API methods ───────────────────────────────────

export interface ReferralEarning {
  id: string;
  recipient_uid: string;
  source_uid: string;
  source_name: string | null;
  source_email: string | null;
  level: number;
  amount_ngn: number;
  amount_vpt_units: number;
  subscription_id: string;
  creator_uid: string;
  status?: string;
  created_at: number;
}

export interface ReferralDashboard {
  referral_code: string;
  invited_count: number;
  total_earnings_ngn: number;
  total_earnings_vpt_units: number;
  direct_referrals: {
    uid: string;
    name: string | null;
    email: string | null;
    joined_at: number | null;
  }[];
  upline: {
    level: number;
    uid: string;
    name: string | null;
    email: string | null;
  }[];
  earnings: ReferralEarning[];
  level_distribution: { level: number; percentage: number }[];
  ledger_summary?: {
    pending_ngn: number;
    pending_vpt_units: number;
    credited_ngn: number;
    credited_vpt_units: number;
  };
}

export async function getReferralDashboardApi() {
  return api<ReferralDashboard>("/referrals/dashboard", { requireAuth: true });
}

export async function getReferralCodeApi() {
  return api<{
    referral_code: string;
    invited_count: number;
    total_earnings_ngn: number;
    total_earnings_vpt_units: number;
  }>("/referrals/my-code", { requireAuth: true });
}

export interface CreatorWallet {
  id: string;
  user_id: string;
  bsc_address: string;
  status?: string;
  created_at: number;
  last_used_at?: number | null;
}

export interface LedgerEntry {
  id: string;
  type: string;
  uid: string;
  direction: "credit" | "debit";
  currency: "vpt" | "ngn";
  amount_vpt_units?: number;
  amount_ngn?: number;
  balance_before?: number;
  balance_after?: number;
  status?: string;
  reference_id?: string | null;
  channel_id?: string | null;
  created_at: number;
}

export async function getWalletApi() {
  return api<{ wallet: CreatorWallet } | ErrorResponse>("/wallet/me", {
    requireAuth: true,
  });
}

export async function createWalletApi() {
  return api<{ wallet: CreatorWallet } | ErrorResponse>("/wallet/create", {
    method: "POST",
    requireAuth: true,
  });
}

// ── External Wallet API ──────────────────────────────────

export interface ConnectedWallet {
  address: string;
  type: string;
  balances?: { bnb_balance: number; vpt: number; vpt_raw: string; address: string; token_address: string | null; token_configured: boolean };
}

export async function scanWalletBalanceApi(address: string) {
  return api<{ address: string; vpt_raw: string; vpt: number; bnb_balance: string } | ErrorResponse>(
    `/wallet/scan-balance/${encodeURIComponent(address)}`,
    { requireAuth: true }
  );
}

export async function importWalletAddressApi(address: string) {
  return api<{ message: string } | ErrorResponse>("/wallet/import-address", {
    method: "POST",
    body: { address },
    requireAuth: true,
  });
}

export async function connectExternalWalletApi(address: string, type: string) {
  return api<{ wallet: Record<string, unknown>; connected: ConnectedWallet } | ErrorResponse>("/wallet/connect-external", {
    method: "POST",
    body: { address, type },
    requireAuth: true,
  });
}

export async function disconnectExternalWalletApi() {
  return api<{ message: string } | ErrorResponse>("/wallet/disconnect-external", {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function getConnectedWalletApi() {
  return api<{ connected: ConnectedWallet | null } | ErrorResponse>("/wallet/connected?scan=true", {
    requireAuth: true,
  });
}

export async function transferToExternalApi(asset: string, amount: string, toAddress: string) {
  return api<{ message: string; tx_hash?: string } | ErrorResponse>("/wallet/transfer", {
    method: "POST",
    body: { asset, amount, to_address: toAddress },
    requireAuth: true,
  });
}

export async function getLedgerApi() {
  return api<{ ledger: LedgerEntry[] } | ErrorResponse>("/vpt/ledger", {
    requireAuth: true,
  });
}

export async function getVptBalanceApi() {
  return api<{ balance: number } | ErrorResponse>("/vpt/balance", {
    requireAuth: true,
  });
}

// ── Broadcast API methods ──────────────────────────────────

export async function getServerTimeApi() {
  return api<{ server_time: number }>("/broadcast/time");
}

export interface NowPlaying {
  program_id: string;
  channel_id: string;
  video_id: string;
  video_url: string;
  video_title: string;
  thumbnail_url: string | null;
  duration: number;
  start_time: number;
  end_time: number;
  position: number;
  is_loop: boolean;
}

export interface NextProgram {
  program_id: string;
  video_title: string;
  video_duration: number;
  thumbnail_url: string | null;
  start_time: number;
  end_time: number;
}

export async function getNowPlayingApi(channelId: string) {
  return api<{
    now_playing: NowPlaying | null;
    next_program: NextProgram | null;
    server_time: number;
  }>(`/broadcast/now-playing/${channelId}`);
}

export interface ScheduleProgram {
  id: string;
  channel_id: string;
  video_id: string;
  start_time: number;
  end_time: number;
  video_title: string;
  video_description: string;
  video_duration: number;
  video_thumbnail: string | null;
}

export async function getChannelScheduleApi(channelId: string) {
  return api<{ schedule: ScheduleProgram[] }>(
    `/broadcast/schedule/${channelId}`,
    { requireAuth: true }
  );
}

export interface ChannelVideo {
  id: string;
  creator_uid: string;
  channel_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: number;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  channelId: string;
  seriesId: string | null;
  seriesOrderIndex: number;
  contentType: "book" | "comic" | "magazine" | "other";
  title: string;
  subtitle: string | null;
  author: string;
  description: string;
  tags: string[];
  coverAssetUrl: string | null;
  readerAssetManifestUrl: string | null;
  totalPages: number;
  estimatedReadMinutes: number;
  status: "draft" | "published" | "archived";
}

export interface LibraryItemDetail {
  item: LibraryItem;
  progress: {
    currentSpreadIndex: number;
    currentPageLeft: number | null;
    currentPageRight: number | null;
    isCompleted: boolean;
  } | null;
  navigation: {
    previousItemId: string | null;
    nextItemId: string | null;
  };
}

export interface LibraryReaderManifestResponse {
  manifestUrl: string;
  itemId: string;
  totalPages: number;
}

export interface LibraryProgress {
  currentSpreadIndex: number;
  currentPageLeft: number | null;
  currentPageRight: number | null;
  isCompleted: boolean;
}

export interface LibraryBookmark {
  id: string;
  userId: string;
  channelId: string;
  itemId: string;
  spreadIndex: number;
  page: number | null;
  note: string | null;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface LibrarySeries {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  coverAssetUrl: string | null;
  sortIndex: number;
  status: "active" | "archived";
}

export async function createCreatorLibraryAssetUploadUrlApi(
  channelId: string,
  input: {
    assetType: "cover" | "manifest" | "reader_pdf" | "reader_page";
    contentType: string;
    fileName: string;
  },
) {
  return api<{ success: boolean; signed_url: string; public_url: string; filename: string }>(
    `/creator/channels/${channelId}/library/upload-url`,
    {
      method: "POST",
      body: {
        asset_type: input.assetType,
        content_type: input.contentType,
        file_name: input.fileName,
      },
      requireAuth: true,
    },
  );
}

export async function generateCreatorLibraryReaderManifestApi(
  channelId: string,
  input: {
    pdfUrl?: string;
    pageImageUrls?: string[];
  },
) {
  return api<{ success: boolean; manifest_url: string; pdf_url: string | null; total_pages: number }>(
    `/creator/channels/${channelId}/library/reader-assets/manifest`,
    {
      method: "POST",
      body: {
        pdf_url: input.pdfUrl,
        page_image_urls: input.pageImageUrls || [],
      },
      requireAuth: true,
    },
  );
}

export async function getChannelLibraryApi(channelId: string, params?: {
  page?: number;
  limit?: number;
  seriesId?: string;
  contentType?: "book" | "comic" | "magazine" | "other";
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.seriesId) query.set("seriesId", params.seriesId);
  if (params?.contentType) query.set("contentType", params.contentType);
  const qs = query.toString() ? `?${query.toString()}` : "";

  return api<{
    data: {
      items: LibraryItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  } | ErrorResponse>(`/channels/${channelId}/library${qs}`, {
    requireAuth: true,
  });
}

export async function getChannelLibraryItemDetailApi(channelId: string, itemId: string) {
  return api<{ data: LibraryItemDetail } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}`,
    { requireAuth: true },
  );
}

export async function getChannelLibraryReaderManifestApi(channelId: string, itemId: string) {
  return api<{ data: LibraryReaderManifestResponse } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/reader-manifest`,
    { requireAuth: true },
  );
}

export async function getChannelLibraryProgressApi(channelId: string, itemId: string) {
  return api<{ data: LibraryProgress } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/progress`,
    { requireAuth: true },
  );
}

export async function updateChannelLibraryProgressApi(
  channelId: string,
  itemId: string,
  payload: LibraryProgress,
) {
  return api<{ data: LibraryProgress } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/progress`,
    {
      method: "PUT",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function listChannelLibraryBookmarksApi(channelId: string, itemId: string) {
  return api<{ data: LibraryBookmark[] } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/bookmarks`,
    { requireAuth: true },
  );
}

export async function createChannelLibraryBookmarkApi(
  channelId: string,
  itemId: string,
  payload: { spreadIndex: number; page?: number; note?: string },
) {
  return api<{ data: LibraryBookmark } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/bookmarks`,
    {
      method: "POST",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function deleteChannelLibraryBookmarkApi(channelId: string, itemId: string, bookmarkId: string) {
  return api<{ success: boolean } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/bookmarks/${bookmarkId}`,
    {
      method: "DELETE",
      requireAuth: true,
    },
  );
}

export async function getChannelLibraryRecommendationsApi(channelId: string, limit = 5) {
  return api<{ data: LibraryItem[] } | ErrorResponse>(
    `/channels/${channelId}/library/recommendations?limit=${limit}`,
    { requireAuth: true },
  );
}

export async function getCreatorChannelLibraryItemsApi(channelId: string) {
  return api<{ success: boolean; data: LibraryItem[] } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items`,
    { requireAuth: true },
  );
}

export async function getCreatorChannelLibrarySeriesApi(channelId: string) {
  return api<{ success: boolean; data: LibrarySeries[] } | ErrorResponse>(
    `/creator/channels/${channelId}/library/series`,
    { requireAuth: true },
  );
}

export async function createCreatorChannelLibrarySeriesApi(
  channelId: string,
  payload: { title: string; description?: string; coverAssetUrl?: string },
) {
  return api<{ success: boolean; data: LibrarySeries } | ErrorResponse>(
    `/creator/channels/${channelId}/library/series`,
    {
      method: "POST",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function createCreatorChannelLibraryItemApi(
  channelId: string,
  payload: {
    title: string;
    subtitle?: string;
    author: string;
    description?: string;
    tags?: string[];
    contentType: "book" | "comic" | "magazine" | "other";
    totalPages: number;
    estimatedReadMinutes?: number;
    coverAssetUrl?: string;
    readerAssetManifestUrl?: string;
    seriesId?: string;
    seriesOrderIndex?: number;
    status?: "draft" | "published" | "archived";
  },
) {
  return api<{ success: boolean; data: LibraryItem } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items`,
    {
      method: "POST",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function updateCreatorChannelLibraryItemApi(
  channelId: string,
  itemId: string,
  payload: {
    title?: string;
    author?: string;
    description?: string;
    contentType?: "book" | "comic" | "magazine" | "other";
    totalPages?: number;
    coverAssetUrl?: string;
    readerAssetManifestUrl?: string;
    seriesId?: string | null;
    seriesOrderIndex?: number;
  },
) {
  return api<{ success: boolean; data: LibraryItem } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items/${itemId}`,
    {
      method: "PATCH",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function publishCreatorChannelLibraryItemApi(channelId: string, itemId: string) {
  return api<{ success: boolean; data: LibraryItem } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items/${itemId}/publish`,
    {
      method: "POST",
      requireAuth: true,
    },
  );
}

export async function archiveCreatorChannelLibraryItemApi(channelId: string, itemId: string) {
  return api<{ success: boolean; data: LibraryItem } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items/${itemId}/archive`,
    {
      method: "POST",
      requireAuth: true,
    },
  );
}

export async function deleteCreatorChannelLibraryItemApi(channelId: string, itemId: string) {
  return api<{ success: boolean; message: string } | ErrorResponse>(
    `/creator/channels/${channelId}/library/items/${itemId}`,
    {
      method: "DELETE",
      requireAuth: true,
    },
  );
}

export async function reorderCreatorChannelLibraryContentApi(
  channelId: string,
  payload: {
    items?: Array<{ itemId: string; seriesOrderIndex: number }>;
    series?: Array<{ seriesId: string; sortIndex: number }>;
  },
) {
  return api<{ success: boolean; message: string } | ErrorResponse>(
    `/creator/channels/${channelId}/library/order`,
    {
      method: "PATCH",
      body: payload,
      requireAuth: true,
    },
  );
}

export async function addChannelLibraryFavoriteApi(channelId: string, itemId: string) {
  return api<{ success: boolean } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/favorite`,
    {
      method: "POST",
      requireAuth: true,
    },
  );
}

export async function removeChannelLibraryFavoriteApi(channelId: string, itemId: string) {
  return api<{ success: boolean } | ErrorResponse>(
    `/channels/${channelId}/library/${itemId}/favorite`,
    {
      method: "DELETE",
      requireAuth: true,
    },
  );
}

export async function getChannelVideosApi(channelId: string) {
  return api<{ videos: ChannelVideo[] }>(
    `/broadcast/videos/channel/${channelId}`,
    { requireAuth: true }
  );
}

export async function getMyVideosApi() {
  return api<{ videos: ChannelVideo[] } | ErrorResponse>("/broadcast/videos/me", {
    requireAuth: true,
  });
}

/**
 * Get a signed GCS upload URL for direct browser-to-cloud upload.
 */
export async function getVideoUploadUrlApi(input: {
  contentType: string;
  fileName: string;
}) {
  return api<{ signed_url: string; public_url: string; filename: string } | ErrorResponse>(
    "/broadcast/videos/upload-url",
    {
      method: "POST",
      body: { content_type: input.contentType, file_name: input.fileName },
      requireAuth: true,
    }
  );
}

export interface VideoUploadSession {
  id: string;
  creator_uid: string;
  channel_id: string;
  title: string;
  description: string;
  duration: number;
  file_name: string | null;
  content_type: string;
  filename: string;
  public_url: string;
  upload_url: string | null;
  total_bytes: number;
  uploaded_bytes: number;
  status: "initiated" | "uploading" | "paused" | "failed" | "finalizing" | "completed" | "canceled";
  error: string | null;
  video_id: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
  completed_at?: number;
}

export async function createVideoResumableSessionApi(input: {
  channelId: string;
  title: string;
  description: string;
  duration?: number;
  fileName: string;
  fileSize: number;
  contentType: string;
}) {
  return api<{ session: VideoUploadSession } | ErrorResponse>(
    "/broadcast/videos/resumable-session",
    {
      method: "POST",
      body: {
        channel_id: input.channelId,
        title: input.title,
        description: input.description,
        duration: input.duration || 0,
        file_name: input.fileName,
        file_size: input.fileSize,
        content_type: input.contentType,
      },
      requireAuth: true,
    },
  );
}

export async function completeVideoResumableSessionApi(sessionId: string) {
  return api<{ session: VideoUploadSession; video: ChannelVideo } | ErrorResponse>(
    "/broadcast/videos/resumable-complete",
    {
      method: "POST",
      body: { session_id: sessionId },
      requireAuth: true,
    },
  );
}

export async function updateVideoUploadSessionProgressApi(
  sessionId: string,
  input: { uploadedBytes: number; status: "uploading" | "paused" | "failed"; error?: string | null },
) {
  return api<{ session: VideoUploadSession } | ErrorResponse>(
    `/broadcast/videos/upload-sessions/${sessionId}/progress`,
    {
      method: "PATCH",
      body: {
        uploaded_bytes: input.uploadedBytes,
        status: input.status,
        error: input.error ?? null,
      },
      requireAuth: true,
    },
  );
}

export async function getMyVideoUploadSessionsApi(channelId?: string) {
  const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : "";
  return api<{ sessions: VideoUploadSession[] } | ErrorResponse>(
    `/broadcast/videos/upload-sessions${query}`,
    {
      requireAuth: true,
    },
  );
}

export async function cancelVideoUploadSessionApi(sessionId: string) {
  return api<{ session: VideoUploadSession } | ErrorResponse>(
    `/broadcast/videos/upload-sessions/${sessionId}`,
    {
      method: "DELETE",
      requireAuth: true,
    },
  );
}

export async function deleteVideoUploadSessionApi(sessionId: string) {
  return api<{ success: boolean; session_id: string } | ErrorResponse>(
    `/broadcast/videos/upload-sessions/${sessionId}/purge`,
    {
      method: "DELETE",
      requireAuth: true,
    },
  );
}

function parseResumableRangeHeader(rangeHeader: string | null): number {
  if (!rangeHeader) return 0;
  const match = /bytes=0-(\d+)/i.exec(rangeHeader);
  if (!match) return 0;
  const end = parseInt(match[1], 10);
  if (!Number.isFinite(end) || end < 0) return 0;
  return end + 1;
}

export async function getGCSResumableUploadOffset(sessionUrl: string, totalBytes: number): Promise<number> {
  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes */${totalBytes}`,
      "Content-Length": "0",
    },
  });

  if (res.status === 200 || res.status === 201) return totalBytes;
  if (res.status === 308) {
    const rangeHeader = res.headers.get("Range") ?? res.headers.get("range");
    return parseResumableRangeHeader(rangeHeader);
  }

  throw new Error(`Unable to query resumable offset (${res.status})`);
}

export async function uploadFileToGCSResumable(
  sessionUrl: string,
  file: File,
  options?: {
    chunkSizeBytes?: number;
    startOffset?: number;
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
    onOffsetChange?: (offset: number) => void;
  },
): Promise<void> {
  const chunkSize = Math.max(256 * 1024, options?.chunkSizeBytes ?? 8 * 1024 * 1024);
  let offset = options?.startOffset ?? 0;

  if (offset <= 0) {
    offset = await getGCSResumableUploadOffset(sessionUrl, file.size);
  }

  if (options?.onProgress) {
    options.onProgress(file.size <= 0 ? 0 : Math.round((offset / file.size) * 100));
  }
  if (options?.onOffsetChange) {
    options.onOffsetChange(offset);
  }

  while (offset < file.size) {
    const endExclusive = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, endExclusive);
    const contentRange = `bytes ${offset}-${endExclusive - 1}/${file.size}`;

    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Range": contentRange,
      },
      body: chunk,
      signal: options?.signal,
    });

    if (res.status === 308) {
      const rangeHeader = res.headers.get("Range") ?? res.headers.get("range");
      const confirmedOffset = parseResumableRangeHeader(rangeHeader);
      offset = Math.max(confirmedOffset, endExclusive);
    } else if (res.status === 200 || res.status === 201) {
      offset = endExclusive;
    } else {
      throw new Error(`Resumable upload failed (${res.status})`);
    }

    if (options?.onOffsetChange) {
      options.onOffsetChange(offset);
    }
    if (options?.onProgress) {
      options.onProgress(Math.round((offset / file.size) * 100));
    }
  }
}

/**
 * Upload a file directly to GCS using a signed URL.
 * Returns a promise that resolves when upload finishes.
 * Calls `onProgress(0-100)` during upload.
 */
export function uploadFileToGCS(
  signedUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`GCS upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

/**
 * Register a video that was uploaded directly to GCS.
 */
export async function registerUploadedVideoApi(input: {
  channelId: string;
  title: string;
  description: string;
  duration?: number;
  videoUrl: string;
}) {
  return api<{ video: ChannelVideo } | ErrorResponse>("/broadcast/videos/register", {
    method: "POST",
    body: {
      channel_id: input.channelId,
      title: input.title,
      description: input.description,
      duration: input.duration || 0,
      video_url: input.videoUrl,
    },
    requireAuth: true,
  });
}

/**
 * Legacy multipart upload (kept as fallback).
 */
export async function uploadVideoApi(input: {
  channelId: string;
  title: string;
  description: string;
  duration?: number;
  file: File;
}) {
  const formData = new FormData();
  formData.append("channel_id", input.channelId);
  formData.append("title", input.title);
  formData.append("description", input.description);
  if (typeof input.duration === "number") {
    formData.append("duration", String(input.duration));
  }
  formData.append("video", input.file);

  return apiFormData<{ video: ChannelVideo } | ErrorResponse>("/broadcast/videos", {
    method: "POST",
    body: formData,
    requireAuth: true,
  });
}

export async function deleteVideoApi(videoId: string) {
  return api<{ message: string } | ErrorResponse>(`/broadcast/videos/${videoId}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function scheduleProgramApi(input: {
  channelId: string;
  videoId: string;
  startTime: number;
}) {
  return api<{ program: ScheduleProgram } | ErrorResponse>("/broadcast/schedule", {
    method: "POST",
    body: {
      channel_id: input.channelId,
      video_id: input.videoId,
      start_time: input.startTime,
    },
    requireAuth: true,
  });
}

export async function deleteProgramApi(programId: string) {
  return api<{ message: string } | ErrorResponse>(`/broadcast/schedule/${programId}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

/**
 * Schedule multiple videos sequentially — each program starts when the previous ends.
 */
export async function scheduleSequentialApi(input: {
  channelId: string;
  videoIds: string[];
  startTime: number;
}) {
  return api<{ programs: ScheduleProgram[] } | ErrorResponse>(
    "/broadcast/schedule/sequential",
    {
      method: "POST",
      body: {
        channel_id: input.channelId,
        video_ids: input.videoIds,
        start_time: input.startTime,
      },
      requireAuth: true,
    }
  );
}

// ── Upcoming Shows (cross-channel, public) ─────────────────

export interface UpcomingProgram {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_category: string;
  video_title: string;
  video_thumbnail: string | null;
  start_time: number;
  end_time: number;
}

export async function getUpcomingShowsApi() {
  return api<{ upcoming: UpcomingProgram[] }>("/broadcast/upcoming");
}

// ── Reminders ──────────────────────────────────────────────

export interface ProgramReminder {
  id: string;
  user_id: string;
  program_id: string;
  channel_id: string;
  program_title: string;
  channel_name: string;
  send_at: number;
  sent: boolean;
}

export async function getMyRemindersApi() {
  return api<{ reminders: ProgramReminder[] }>("/broadcast/reminders/me", {
    requireAuth: true,
  });
}

export async function setReminderApi(programId: string) {
  return api<{ reminder: ProgramReminder } | ErrorResponse>("/broadcast/reminders", {
    method: "POST",
    body: { program_id: programId },
    requireAuth: true,
  });
}

export async function removeReminderApi(programId: string) {
  return api<{ message: string } | ErrorResponse>(
    `/broadcast/reminders/${programId}`,
    {
      method: "DELETE",
      requireAuth: true,
    }
  );
}

// ── Creator Subscription API methods ───────────────────────

export interface CreatorSubscription {
  id: string;
  subscriber_uid: string;
  creator_uid: string;
  plan: string;
  currency: string;
  amount: number;
  status: string;
  subscribed_at: number;
  next_billing: number | null;
  creator_name?: string | null;
  creator_avatar_url?: string | null;
}

export async function subscribeToCreatorApi(
  creatorUid: string,
  currency?: "ngn" | "vpt"
) {
  return api<{ subscription: CreatorSubscription } | ErrorResponse>(
    "/subscriptions/creator/subscribe",
    {
      method: "POST",
      body: { creatorUid, currency },
      requireAuth: true,
    }
  );
}

export async function checkCreatorSubApi(creatorUid: string) {
  return api<{
    subscribed: boolean;
    subscription: CreatorSubscription | null;
  }>(`/subscriptions/creator/check/${creatorUid}`, { requireAuth: true });
}

export async function cancelCreatorSubApi(subscriptionId: string) {
  return api<{ subscription: CreatorSubscription } | ErrorResponse>(
    `/subscriptions/creator/${subscriptionId}/cancel`,
    { method: "DELETE", requireAuth: true }
  );
}

export async function getMyCreatorSubsApi() {
  return api<{ subscriptions: CreatorSubscription[] }>(
    "/subscriptions/creator/mine",
    { requireAuth: true }
  );
}

// ── Channel Subscription API methods ───────────────────────

export interface ChannelSubscription {
  id: string;
  subscriber_uid: string;
  channel_id: string;
  channel_name: string;
  channel_logo_url?: string | null;
  channel_banner_url?: string | null;
  channel_category?: string | null;
  channel_description?: string | null;
  currency: string | null;
  amount: number;
  vpt_equivalent: number;
  status: string;
  is_premium: boolean;
  interval_count: number;
  interval_unit: string;
  next_billing: number | null;
  subscribed_at: number;
}

export async function subscribeToChannelApi(channelId: string) {
  return api<{ subscription: ChannelSubscription } | ErrorResponse>(
    "/subscriptions/channel/subscribe",
    {
      method: "POST",
      body: { channelId },
      requireAuth: true,
    }
  );
}

export async function checkChannelSubApi(channelId: string) {
  return api<{
    subscribed: boolean;
    subscription: ChannelSubscription | null;
  }>(`/subscriptions/channel/check/${channelId}`, { requireAuth: true });
}

export async function cancelChannelSubApi(subscriptionId: string) {
  return api<{ subscription: ChannelSubscription } | ErrorResponse>(
    `/subscriptions/channel/${subscriptionId}/cancel`,
    { method: "DELETE", requireAuth: true }
  );
}

export async function getMyChannelSubsApi() {
  return api<{ subscriptions: ChannelSubscription[] }>(
    "/subscriptions/channel/mine",
    { requireAuth: true }
  );
}

export async function requestPremiumElevationApi(channelId: string) {
  return api<{ message: string; channel: Channel } | ErrorResponse>(
    `/channels/${channelId}/request-premium`,
    { method: "POST", requireAuth: true }
  );
}

// ── Home API methods ───────────────────────────────────────

export async function getHomeCommunityPoolApi() {
  return api<{
    community_pool: {
      total_vpt: number;
      total_ngn: number;
      vpt_rate: number;
      naira_equivalent: number;
      total_distributed_vpt: number;
      total_distributed_ngn: number;
      total_beneficiaries: number;
    };
  }>("/home/community-pool");
}

// ── Notification API methods ───────────────────────────────

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, string>;
  type: string;
  link: string | null;
  source: string | null;
  created_by: string | null;
  is_read: boolean;
  archived: boolean;
  read_at: number | null;
  archived_at: number | null;
  created_at: number;
}

export async function getNotificationsApi(options?: {
  scope?: "inbox" | "archived" | "all";
  unreadOnly?: boolean;
  limit?: number;
  type?: string;
  channelId?: string;
}) {
  const params = new URLSearchParams();
  if (options?.scope) params.set("scope", options.scope);
  if (options?.unreadOnly) params.set("unread_only", "1");
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.type) params.set("type", options.type);
  if (options?.channelId) params.set("channel_id", options.channelId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return api<{ notifications: NotificationItem[]; unread_count: number }>(
    `/notifications/me${suffix}`,
    { requireAuth: true }
  );
}

export async function getNotificationUnreadCountApi(options?: {
  type?: string;
  channelId?: string;
}) {
  const params = new URLSearchParams();
  if (options?.type) params.set("type", options.type);
  if (options?.channelId) params.set("channel_id", options.channelId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return api<{ unread_count: number }>(`/notifications/unread-count${suffix}`, {
    requireAuth: true,
  });
}

export async function markNotificationReadApi(id: string) {
  return api<{ notification: NotificationItem; unread_count: number }>(
    `/notifications/${id}/read`,
    { method: "PATCH", body: {}, requireAuth: true }
  );
}

export async function markNotificationUnreadApi(id: string) {
  return api<{ notification: NotificationItem; unread_count: number }>(
    `/notifications/${id}/unread`,
    { method: "PATCH", body: {}, requireAuth: true }
  );
}

export async function archiveNotificationApi(id: string) {
  return api<{ notification: NotificationItem; unread_count: number }>(
    `/notifications/${id}/archive`,
    { method: "PATCH", body: {}, requireAuth: true }
  );
}

export async function unarchiveNotificationApi(id: string) {
  return api<{ notification: NotificationItem; unread_count: number }>(
    `/notifications/${id}/unarchive`,
    { method: "PATCH", body: {}, requireAuth: true }
  );
}

export async function deleteNotificationApi(id: string) {
  return api<{ success: boolean; unread_count: number }>(`/notifications/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function markAllNotificationsReadApi(options?: {
  type?: string;
  channelId?: string;
}) {
  const params = new URLSearchParams();
  if (options?.type) params.set("type", options.type);
  if (options?.channelId) params.set("channel_id", options.channelId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return api<{ updated: number; unread_count: number }>(
    `/notifications/mark-all-read${suffix}`,
    { method: "POST", body: {}, requireAuth: true }
  );
}

export async function bulkNotificationActionApi(
  ids: string[],
  action: "read" | "unread" | "archive" | "unarchive" | "delete"
) {
  return api<{ updated: number; unread_count: number }>("/notifications/bulk", {
    method: "POST",
    body: { ids, action },
    requireAuth: true,
  });
}

export async function clearArchivedNotificationsApi() {
  return api<{ removed: number; unread_count: number }>(
    "/notifications/clear/archived",
    {
      method: "DELETE",
      requireAuth: true,
    }
  );
}

// ── Admin API methods ──────────────────────────────────────

export interface AdminDashboard {
  users: {
    total: number;
    admins: number;
    creators: number;
    viewers: number;
    premium: number;
  };
  channels: {
    total: number;
    active: number;
    disabled: number;
    public: number;
    private: number;
  };
  financial: Record<string, number>;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  updated_at?: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actor_id: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: number;
}

export async function getAdminDashboardApi() {
  return api<{ dashboard: AdminDashboard } | ErrorResponse>("/admin/dashboard", {
    requireAuth: true,
  });
}

export async function getAdminUsersApi() {
  return api<{ users: StoredUser[] } | ErrorResponse>("/admin/users", {
    requireAuth: true,
  });
}

export async function getAdminChannelsApi() {
  return api<{ channels: Channel[] } | ErrorResponse>("/admin/channels", {
    requireAuth: true,
  });
}

export async function getFeatureFlagsApi() {
  return api<{ flags: FeatureFlag[] } | ErrorResponse>("/admin/features", {
    requireAuth: true,
  });
}

export async function setFeatureFlagApi(key: string, enabled: boolean) {
  return api<{ flag: FeatureFlag } | ErrorResponse>("/admin/features", {
    method: "POST",
    body: { key, enabled },
    requireAuth: true,
  });
}

export async function getAuditLogsApi(limit = 50) {
  return api<{ logs: AuditLogItem[] } | ErrorResponse>(`/admin/audit?limit=${limit}`, {
    requireAuth: true,
  });
}

export async function sendUserNotificationApi(input: {
  userId: string;
  title: string;
  body: string;
  type?: string;
  link?: string;
}) {
  return api<{ success: boolean } | ErrorResponse>("/notifications/send-user", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export async function broadcastNotificationApi(input: {
  title: string;
  body: string;
  type?: string;
  link?: string;
}) {
  return api<{ success: boolean } | ErrorResponse>("/notifications/broadcast", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export async function disableAdminChannelApi(channelId: string) {
  return api<{ channel: Channel } | ErrorResponse>(`/admin/channels/${channelId}/disable`, {
    method: "POST",
    body: {},
    requireAuth: true,
  });
}

export async function enableAdminChannelApi(channelId: string) {
  return api<{ channel: Channel } | ErrorResponse>(`/admin/channels/${channelId}/enable`, {
    method: "POST",
    body: {},
    requireAuth: true,
  });
}

export async function updateAdminChannelNumberApi(channelId: string, channelNumber: number | string) {
  return api<{ channel: Channel } | ErrorResponse>(`/admin/channels/${channelId}/number`, {
    method: "PATCH",
    body: { channel_number: channelNumber },
    requireAuth: true,
  });
}

// ── Ad API methods ─────────────────────────────────────────

export interface Advertisement {
  id: string;
  advertiser_id: string;
  category: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url: string;
  click_url: string;
  duration: number;
  budget: number;
  spent: number;
  price_per_impression: number;
  target_channels: string[];
  start_date: number | null;
  end_date: number | null;
  status: string;
  is_super_ad: boolean;
  impression_count: number;
  created_at: number;
  updated_at: number;
}

export interface AdImpression {
  id: string;
  ad_id: string;
  channel_id: string | null;
  category: string;
  viewer_count: number;
  cost: number;
  played_at: number;
}

export interface AdStats {
  total_impressions: number;
  total_viewers: number;
  total_cost: number;
  unique_channels: number;
}

export async function submitAdApi(data: {
  category: string;
  title: string;
  description?: string;
  media_url: string;
  thumbnail_url?: string;
  click_url?: string;
  duration?: number;
  budget: number;
  price_per_impression: number;
  target_channels?: string[];
  start_date?: string;
  end_date?: string;
}) {
  return api<Advertisement | ErrorResponse>("/ads", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

export async function getMyAdsApi() {
  return api<Advertisement[] | ErrorResponse>("/ads/me", {
    requireAuth: true,
  });
}

export async function getAdStatsApi(adId: string) {
  return api<{ ad: Advertisement; stats: AdStats } | ErrorResponse>(`/ads/${adId}/stats`, {
    requireAuth: true,
  });
}

export async function topUpAdBudgetApi(adId: string, amount: number) {
  return api<Advertisement | ErrorResponse>(`/ads/${adId}/budget`, {
    method: "PATCH",
    body: { amount },
    requireAuth: true,
  });
}

export async function pauseAdApi(adId: string) {
  return api<Advertisement | ErrorResponse>(`/ads/${adId}/pause`, {
    method: "PATCH",
    body: {},
    requireAuth: true,
  });
}

export async function getAdUploadUrlApi(contentType: string, fileName: string) {
  return api<{ signed_url: string; public_url: string; filename: string } | ErrorResponse>(
    "/ads/upload-url",
    {
      method: "POST",
      body: { content_type: contentType, file_name: fileName },
      requireAuth: true,
    }
  );
}

export async function serveBannerAdApi(placement: string, channelId?: string) {
  const params = new URLSearchParams({ placement });
  if (channelId) params.set("channel_id", channelId);
  return api<{ ad: Advertisement | null } | ErrorResponse>(`/ads/serve/banner?${params}`);
}

export async function serveInStreamAdsApi(channelId?: string) {
  const params = channelId ? `?channel_id=${channelId}` : "";
  return api<{ ads: Advertisement[] } | ErrorResponse>(`/ads/serve/stream${params}`);
}

export async function recordAdImpressionApi(adId: string, channelId?: string, viewerCount?: number) {
  return api<{ impression_id: string; cost: number; revenue_split: Record<string, number> } | ErrorResponse>(
    "/ads/impression",
    {
      method: "POST",
      body: { ad_id: adId, channel_id: channelId, viewer_count: viewerCount },
      requireAuth: true,
    }
  );
}

export interface AdvertiserAnalytics {
  overview: {
    total_ads: number;
    active_ads: number;
    total_budget: number;
    total_spent: number;
    remaining: number;
    total_impressions: number;
    total_viewers: number;
    avg_cost: number;
  };
  daily: { date: string; impressions: number; cost: number; viewers: number }[];
  per_ad: {
    id: string;
    title: string;
    category: string;
    status: string;
    budget: number;
    spent: number;
    impressions: number;
    viewers: number;
    cost: number;
    unique_channels: number;
  }[];
  categories: { category: string; impressions: number; cost: number; viewers: number }[];
}

export async function getMyAdAnalyticsApi() {
  return api<AdvertiserAnalytics | ErrorResponse>("/ads/my-analytics", {
    requireAuth: true,
  });
}

// ── Withdrawal API methods ─────────────────────────────────

export interface BankDetails {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

export interface Withdrawal {
  id: string;
  uid: string;
  amount: number;
  transaction_fee: number;
  service_charge: number;
  total_fees: number;
  vat_amount: number;
  vat_rate: number;
  total_debit: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  bank_details: BankDetails | null;
  created_at: number;
  processed_at: number | null;
}

export async function getMyWithdrawalsApi() {
  return api<{ withdrawals: Withdrawal[] } | ErrorResponse>("/withdrawals/", {
    requireAuth: true,
  });
}

export async function requestWithdrawalApi(amount: number) {
  return api<{ withdrawal: Withdrawal } | ErrorResponse>("/withdrawals/request", {
    method: "POST",
    body: { amount },
    requireAuth: true,
  });
}

export async function getMyBankDetailsApi() {
  return api<{ bank_details: BankDetails | null } | ErrorResponse>("/users/bank-details", {
    requireAuth: true,
  });
}

export interface BankOption {
  name: string;
  code: string;
  slug: string;
}

export interface ResolvedBankAccount {
  account_name: string;
  account_number: string;
  bank_code: string;
}

export async function getSupportedBanksApi() {
  return api<{ banks: BankOption[] } | ErrorResponse>("/users/bank-details/banks", {
    requireAuth: true,
  });
}

export async function resolveBankAccountApi(bankCode: string, accountNumber: string) {
  return api<ResolvedBankAccount | ErrorResponse>("/users/bank-details/resolve", {
    method: "POST",
    body: { bank_code: bankCode, account_number: accountNumber },
    requireAuth: true,
  });
}

export async function saveBankDetailsApi(data: {
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}) {
  return api<{ bank_details: BankDetails } | ErrorResponse>("/users/bank-details", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

// ── Creator Channel Analytics ──────────────────────────────

export interface ChannelAnalytics {
  channel_id: string;
  period: string;
  overview: {
    total_views: number;
    unique_viewers: number;
    peak_viewers: number;
    peak_hour: string;
    total_reactions: number;
    total_comments: number;
    total_gifts_count: number;
    total_gifts_ngn: number;
    total_gifts_vpt: number;
    weekly_views: number;
    monthly_views: number;
    yearly_views: number;
    best_day_views: number;
    best_day_date: string | null;
  };
  viewer_activity_by_hour: Array<{ hour: number; events: number }>;
  timeline: Array<{
    date: string;
    views: number;
    unique_viewers: number;
    gifts_ngn: number;
    gifts_vpt: number;
    streams: number;
  }>;
  demographics: {
    gender: Array<{ label: string; count: number; pct: number }>;
    age_groups: Array<{ label: string; count: number; pct: number }>;
    top_countries: Array<{ code: string; country: string; count: number; pct: number }>;
    total_identified: number;
  };
}

export async function getChannelAnalyticsApi(channelId: string, period: string) {
  return api<ChannelAnalytics | ErrorResponse>(
    `/analytics/creator/channel?channel_id=${encodeURIComponent(channelId)}&period=${encodeURIComponent(period)}`,
    { requireAuth: true }
  );
}

// ── Account Deletion ────────────────────────────────────────────

export interface DeletionRequest {
  id: string;
  scheduled_deletion_at: number;
  grace_period_days: number;
  created_at: number;
  reason?: string;
}

export async function requestAccountDeletionApi(reason: string, feedback: string) {
  return api<{ message: string; request: DeletionRequest } | ErrorResponse>(
    "/users/delete-account",
    { method: "POST", body: { reason, feedback }, requireAuth: true }
  );
}

export async function getDeletionStatusApi() {
  return api<{ has_pending_request: boolean; request?: DeletionRequest } | ErrorResponse>(
    "/users/delete-account",
    { requireAuth: true }
  );
}

export async function cancelAccountDeletionApi() {
  return api<{ message: string } | ErrorResponse>(
    "/users/delete-account",
    { method: "DELETE", requireAuth: true }
  );
}

// ── Subtitle API ──────────────────────────────────────────

export interface SubtitleFile {
  file_id: number;
  file_name: string;
}

export interface SubtitleResult {
  id: string;
  title: string;
  year: number | null;
  language: string;
  subtitle_id: string;
  files: SubtitleFile[];
  download_count: number;
  fps: number | null;
}

export async function searchSubtitlesApi(query: string, language = "en", year?: number) {
  const params = new URLSearchParams({ query, language });
  if (year) params.set("year", String(year));
  return api<{ subtitles: SubtitleResult[] } | ErrorResponse>(`/subtitles/search?${params.toString()}`);
}

export async function downloadSubtitleApi(fileId: number) {
  return api<{ link: string; file_name: string; requests: number; remaining: number } | ErrorResponse>(
    "/subtitles/download",
    { method: "POST", body: { file_id: fileId } },
  );
}

export function getSubtitleProxyUrl(rawUrl: string): string {
  // In the browser use the same-origin proxy to avoid CORS issues
  const base = typeof window !== "undefined" ? "/api/proxy" : (process.env.NEXT_PUBLIC_API_URL ?? "");
  return `${base}/subtitles/proxy?url=${encodeURIComponent(rawUrl)}`;
}

// ── (remaining exports) ────────────────────────────────────

export async function confirmImmediateDeletionApi(password: string) {
  return api<{ message: string } | ErrorResponse>(
    "/users/delete-account/confirm",
    { method: "POST", body: { password }, requireAuth: true }
  );
}

// ── Afrovision Wave API ────────────────────────────────────

export interface Wave {
  id: string;
  channel_id: string;
  creator_uid: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: number;
  pulse_count: number;
  comment_count: number;
  bookmark_count: number;
  pulse_score: number;
  status: "active" | "hidden" | "deleted" | "reported";
  created_at: number;
  views_count?: number;
  views?: number;
  total_views?: number;
  repeat_play_count?: number;
  is_bookmarked?: boolean;
}

export interface WaveComment {
  id: string;
  wave_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  text: string;
  created_at: number;
}

export interface WavePulseMoment {
  second: number;
  intensity_sum: number;
}

export async function getWaveFeedApi(limit = 20, cursor?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return api<{ waves: Wave[]; next_cursor: string | null }>(`/wave/feed?${params.toString()}`);
}

export async function getWaveApi(waveId: string) {
  return api<Wave | ErrorResponse>(`/wave/${waveId}`);
}

export async function getChannelWavesApi(channelId: string, options?: { includeHidden?: boolean }) {
  const params = new URLSearchParams();
  if (options?.includeHidden) params.set("include_hidden", "true");
  const query = params.toString();
  const path = query ? `/wave/channel/${channelId}?${query}` : `/wave/channel/${channelId}`;
  return api<Wave[] | ErrorResponse>(path);
}

export async function getWaveUploadUrlApi(channelId: string, contentType: string) {
  return api<{ signed_url: string; public_url: string; filename: string } | ErrorResponse>(
    "/wave/upload-url",
    { method: "POST", body: { channel_id: channelId, content_type: contentType }, requireAuth: true }
  );
}

export async function registerWaveApi(input: {
  channel_id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
}) {
  return api<Wave | ErrorResponse>("/wave/register", {
    method: "POST",
    body: input,
    requireAuth: true,
  });
}

export async function deleteWaveApi(waveId: string) {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function setWaveTimelineVisibilityApi(waveId: string, hidden: boolean) {
  return api<{ success: boolean; wave: Wave } | ErrorResponse>(`/wave/${waveId}/timeline-visibility`, {
    method: "POST",
    body: { hidden },
    requireAuth: true,
  });
}

export async function bulkDeleteWavesApi(waveIds: string[]) {
  return api<{
    success: boolean;
    requested_count: number;
    deleted_count: number;
    deleted_ids: string[];
    failed: Record<string, string>;
  } | ErrorResponse>(`/wave/bulk-delete`, {
    method: "POST",
    body: { wave_ids: waveIds },
    requireAuth: true,
  });
}

export async function bulkSetWaveTimelineVisibilityApi(waveIds: string[], hidden: boolean) {
  return api<{
    success: boolean;
    requested_count: number;
    updated_count: number;
    updated_ids: string[];
    hidden: boolean;
    failed: Record<string, string>;
  } | ErrorResponse>(`/wave/bulk-timeline-visibility`, {
    method: "POST",
    body: { wave_ids: waveIds, hidden },
    requireAuth: true,
  });
}

export async function addWavePulseApi(waveId: string, intensity: 1 | 2 | 3, momentSeconds: number) {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}/pulse`, {
    method: "POST",
    body: { intensity, moment_seconds: momentSeconds },
    requireAuth: true,
  });
}

export async function getWavePulseMomentsApi(waveId: string) {
  return api<{ moments: WavePulseMoment[]; duration: number } | ErrorResponse>(
    `/wave/${waveId}/pulses/moments`
  );
}

export async function getWaveCommentsApi(waveId: string) {
  return api<WaveComment[] | ErrorResponse>(`/wave/${waveId}/comments`);
}

export async function postWaveCommentApi(waveId: string, text: string) {
  return api<WaveComment | ErrorResponse>(`/wave/${waveId}/comments`, {
    method: "POST",
    body: { text },
    requireAuth: true,
  });
}

export async function deleteWaveCommentApi(waveId: string, commentId: string) {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}/comments/${commentId}`, {
    method: "DELETE",
    requireAuth: true,
  });
}

export async function trackWaveViewApi(waveId: string) {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}/view`, {
    method: "POST",
  });
}

export async function toggleWaveBookmarkApi(waveId: string) {
  return api<{ bookmarked: boolean } | ErrorResponse>(`/wave/${waveId}/bookmark`, {
    method: "POST",
    requireAuth: true,
  });
}

export async function getWaveBookmarkStatusApi(waveId: string) {
  return api<{ bookmarked: boolean } | ErrorResponse>(`/wave/${waveId}/bookmark`, {
    requireAuth: true,
  });
}

export async function getMyWaveBookmarksApi() {
  return api<Wave[] | ErrorResponse>("/wave/me/bookmarks", { requireAuth: true });
}

export async function setWaveInterestApi(waveId: string, signal: "interested" | "not_interested") {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}/interest`, {
    method: "POST",
    body: { signal },
    requireAuth: true,
  });
}

export async function reportWaveApi(waveId: string, reason: string) {
  return api<{ success: boolean } | ErrorResponse>(`/wave/${waveId}/report`, {
    method: "POST",
    body: { reason },
    requireAuth: true,
  });
}
