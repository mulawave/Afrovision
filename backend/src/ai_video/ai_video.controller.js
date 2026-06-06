const crypto = require('crypto');

const FeatureConfig = require('./ai_video_feature_config.model');
const ProviderConfig = require('./ai_video_provider_config.model');
const JobModel = require('./ai_video_job.model');
const PolicyService = require('./ai_video_policy.service');
const { generateSignedUploadUrl } = require('../utils/gcs');

const ALLOWED_REQUEST_TYPES = new Set([
  'text_to_video',
  'image_to_video',
  'template_based',
]);

const ALLOWED_ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1', '4:5']);

const IMAGE_CONTENT_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const RESOLUTION_ORDER = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
  '1440p': 4,
  '4k': 5,
};

function serializeProvider(provider) {
  if (!provider) return null;
  return {
    provider_key: provider.provider_key,
    enabled: provider.enabled,
    model_name: provider.model_name,
    supports_text_to_video: provider.supports_text_to_video,
    supports_image_to_video: provider.supports_image_to_video,
    supports_extend_video: provider.supports_extend_video,
    supports_upscale: provider.supports_upscale,
  };
}

function serializeConfig(config) {
  return {
    enabled: config.enabled,
    mode: config.mode,
    minimum_creator_plan: config.minimum_creator_plan,
    allow_text_to_video: config.allow_text_to_video,
    allow_image_to_video: config.allow_image_to_video,
    allow_template_based: config.allow_template_based,
    allow_post_to_waves: config.allow_post_to_waves,
    require_moderation_before_publish: config.require_moderation_before_publish,
    daily_request_limit: config.daily_request_limit,
    monthly_request_limit: config.monthly_request_limit,
    max_duration_seconds: config.max_duration_seconds,
    max_resolution: config.max_resolution,
    default_provider: config.default_provider,
    watermark_mode: config.watermark_mode,
  };
}

function serializeJob(job) {
  return {
    id: job.id,
    creator_uid: job.creator_uid,
    request_type: job.request_type,
    status: job.status,
    provider: job.provider,
    provider_job_id: job.provider_job_id,
    prompt: job.prompt,
    negative_prompt: job.negative_prompt,
    duration_seconds: job.duration_seconds,
    aspect_ratio: job.aspect_ratio,
    resolution: job.resolution,
    seed: job.seed,
    source_image_url: job.source_image_url,
    output_asset_url: job.output_asset_url,
    thumbnail_url: job.thumbnail_url,
    moderation_status: job.moderation_status,
    publish_status: job.publish_status,
    wave_id: job.wave_id,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    failed_at: job.failed_at,
    failure_code: job.failure_code,
    failure_message: job.failure_message,
    updated_at: job.updated_at || null,
  };
}

function resolveEligibilityStatus(eligibility) {
  if (eligibility.code === 'AUTH_REQUIRED') return 401;
  if (eligibility.code === 'CONFIG_INVALID') return 500;
  return 403;
}

function getResolutionRank(resolution) {
  return RESOLUTION_ORDER[String(resolution || '').toLowerCase()] || 0;
}

