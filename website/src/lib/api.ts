export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://afrovision-backend-134538542038.us-central1.run.app";

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
 * Core API client — attaches Bearer token to every authenticated request.
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
    // No token but auth required — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return { ok: false, status: 401, data: { error: "Not authenticated" } as T };
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // Handle 401 globally — token expired or invalid
  if (res.status === 401 && requireAuth && typeof window !== "undefined") {
    clearAuth();
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
    return { ok: false, status: 401, data: data as T };
  }

  return { ok: res.ok, status: res.status, data: data as T };
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
    if (typeof window !== "undefined") {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return { ok: false, status: 401, data: { error: "Not authenticated" } as T };
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && requireAuth && typeof window !== "undefined") {
    clearAuth();
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
    return { ok: false, status: 401, data: data as T };
  }

  return { ok: res.ok, status: res.status, data: data as T };
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
  subscription_status: "inactive" | "active" | "expired";
  subscription_expiry: string | null;
  preferred_currency: string;
  vpt_balance: number;
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
  return api<{ user: StoredUser } | ErrorResponse>("/auth/me", {
    requireAuth: true,
  });
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
  vpt_units: number;
  ngn_balance: number;
}

export async function getGiftsApi() {
  return api<{ gifts: GiftItem[] }>("/interactions/gifts", {
    requireAuth: true,
  });
}

export async function getGiftWalletApi() {
  return api<{ wallet: GiftWallet }>("/interactions/wallet", {
    requireAuth: true,
  });
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
  type: "public" | "private";
  channel_number: number;
  logo_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  created_at: string;
  owner_id: string;
  owner_name: string;
  followers_count?: number;
  requires_payment?: boolean;
  entry_fee_type?: "vpt" | "ngn" | null;
  entry_fee_vpt_units?: number;
  entry_fee_ngn?: number;
  access_duration_minutes?: number;
  is_live?: boolean;
  viewer_count?: number;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  is_active?: boolean;
}

export async function getChannelApi(id: string) {
  return api<{ channel: Channel } | ErrorResponse>(`/channels/${id}`, {
    requireAuth: true,
  });
}

export async function getChannelsApi() {
  return api<{ channels: Channel[] }>("/channels/");
}

export async function getMyChannelsApi() {
  return api<{ channels: Channel[] } | ErrorResponse>("/channels/me", {
    requireAuth: true,
  });
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

export async function getCategoriesApi() {
  return api<{ categories: Category[] }>("/categories/");
}

export async function createChannelWithMediaApi(input: {
  name: string;
  description: string;
  category: string;
  type: "public" | "private";
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

  return apiFormData<{ channel: Channel } | ErrorResponse>(
    "/channels/create-with-media",
    {
      method: "POST",
      body: formData,
      requireAuth: true,
    }
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
  }>(`/broadcast/now-playing/${channelId}`, { requireAuth: true });
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

// ── Home API methods ───────────────────────────────────────

export async function getHomeStatsApi() {
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
    recent_channels: Channel[];
    promoted_channels: Channel[];
    stats: { total_channels: number; total_members: number };
  }>("/home/stats", { requireAuth: true });
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
}) {
  const params = new URLSearchParams();
  if (options?.scope) params.set("scope", options.scope);
  if (options?.unreadOnly) params.set("unread_only", "1");
  if (options?.limit) params.set("limit", String(options.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return api<{ notifications: NotificationItem[]; unread_count: number }>(
    `/notifications/me${suffix}`,
    { requireAuth: true }
  );
}

export async function getNotificationUnreadCountApi() {
  return api<{ unread_count: number }>("/notifications/unread-count", {
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

export async function markAllNotificationsReadApi() {
  return api<{ updated: number; unread_count: number }>(
    "/notifications/mark-all-read",
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
