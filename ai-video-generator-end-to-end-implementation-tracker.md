# AI Video Generator End-to-End Implementation Tracker

## 1. Feature Identity

- Feature Name: AI Video Generator
- Owner Team(s): Flutter App, Website, Backend/API, Admin Panel, Ops
- Primary Surfaces: Backend, Flutter, Website, Admin, Ops
- Related Tickets: ai-video-generator-phased-implementation-tickets.md
- Linked Tracker File: ai-video-generator-end-to-end-implementation-tracker.md

## 2. Objective

Deliver a new standalone AI Video Generator feature that allows eligible creators to generate AI videos from guided creation flows, manage generated outputs, and optionally post finished videos to Waves after generation is complete.

The feature must not be implemented as part of Waves. It is an independent creator feature with its own entry points, policies, jobs, storage, provider configuration, admin controls, and entitlement model. The only integration with Waves is a post-generation publishing handoff that lets a creator publish a completed AI-generated video into Waves.

The feature must be easy to use, premium in presentation, safe to operate, and fully governed by admin controls including provider/API configuration, rollout mode, feature enablement, policy gates, and minimum creator subscription required.

## 3. Completion Contract

Done means all of the following are complete across all layers:

1. Entry points and discovery surfaces
- Eligible creators can discover and open AI Video Generator from dedicated creator entry points.
- Eligible website creators can discover and open AI Video Generator from dedicated website creator entry points.
- Ineligible users see a clear gated upsell or unavailable state.
- Admin users can discover and manage the feature from a dedicated admin section.

2. Destination UX and interaction states
- Flutter includes generator home, creation flow, job status flow, output preview flow, history/library flow, and publish-to-Waves flow.
- Website includes generator landing, creation studio, job status flow, output preview flow, history/library flow, and publish-to-Waves flow.
- All loading, success, failure, blocked, disabled, empty, retry, and quota states are implemented.
- Admin includes settings, feature mode controls, provider configuration, limits, safety controls, and health visibility.

3. Backend/API/storage/state wiring
- Backend stores feature config, provider config, jobs, generated assets, moderation decisions, usage records, and publish linkage.
- Provider integration is abstracted behind a provider adapter layer.
- Generated outputs are stored in managed storage and served back to clients.

4. Navigation and deep links
- Flutter routes are added for generator discovery, generation flow, library/history, details, and publish handoff.
- Website routes are added for generator discovery, generation studio, library/history, details, and publish handoff.
- Admin routes are added for AI video overview and configuration.

5. Permissions, entitlement, validation, and edge cases
- Minimum creator subscription is enforced server-side.
- Feature availability mode is enforced server-side.
- Quotas, moderation blocks, provider outages, failed jobs, and duplicate submissions are handled.

6. Operational controls and management tooling
- Admin can enable or disable the feature.
- Admin can switch feature availability mode.
- Admin can set the minimum creator subscription required.
- Admin can configure provider credentials, base URLs, models, timeouts, limits, moderation behavior, and publish controls.

7. Notifications, alerts, analytics coverage
- Product analytics, operational telemetry, cost tracking, provider health, and failure alerts are implemented.

8. QA and rollout readiness
- Acceptance criteria and test matrix pass.
- Rollout and rollback steps are defined.
- Feature can be disabled without deployment.
- Website rollout, gating, analytics, and fallback states are also validated before release.

## 4. Business Rules (Source of Truth)

1. AI Video Generator is a standalone feature and must not be architected as part of Waves.
2. The only supported connection to Waves is posting a completed generated video to Waves.
3. A user must meet the minimum creator subscription required to use AI Video Generator.
4. Minimum creator subscription must be configurable in admin without code changes.
5. Admin must be able to fully enable or disable the feature without deployment.
6. Admin must be able to choose feature availability mode without deployment.
7. Feature availability mode must support at minimum:
- disabled
- internal_only
- pilot_whitelist
- eligible_creators_only
- open_beta
8. Feature access must be enforced server-side on every generation-related mutation.
9. Eligibility checks in Flutter are UX helpers only and must not be the source of truth.
10. Eligibility checks in website clients are UX helpers only and must not be the source of truth.
11. Generated assets may be previewed and managed independently of Waves.
12. A generated asset must be ready and policy-approved before it can be posted to Waves.
13. Provider failures must not crash the app or website; they must return normalized failure states.
14. The feature must support future provider switching; provider integration cannot be hardcoded into app logic.
15. Usage limits, moderation policy, and provider config must be centrally configurable.
16. Generated AI videos posted to Waves should carry AI-generated labeling by default unless product policy explicitly changes.
17. Website and Flutter must expose equivalent capability for all launch-critical creator flows unless explicitly documented otherwise.