function validateCreatePayload(body, config, provider) {
  const requestType = String(body.request_type || 'text_to_video');
  if (!ALLOWED_REQUEST_TYPES.has(requestType)) {
    throw new Error('Invalid AI video request type');
  }

  if (!provider || !provider.enabled) {
    throw new Error('AI video provider is not available');
  }

  if (requestType === 'text_to_video' && !config.allow_text_to_video) {
    throw new Error('Text to video is disabled');
  }

  if (requestType === 'image_to_video' && !config.allow_image_to_video) {
    throw new Error('Image to video is disabled');
  }

  if (requestType === 'template_based' && !config.allow_template_based) {
    throw new Error('Template-based AI video is disabled');
  }

  if (requestType === 'text_to_video' && !provider.supports_text_to_video) {
    throw new Error('Configured AI provider does not support text to video');
  }

  if (requestType === 'image_to_video' && !provider.supports_image_to_video) {
    throw new Error('Configured AI provider does not support image to video');
  }

  const durationSeconds = Number(body.duration_seconds || 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('duration_seconds must be greater than 0');
  }

  if (durationSeconds > Number(config.max_duration_seconds || 0)) {
    throw new Error(`duration_seconds exceeds the configured maximum of ${config.max_duration_seconds}`);
  }

  const aspectRatio = String(body.aspect_ratio || '16:9');
  if (!ALLOWED_ASPECT_RATIOS.has(aspectRatio)) {
    throw new Error('Invalid aspect_ratio');
  }

  const resolution = String(body.resolution || config.max_resolution || '720p');
  if (!getResolutionRank(resolution)) {
    throw new Error('Invalid resolution');
  }

  if (getResolutionRank(resolution) > getResolutionRank(config.max_resolution)) {
    throw new Error(`resolution exceeds the configured maximum of ${config.max_resolution}`);
  }

  const prompt = String(body.prompt || '').trim();
  if ((requestType === 'text_to_video' || requestType === 'template_based') && !prompt) {
    throw new Error('prompt is required for this AI video request type');
  }

  const sourceImageUrl = body.source_image_url ? String(body.source_image_url).trim() : null;
  if (requestType === 'image_to_video' && !sourceImageUrl) {
    throw new Error('source_image_url is required for image to video');
  }

  return {
    requestType,
    prompt,
    negativePrompt: String(body.negative_prompt || '').trim(),
    durationSeconds,
    aspectRatio,
    resolution,
    seed: body.seed || null,
    sourceImageUrl,
  };
}

async function getRequestContext(req) {
  const [config, providers] = await Promise.all([
    FeatureConfig.get(),
    ProviderConfig.getAll(),
  ]);
  const eligibility = await PolicyService.evaluateAccess({
    user: req.user || null,
    config,
  });
  const provider = providers.find((entry) => entry.provider_key === config.default_provider) || null;

  return {
    config,
    provider,
    eligibility,
  };
}

async function requireEligibleCreator(req, res) {
  const context = await getRequestContext(req);
  if (!context.eligibility.eligible) {
    res.status(resolveEligibilityStatus(context.eligibility)).json({
      error: context.eligibility.reason,
      code: context.eligibility.code,
      eligibility: context.eligibility,
    });
    return null;
  }

  return context;
}

async function getOwnedJob(jobId, req, res) {
  const job = await JobModel.findById(jobId);
  if (!job) {
    res.status(404).json({ error: 'AI video job not found' });
    return null;
  }

  if (job.creator_uid !== req.userId && req.userRole !== 'admin') {
    res.status(403).json({ error: 'You do not have access to this AI video job' });
    return null;
  }

  return job;
}

