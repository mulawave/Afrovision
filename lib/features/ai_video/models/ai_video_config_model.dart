class AiVideoEligibilityModel {
  const AiVideoEligibilityModel({
    required this.eligible,
    required this.code,
    required this.reason,
  });

  final bool eligible;
  final String code;
  final String? reason;

  factory AiVideoEligibilityModel.fromJson(Map<String, dynamic> json) {
    return AiVideoEligibilityModel(
      eligible: json['eligible'] == true,
      code: (json['code'] ?? 'UNKNOWN').toString(),
      reason: json['reason']?.toString(),
    );
  }
}

class AiVideoProviderSummaryModel {
  const AiVideoProviderSummaryModel({
    required this.providerKey,
    required this.enabled,
    required this.modelName,
    required this.supportsTextToVideo,
    required this.supportsImageToVideo,
    required this.supportsExtendVideo,
    required this.supportsUpscale,
  });

  final String providerKey;
  final bool enabled;
  final String modelName;
  final bool supportsTextToVideo;
  final bool supportsImageToVideo;
  final bool supportsExtendVideo;
  final bool supportsUpscale;

  factory AiVideoProviderSummaryModel.fromJson(Map<String, dynamic> json) {
    return AiVideoProviderSummaryModel(
      providerKey: (json['provider_key'] ?? '').toString(),
      enabled: json['enabled'] == true,
      modelName: (json['model_name'] ?? '').toString(),
      supportsTextToVideo: json['supports_text_to_video'] == true,
      supportsImageToVideo: json['supports_image_to_video'] == true,
      supportsExtendVideo: json['supports_extend_video'] == true,
      supportsUpscale: json['supports_upscale'] == true,
    );
  }
}

class AiVideoConfigModel {
  const AiVideoConfigModel({
    required this.enabled,
    required this.mode,
    required this.minimumCreatorPlan,
    required this.allowTextToVideo,
    required this.allowImageToVideo,
    required this.allowTemplateBased,
    required this.allowPostToWaves,
    required this.requireModerationBeforePublish,
    required this.dailyRequestLimit,
    required this.monthlyRequestLimit,
    required this.maxDurationSeconds,
    required this.maxResolution,
    required this.defaultProvider,
    required this.watermarkMode,
  });

  final bool enabled;
  final String mode;
  final String? minimumCreatorPlan;
  final bool allowTextToVideo;
  final bool allowImageToVideo;
  final bool allowTemplateBased;
  final bool allowPostToWaves;
  final bool requireModerationBeforePublish;
  final int dailyRequestLimit;
  final int monthlyRequestLimit;
  final int maxDurationSeconds;
  final String maxResolution;
  final String defaultProvider;
  final String watermarkMode;

  factory AiVideoConfigModel.fromJson(Map<String, dynamic> json) {
    return AiVideoConfigModel(
      enabled: json['enabled'] == true,
      mode: (json['mode'] ?? 'disabled').toString(),
      minimumCreatorPlan: json['minimum_creator_plan']?.toString(),
      allowTextToVideo: json['allow_text_to_video'] == true,
      allowImageToVideo: json['allow_image_to_video'] == true,
      allowTemplateBased: json['allow_template_based'] == true,
      allowPostToWaves: json['allow_post_to_waves'] == true,
      requireModerationBeforePublish:
          json['require_moderation_before_publish'] == true,
      dailyRequestLimit: (json['daily_request_limit'] as num?)?.toInt() ?? 0,
      monthlyRequestLimit:
          (json['monthly_request_limit'] as num?)?.toInt() ?? 0,
      maxDurationSeconds: (json['max_duration_seconds'] as num?)?.toInt() ?? 0,
      maxResolution: (json['max_resolution'] ?? '720p').toString(),
      defaultProvider: (json['default_provider'] ?? '').toString(),
      watermarkMode: (json['watermark_mode'] ?? '').toString(),
    );
  }
}

class AiVideoConfigResponseModel {
  const AiVideoConfigResponseModel({
    required this.config,
    required this.eligibility,
    required this.provider,
  });

  final AiVideoConfigModel config;
  final AiVideoEligibilityModel eligibility;
  final AiVideoProviderSummaryModel? provider;