## 5. Domain Model Changes

### New Entities

1. AiVideoFeatureConfig
- id
- enabled
- mode
- minimum_creator_plan
- allow_text_to_video
- allow_image_to_video
- allow_template_based
- allow_post_to_waves
- require_moderation_before_publish
- daily_request_limit
- monthly_request_limit
- max_duration_seconds
- max_resolution
- default_provider
- watermark_mode
- created_at
- updated_at
- updated_by

2. AiVideoProviderConfig
- provider_key
- enabled
- api_base_url
- api_key_secret_ref
- webhook_signing_secret_ref
- model_name
- timeout_seconds
- rate_limit_per_minute
- supports_text_to_video
- supports_image_to_video
- supports_extend_video
- supports_upscale
- cost_per_second
- created_at
- updated_at

3. AiVideoGenerationJob
- id
- creator_uid
- request_type
- status
- provider
- provider_job_id
- prompt
- negative_prompt
- duration_seconds
- aspect_ratio
- resolution
- seed
- source_image_url
- output_asset_url
- thumbnail_url
- moderation_status
- publish_status
- wave_id
- created_at
- started_at
- completed_at
- failed_at
- failure_code
- failure_message

4. AiVideoAsset
- id
- owner_uid
- job_id
- video_url
- thumbnail_url
- duration_seconds
- resolution
- aspect_ratio
- file_size_bytes
- ai_labeled
- moderation_status
- created_at

5. AiVideoTemplate
- id
- name
- description
- prompt_scaffold
- default_duration_seconds
- default_aspect_ratio
- enabled
- created_at
- updated_at

6. AiVideoUsageLedger
- id
- creator_uid
- period_key
- requests_used
- seconds_generated
- credits_used
- cost_estimate
- updated_at

7. AiVideoModerationDecision
- id
- job_id
- decision
- reasons
- reviewed_by
- reviewed_at

### Updated Entities

1. Wave creation linkage
- Add optional reference from generated asset/job to created wave id after successful publish.

### State Machines / Status Values

Generation job status:
- draft
- queued
- submitted
- processing
- succeeded
- failed
- blocked
- cancelled
- published_to_waves

Moderation status:
- pending
- approved
- blocked
- manual_review

Publish status:
- not_published
- ready_to_publish
- publishing
- published
- publish_failed

## 6. API Contracts

### Viewer / Creator APIs

1. GET /ai-video/config
- Returns public-facing config, supported modes, limits, and caller eligibility.

2. GET /ai-video/my-jobs
- Returns creator-owned jobs and assets.

3. GET /ai-video/jobs/:id
- Returns job detail, asset metadata, moderation state, and publish status.

4. POST /ai-video/jobs
- Creates a generation job after entitlement, policy, and quota checks.

5. POST /ai-video/jobs/:id/cancel
- Cancels a queued or processing job if supported.

6. POST /ai-video/jobs/:id/retry
- Retries a failed job if policy allows.

7. POST /ai-video/jobs/:id/post-to-waves
- Creates a Wave using a completed and allowed generated asset.

8. POST /ai-video/source-image/upload-url
- Returns signed upload info for image-to-video source assets.

9. GET /ai-video/templates
- Returns active creator-facing templates.

### Admin APIs

1. GET /admin/ai-video/config
2. PUT /admin/ai-video/config
3. GET /admin/ai-video/providers
4. PUT /admin/ai-video/providers/:providerKey
5. POST /admin/ai-video/providers/:providerKey/test
6. GET /admin/ai-video/jobs
7. GET /admin/ai-video/metrics
8. POST /admin/ai-video/templates
9. PUT /admin/ai-video/templates/:id
10. POST /admin/ai-video/jobs/:id/block
11. POST /admin/ai-video/jobs/:id/unblock

### Webhook / Provider APIs

1. POST /webhooks/ai-video/:providerKey
- Accepts provider status updates and output completion callbacks.

### Auth and Policy Checks

Every creator mutation route must enforce:
- authenticated user
- creator account status valid
- feature enabled
- mode access allowed for caller
- minimum creator subscription satisfied
- quota not exceeded
- provider available
- moderation rules satisfied

Every admin route must enforce admin authorization.

### Error Contract and Status Mapping

- FEATURE_DISABLED
- FEATURE_MODE_RESTRICTED
- MINIMUM_CREATOR_PLAN_REQUIRED
- PROVIDER_UNAVAILABLE
- USAGE_LIMIT_EXCEEDED
- PROMPT_BLOCKED
- MODERATION_REQUIRED
- GENERATION_FAILED
- ASSET_NOT_READY
- PUBLISH_TO_WAVES_FAILED