async function getConfig(req, res) {
  try {
    const [config, providers] = await Promise.all([
      FeatureConfig.get(),
      ProviderConfig.getAll(),
    ]);
    const eligibility = await PolicyService.evaluateAccess({
      user: req.user || null,
      config,
    });

    const activeProvider = providers.find((provider) => provider.provider_key === config.default_provider) || null;

    return res.json({
      config: serializeConfig(config),
      provider: serializeProvider(activeProvider),
      eligibility,
    });
  } catch (error) {
    console.error('[AiVideo] getConfig:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listMyJobs(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    const jobs = await JobModel.listByCreatorUid(req.userId, {
      limit: req.query.limit,
    });

    return res.json({
      jobs: jobs.map(serializeJob),
      provider: serializeProvider(context.provider),
      config: serializeConfig(context.config),
    });
  } catch (error) {
    console.error('[AiVideo] listMyJobs:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getJob(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    const job = await getOwnedJob(req.params.id, req, res);
    if (!job) return;

    return res.json({
      job: serializeJob(job),
      provider: serializeProvider(context.provider),
      config: serializeConfig(context.config),
    });
  } catch (error) {
    console.error('[AiVideo] getJob:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createJob(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    const payload = validateCreatePayload(req.body || {}, context.config, context.provider);
    const job = await JobModel.createJob({
      creator_uid: req.userId,
      request_type: payload.requestType,
      status: 'queued',
      provider: context.provider.provider_key,
      prompt: payload.prompt,
      negative_prompt: payload.negativePrompt,
      duration_seconds: payload.durationSeconds,
      aspect_ratio: payload.aspectRatio,
      resolution: payload.resolution,
      seed: payload.seed,
      source_image_url: payload.sourceImageUrl,
      moderation_status: context.config.require_moderation_before_publish ? 'pending' : 'approved',
      publish_status: 'not_published',
    });

    return res.status(201).json({
      job: serializeJob(job),
      provider: serializeProvider(context.provider),
    });
  } catch (error) {
    console.error('[AiVideo] createJob:', error.message);
    return res.status(400).json({ error: error.message || 'Invalid AI video request' });
  }
}

async function cancelJob(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    const job = await getOwnedJob(req.params.id, req, res);
    if (!job) return;

    if (!['draft', 'queued', 'submitted', 'processing'].includes(job.status)) {
      return res.status(409).json({ error: `AI video job cannot be cancelled from status ${job.status}` });
    }

    const updated = await JobModel.updateJob(job.id, {
      status: 'cancelled',
      failed_at: null,
      failure_code: null,
      failure_message: null,
    });

    return res.json({ job: serializeJob(updated) });
  } catch (error) {
    console.error('[AiVideo] cancelJob:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function retryJob(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    const job = await getOwnedJob(req.params.id, req, res);
    if (!job) return;

    validateCreatePayload({
      request_type: job.request_type,
      prompt: job.prompt,
      negative_prompt: job.negative_prompt,
      duration_seconds: job.duration_seconds,
      aspect_ratio: job.aspect_ratio,
      resolution: job.resolution,
      seed: job.seed,
      source_image_url: job.source_image_url,
    }, context.config, context.provider);

    if (!['failed', 'cancelled', 'blocked'].includes(job.status)) {
      return res.status(409).json({ error: `AI video job cannot be retried from status ${job.status}` });
    }

    const updated = await JobModel.updateJob(job.id, {
      status: 'queued',
      provider: context.provider.provider_key,
      provider_job_id: null,
      started_at: null,
      completed_at: null,
      failed_at: null,
      failure_code: null,
      failure_message: null,
      moderation_status: context.config.require_moderation_before_publish ? 'pending' : job.moderation_status,
      publish_status: 'not_published',
    });

    return res.json({ job: serializeJob(updated) });
  } catch (error) {
    console.error('[AiVideo] retryJob:', error.message);
    return res.status(400).json({ error: error.message || 'AI video job retry failed' });
  }
}

async function getSourceImageUploadUrl(req, res) {
  try {
    const context = await requireEligibleCreator(req, res);
    if (!context) return;

    if (!context.config.allow_image_to_video) {
      return res.status(403).json({ error: 'Image to video is disabled', code: 'IMAGE_TO_VIDEO_DISABLED' });
    }

    if (!context.provider || !context.provider.supports_image_to_video) {
      return res.status(409).json({ error: 'Configured AI provider does not support image uploads' });
    }

    const contentType = String(req.body.content_type || '').trim().toLowerCase();
    const ext = IMAGE_CONTENT_TYPES[contentType];
    if (!ext) {
      return res.status(400).json({ error: `Unsupported image type: ${contentType}` });
    }

    const filename = `ai-video/source-images/${req.userId}/${crypto.randomUUID()}${ext}`;
    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, contentType, 30);

    return res.json({
      signed_url: signedUrl,
      public_url: publicUrl,
      filename,
    });
  } catch (error) {
    console.error('[AiVideo] getSourceImageUploadUrl:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getConfig,
  listMyJobs,
  getJob,
  createJob,
  cancelJob,
  retryJob,
  getSourceImageUploadUrl,
};