  factory AiVideoConfigResponseModel.fromJson(Map<String, dynamic> json) {
    return AiVideoConfigResponseModel(
      config: AiVideoConfigModel.fromJson(
        json['config'] as Map<String, dynamic>? ?? const <String, dynamic>{},
      ),
      eligibility: AiVideoEligibilityModel.fromJson(
        json['eligibility'] as Map<String, dynamic>? ??
            const <String, dynamic>{},
      ),
      provider: json['provider'] is Map<String, dynamic>
          ? AiVideoProviderSummaryModel.fromJson(
              json['provider'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class AiVideoJobModel {
  const AiVideoJobModel({
    required this.id,
    required this.creatorUid,
    required this.requestType,
    required this.status,
    required this.provider,
    required this.providerJobId,
    required this.prompt,
    required this.negativePrompt,
    required this.durationSeconds,
    required this.aspectRatio,
    required this.resolution,
    required this.seed,
    required this.sourceImageUrl,
    required this.outputAssetUrl,
    required this.thumbnailUrl,
    required this.moderationStatus,
    required this.publishStatus,
    required this.waveId,
    required this.createdAt,
    required this.startedAt,
    required this.completedAt,
    required this.failedAt,
    required this.failureCode,
    required this.failureMessage,
    required this.updatedAt,
  });

  final String id;
  final String creatorUid;
  final String requestType;
  final String status;
  final String? provider;
  final String? providerJobId;
  final String prompt;
  final String negativePrompt;
  final int durationSeconds;
  final String aspectRatio;
  final String resolution;
  final String? seed;
  final String? sourceImageUrl;
  final String? outputAssetUrl;
  final String? thumbnailUrl;
  final String moderationStatus;
  final String publishStatus;
  final String? waveId;
  final int createdAt;
  final int? startedAt;
  final int? completedAt;
  final int? failedAt;
  final String? failureCode;
  final String? failureMessage;
  final int? updatedAt;

  factory AiVideoJobModel.fromJson(Map<String, dynamic> json) {
    return AiVideoJobModel(
      id: (json['id'] ?? '').toString(),
      creatorUid: (json['creator_uid'] ?? '').toString(),
      requestType: (json['request_type'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      provider: json['provider']?.toString(),
      providerJobId: json['provider_job_id']?.toString(),
      prompt: (json['prompt'] ?? '').toString(),
      negativePrompt: (json['negative_prompt'] ?? '').toString(),
      durationSeconds: (json['duration_seconds'] as num?)?.toInt() ?? 0,
      aspectRatio: (json['aspect_ratio'] ?? '16:9').toString(),
      resolution: (json['resolution'] ?? '720p').toString(),
      seed: json['seed']?.toString(),
      sourceImageUrl: json['source_image_url']?.toString(),
      outputAssetUrl: json['output_asset_url']?.toString(),
      thumbnailUrl: json['thumbnail_url']?.toString(),
      moderationStatus: (json['moderation_status'] ?? '').toString(),
      publishStatus: (json['publish_status'] ?? '').toString(),
      waveId: json['wave_id']?.toString(),
      createdAt: (json['created_at'] as num?)?.toInt() ?? 0,
      startedAt: (json['started_at'] as num?)?.toInt(),
      completedAt: (json['completed_at'] as num?)?.toInt(),
      failedAt: (json['failed_at'] as num?)?.toInt(),
      failureCode: json['failure_code']?.toString(),
      failureMessage: json['failure_message']?.toString(),
      updatedAt: (json['updated_at'] as num?)?.toInt(),
    );
  }
}

class AiVideoJobListResponseModel {
  const AiVideoJobListResponseModel({
    required this.jobs,
    required this.provider,
    required this.config,
  });

  final List<AiVideoJobModel> jobs;
  final AiVideoProviderSummaryModel? provider;
  final AiVideoConfigModel config;

  factory AiVideoJobListResponseModel.fromJson(Map<String, dynamic> json) {
    final rawJobs = json['jobs'];
    return AiVideoJobListResponseModel(
      jobs: rawJobs is List
          ? rawJobs
                .whereType<Map<String, dynamic>>()
                .map(AiVideoJobModel.fromJson)
                .toList()
          : const <AiVideoJobModel>[],
      provider: json['provider'] is Map<String, dynamic>
          ? AiVideoProviderSummaryModel.fromJson(
              json['provider'] as Map<String, dynamic>,
            )
          : null,
      config: AiVideoConfigModel.fromJson(
        json['config'] as Map<String, dynamic>? ?? const <String, dynamic>{},
      ),
    );
  }
}

class AiVideoSourceImageUploadModel {
  const AiVideoSourceImageUploadModel({
    required this.signedUrl,
    required this.publicUrl,
    required this.filename,
  });

  final String signedUrl;
  final String publicUrl;
  final String filename;

  factory AiVideoSourceImageUploadModel.fromJson(Map<String, dynamic> json) {
    return AiVideoSourceImageUploadModel(
      signedUrl: (json['signed_url'] ?? '').toString(),
      publicUrl: (json['public_url'] ?? '').toString(),
      filename: (json['filename'] ?? '').toString(),
    );
  }
}