## 7. End-to-End User Flows

### 1. Discovery Flow

1. Eligible creator sees AI Video Generator entry in creator surfaces.
2. User opens generator home screen.
3. App requests feature config and eligibility state.
4. If eligible, creation modes and history are shown.
5. If ineligible, a subscription/availability gate is shown.

Website variant:
- Eligible website creators see AI Video Generator in website creator navigation, studio entry points, or creator dashboard surfaces.
- Website requests the same feature config and eligibility state before rendering creation controls.
- Website shows equivalent gated, disabled, or upgrade states when the feature is unavailable.

### 2. Primary Success Flow

1. Creator selects text-to-video, image-to-video, or template mode.
2. Creator enters prompt and settings.
3. App validates inputs and shows estimated limits/usage.
4. Creator submits generation request.
5. Backend creates and submits job to provider.
6. App shows queued and processing states.
7. Provider returns success.
8. Generated video preview becomes available.
9. Creator chooses Post to Waves.
10. Wave composer or publish bridge opens with generated asset preselected.
11. Creator confirms Wave details and publishes.
12. Job/asset records publish linkage to the created Wave.

Website variant:
- Creator completes the same flow from the website generation studio.
- Completed outputs can be previewed inline on web and handed off to the website Wave publishing surface with the AI-generated asset preselected.

### 3. Failure and Recovery Flow

1. Creator submits request.
2. Backend rejects due to plan, quota, moderation, or provider failure.
3. App shows precise failure state and recovery action.
4. Creator may upgrade, retry, edit prompt, or return later depending on cause.

Website variant:
- Website must preserve draft prompt/settings locally or server-side where appropriate so a refresh or redirect does not destroy creator work during recoverable failures.

### 4. Follow-up Action Flow

1. Creator opens My AI Videos.
2. Sees drafts, failed, processing, and completed outputs.
3. Can retry failed jobs, preview completed assets, or post completed assets to Waves.

Website variant:
- Website history/library must support filtering by status, viewing job detail, retrying failed jobs, and posting completed assets to Waves.

### 5. Lifecycle / Renewal / State Transition Flow

1. Creator uses feature while on eligible plan.
2. Creator subscription later drops below threshold.
3. Existing assets remain visible.
4. New generation requests are blocked.
5. Policy decides whether publish-to-Waves from old completed assets remains allowed.

Website variant:
- Existing website sessions must revalidate entitlement on key actions so stale sessions do not bypass minimum-plan enforcement.

## 8. Frontend Scope

### Website UX Scope

1. Dedicated website AI Video Generator landing page for eligible creators.
2. Dedicated website generation studio with prompt builder, model/settings panel, source-image upload, presets/templates, and usage indicator.
3. Website My AI Videos library page with status filters, detail drawer/page, retry, cancel, delete/archive if policy allows, and post-to-Waves action.
4. Website output preview experience with playable video, metadata, moderation status, and publish readiness.
5. Website gating and upsell surfaces for creators below the minimum required subscription.
6. Website disabled/unavailable states for feature-off and restricted-mode scenarios.
7. Website publish-to-Waves handoff flow using the completed generated asset.

Website implementation notes:
- Implement in the separate `website/` Next.js application.
- Add creator-facing routes under a dedicated AI video namespace rather than attaching the feature to existing Wave pages.
- Reuse the same backend APIs and policy model as Flutter so feature behavior stays consistent across platforms.
- Include responsive desktop and mobile-web layouts where the website currently supports both.

### Flutter UX Scope

1. Dedicated AI Video Generator entry point.
2. Dedicated generator home screen.
3. Creation flow for text-to-video, image-to-video, and templates.
4. Source image upload flow with local picker, progress, and preview.
5. Job processing and progress UI.
6. Asset preview and management UI.
7. My AI Videos history/library screen.
8. Publish-to-Waves handoff flow.
9. Eligibility/upgrade gate screen.

### Shared Design Rules and Reusable Components
- Must follow AfroVision premium design system.
- Must use AppColors.primaryGradient background.
- Must use shared reusable widgets where applicable.
- Must use premium animations and consistent premium styling.
- New reusable components should be added under lib/core/widgets if patterns repeat.

Website design rules:
- Website implementation must match the premium AfroVision creator experience rather than a generic dashboard tool.
- Website should define a coherent visual system for AI generation controls, queue states, and preview cards consistent with the website app’s design language.
- Website should support keyboard-friendly workflows and clear progressive disclosure for advanced model settings.

### Required UX States
- loading
- empty
- disabled
- blocked by subscription
- blocked by feature mode
- blocked by moderation
- processing
- success
- failed
- retryable failure
- publish success
- publish failure

