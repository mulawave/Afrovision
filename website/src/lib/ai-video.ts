import { api, type StoredUser } from "@/lib/api";

export interface AiVideoEligibility {
  eligible: boolean;
  code: string;
  reason: string | null;
}

export interface AiVideoConfig {
  enabled: boolean;
  mode: string;
  minimum_creator_plan: string | null;
  allow_text_to_video: boolean;
  allow_image_to_video: boolean;
  allow_template_based: boolean;
  allow_post_to_waves: boolean;
  require_moderation_before_publish: boolean;
  daily_request_limit: number;
  monthly_request_limit: number;
  max_duration_seconds: number;
  max_resolution: string;
  default_provider: string;
  watermark_mode: string;
}

export interface AiVideoProviderSummary {
  provider_key: string;
  enabled: boolean;
  model_name: string;
  supports_text_to_video: boolean;
  supports_image_to_video: boolean;
  supports_extend_video: boolean;
  supports_upscale: boolean;
}

export interface AiVideoConfigResponse {
  config: AiVideoConfig;
  provider: AiVideoProviderSummary | null;
  eligibility: AiVideoEligibility;
}

export interface AiVideoJob {
  id: string;
  creator_uid: string;
  request_type: string;
  status: string;
  provider: string | null;
  provider_job_id: string | null;
  prompt: string;
  negative_prompt: string;
  duration_seconds: number;
  aspect_ratio: string;
  resolution: string;
  seed: string | null;
  source_image_url: string | null;
  output_asset_url: string | null;
  thumbnail_url: string | null;
  moderation_status: string;
  publish_status: string;
  wave_id: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  failed_at: number | null;
  failure_code: string | null;
  failure_message: string | null;
  updated_at: number | null;
}

export interface AiVideoSourceImageUploadResponse {
  signed_url: string;
  public_url: string;
  filename: string;
}

export async function getAiVideoConfigApi(user?: StoredUser | null) {
  const res = await api<AiVideoConfigResponse | { error: string }>("/ai-video/config", {
    method: "GET",
    requireAuth: false,
  });

  return {
    ...res,
    user,
  };
}

export async function getAiVideoJobsApi() {
  return api<{ jobs: AiVideoJob[]; provider: AiVideoProviderSummary | null; config: AiVideoConfig } | { error: string }>("/ai-video/my-jobs", {
    method: "GET",
    requireAuth: true,
  });
}

export async function getAiVideoJobApi(jobId: string) {
  return api<{ job: AiVideoJob; provider: AiVideoProviderSummary | null; config: AiVideoConfig } | { error: string }>(`/ai-video/jobs/${jobId}`, {
    method: "GET",
    requireAuth: true,
  });
}

export async function createAiVideoJobApi(body: {
  request_type: string;
  prompt?: string;
  negative_prompt?: string;
  duration_seconds: number;
  aspect_ratio?: string;
  resolution?: string;
  seed?: string | null;
  source_image_url?: string | null;
}) {
  return api<{ job: AiVideoJob; provider: AiVideoProviderSummary | null } | { error: string }>("/ai-video/jobs", {
    method: "POST",
    requireAuth: true,
    body,
  });
}

export async function cancelAiVideoJobApi(jobId: string) {
  return api<{ job: AiVideoJob } | { error: string }>(`/ai-video/jobs/${jobId}/cancel`, {
    method: "POST",
    requireAuth: true,
    body: {},
  });
}

export async function retryAiVideoJobApi(jobId: string) {
  return api<{ job: AiVideoJob } | { error: string }>(`/ai-video/jobs/${jobId}/retry`, {
    method: "POST",
    requireAuth: true,
    body: {},
  });
}

export async function getAiVideoSourceImageUploadUrlApi(contentType: string) {
  return api<AiVideoSourceImageUploadResponse | { error: string }>("/ai-video/source-image/upload-url", {
    method: "POST",
    requireAuth: true,
    body: { content_type: contentType },
  });
}