Website-specific state requirements:
- unsupported viewport fallbacks only if a flow truly cannot be supported on a given size; otherwise responsive support is required.
- preserved draft state on navigation or refresh for recoverable in-progress authoring.
- upload progress, preview, and replacement flow for source images.

## 9. Backend / Jobs Scope

### Services
- aiVideoPolicyService
- aiVideoProviderService
- aiVideoGenerationService
- aiVideoModerationService
- aiVideoAssetService
- aiVideoUsageService
- aiVideoPublishingService

### Workers / Schedulers
- job submission worker
- job polling or webhook processor
- cleanup worker for expired temporary assets
- metrics aggregation worker if needed

### Idempotency and Duplicate Protection
- generation submission idempotency key
- webhook replay protection
- publish-to-Waves duplicate protection

### Audit Requirements
- admin config changes logged
- moderation decisions logged
- provider test events logged
- publish handoff events logged

## 10. Security and Compliance

### Trust Boundaries
- Flutter client is untrusted for entitlement and policy.
- Backend is source of truth for access and generation actions.
- Provider webhooks must be verified cryptographically.

### Sensitive Data Handling
- Provider API keys stored as secrets, not plain settings.
- Prompt and image inputs handled according to retention policy.
- Generated media stored in managed storage with controlled access.

### Abuse Resistance and Rate Limiting
- per-user rate limits
- per-plan quotas
- moderation on prompt and source image inputs
- duplicate job prevention
- provider kill switch
- high-cost guardrails

### Audit and Legal Requirements
- record admin config changes
- record moderation decisions
- maintain provider request correlation ids when possible
- define policy on AI labeling, impersonation, adult content, and copyrighted mimicry

## 11. Observability and Analytics

### Product Metrics
- generator entry visits
- website generator landing visits
- generation start rate
- generation completion rate
- success rate
- time to first successful output
- post-to-Waves conversion rate
- upgrade conversion from gate screen

### Operational Metrics
- provider latency
- provider error rate
- queue depth
- job age backlog
- storage growth
- daily estimated cost
- moderation block rate

### Logging / Tracing Needs
- structured logs for job lifecycle
- provider submission and callback correlation
- admin config change logs
- publish-to-Waves audit trail
- website client analytics for funnel steps and drop-off points

### Alert Routing
- provider outage
- webhook signature failures
- queue stuck jobs
- unusual cost spikes
- high generation failure rate
- publish-to-Waves failure spike

## 12. Phased Delivery Plan

### Phase 0: Product and Policy Lock
1. Finalize feature rules and policies.
2. Select launch provider.
3. Define minimum creator subscription tiers.
4. Approve admin controls and safety policy.
5. Approve AI-generated labeling policy.

### Phase 1: Backend Foundation
1. Add domain models and storage.
2. Build policy and entitlement service.
3. Implement provider adapter layer.
4. Implement job lifecycle APIs.
5. Implement webhook/polling processing.

### Phase 2: Admin Panel
1. Add AI Video section.
2. Add feature availability controls.
3. Add minimum creator subscription controls.
4. Add provider/API configuration.
5. Add limits, moderation, and health controls.

### Phase 3: Flutter Creator Experience
1. Add discovery entry points.
2. Add entitlement gate.
3. Add create flow and source image upload.
4. Add processing, result, and library screens.
5. Add retry/cancel/failure handling.

### Phase 4: Website Creator Experience
1. Add website discovery entry points.
2. Add website entitlement gate.
3. Add website generation studio and source image upload.
4. Add website processing, result, and library screens.
5. Add website retry/cancel/failure handling.

### Phase 5: Publish to Waves Bridge
1. Add post-to-Waves action from completed generated asset in Flutter.
2. Add post-to-Waves action from completed generated asset on website.
3. Add Wave composer/publish handoff on both client surfaces.
4. Add AI-generated labeling and publish linkage.

### Phase 6: Hardening and Rollout
1. Add analytics and alerting.
2. Add ops dashboards.
3. Run pilot mode.
4. Validate rollout and rollback behavior.

## 13. Acceptance Criteria (Release Gate)

1. Admin can disable the feature without deployment.
2. Admin can change feature availability mode without deployment.
3. Admin can change minimum creator subscription without deployment.
4. Ineligible creators cannot generate videos server-side.
5. Eligible creators can successfully generate an AI video end to end.
6. Eligible website creators can successfully generate an AI video end to end.
7. Creators can view in-progress, failed, and completed jobs on Flutter and website.
8. Source image upload works with picker, progress, and preview on Flutter and website.
9. Completed generated videos can be posted to Waves from Flutter and website.
10. Waves posting uses generated output but does not own generation state.
11. Provider failures surface as graceful errors on all client surfaces.
12. Config changes are audited.
13. Metrics and alerting exist for health and cost.
14. Safety and moderation rules are enforced.

## 14. Test Matrix (Minimum)

### Persona Tests
- eligible creator
- ineligible creator below minimum plan
- internal/pilot creator
- admin operator

### Success / Failure Tests
- text-to-video success
- image-to-video success
- website text-to-video success
- website image-to-video success
- provider timeout
- provider rejected prompt
- moderation blocked prompt
- quota exceeded
- retry failed job
- publish completed asset to Waves
- publish completed asset to Waves from website
- publish failure preserves asset

### Security Tests
- unauthorized admin route access denied
- creator route entitlement enforcement
- webhook signature validation
- duplicate submission protection
- rate limiting enforcement

### Performance Tests
- concurrent job submission behavior
- provider callback latency handling
- history list pagination performance
- storage and thumbnail retrieval performance
- website studio load performance and preview playback performance

### Regression Tests
- no unintended coupling to existing Waves creation flow
- creator subscription checks remain correct
- admin panel settings do not break unrelated admin features
- website creator flows do not regress existing creator dashboard or publishing paths

## 15. Operational Runbook Requirements

- Incident classes:
  - provider outage
  - cost spike
  - moderation false positives
  - publish handoff failures
  - queue stall
- Recovery SOP:
  - disable feature
  - switch provider
  - pause publish-to-Waves
  - requeue stuck jobs if safe
- Escalation paths:
  - backend owner
  - admin/ops owner
  - provider/vendor contact

## 16. Release Checklist

- [x] Feature flag/config created
- [x] Admin controls implemented
- [ ] Provider credentials configured
- [ ] Monitoring and alerts live
- [ ] Moderation policy approved
- [ ] Minimum creator plan configured
- [ ] Rollback path tested
- [ ] Pilot cohort defined
- [ ] Post-launch monitoring window scheduled

## 19. Session Closeout Status (2026-06-02)

Completed in repo:
- [x] Backend foundation and admin controls are implemented for AI Video feature config, provider config, validation, provider test, and audit logging.
- [x] Creator backend job APIs are implemented for list, detail, create, cancel, retry, and source-image signed upload URL generation.
- [x] Website creator discovery is wired into Creator Studio and the website AI video page is backed by live config and eligibility data.
- [x] Website AI video client helpers now support creator job endpoints and source-image upload URL retrieval.
- [x] Website AI video page now shows backend-backed job history with refresh plus retry/cancel actions.
- [x] Flutter AI video models and service layer now support creator job endpoints and source-image upload URL retrieval.

Not done yet:
- [ ] Website prompt/create-job studio, source-image picker/upload progress/preview, and job detail/result preview are still pending.
- [ ] Flutter AI video UI is still missing the real creator job flow, history UI, detail/result preview, and upload UX.
- [ ] Provider execution/orchestration, usage enforcement, moderation pipeline, and publish-to-Waves bridge are still pending.

Restart here next session:
1. Build the website create-job studio on top of [website/src/app/creator-studio/ai-video/page.tsx](z:\AfroVision_web\Afrovision\website\src\app\creator-studio\ai-video\page.tsx) and [website/src/lib/ai-video.ts](z:\AfroVision_web\Afrovision\website\src\lib\ai-video.ts).
2. Add source-image local picker, signed-upload flow, progress, and preview on the website before expanding to Flutter UI.
3. Re-read [lib/features/ai_video/services/ai_video_service.dart](z:\AfroVision_web\Afrovision\lib\features\ai_video\services\ai_video_service.dart) before any new Flutter edit because it changed after the last implementation slice.

## 17. Definition of Ready

Feature is ready to implement only when:

1. Dependencies are mapped.
2. Rules and contracts are approved.
3. Non-happy paths are specified.
4. Monitoring expectations are attached.
5. Acceptance criteria are testable.

## 18. Definition of Done

Feature is done only when:

1. End-to-end behavior is complete across all touched layers.
2. Supporting flows and controls are functional.
3. Security and compliance requirements are satisfied.
4. QA evidence exists.
5. Rollout and rollback playbooks are validated.

## Required Preparation Hook Checklist

Before coding starts, all answers must be YES:

- [x] A tracker file exists and follows this template.
- [x] Completion contract is explicitly written.
- [x] API and data contracts are documented.
- [x] Non-happy path behavior is documented.
- [x] Security and observability sections are filled.
- [x] Acceptance criteria and test matrix are present.
