# AI Video Generator Phased Implementation Tickets

## Phase 1: Backend Foundation

### Backend
- [x] Create `backend/src/ai_video/` module with models for feature config, provider config, and generation jobs
- [x] Add policy service to evaluate feature enabled state, feature mode, role eligibility, and minimum creator subscription
- [x] Add public creator API `GET /ai-video/config`
- [x] Add admin APIs for feature config and provider config management
- [x] Register AI video routes in `backend/src/app.js`
- [x] Add normalized eligibility/error contract for disabled, restricted, and insufficient-plan states

### Admin
- [x] Wire admin backend routes into admin frontend service layer
- [x] Create admin nav entry placeholder for AI Video feature section

### Website
- [x] Add website service stubs for AI video config fetch
- [x] Add website route placeholders for generator discovery and studio

### Flutter
- [x] Add Flutter service/model stubs for AI video config fetch
- [x] Add Flutter route placeholders for generator discovery and gate screen

## Phase 2: Admin Controls

### Backend
- [x] Add config validation for provider settings and mode transitions
- [x] Add provider test endpoint and audit logging

### Admin
- [x] Build AI Video Overview screen
- [x] Build Feature Access panel: enable toggle, mode selector, minimum creator plan selector
- [x] Build Provider Settings panel: API base URL, model, timeout, secret references, provider enablement
- [x] Build Limits and Safety panel: quotas, duration/resolution caps, publish-to-Waves toggle, moderation requirement
- [x] Build provider health test action and results surface

### Website
- [ ] Add admin-aware content preview if website shares content preview surfaces

### Flutter
- [ ] No Phase 2 Flutter UI changes beyond consuming config if needed

## Phase 3: Creator Experience on Flutter

### Flutter
- [ ] Add AI Video Generator entry point in creator surfaces
- [x] Extend Flutter AI video models/service for creator job APIs and source-image upload URL support
- [ ] Build entitlement gate screen for unavailable or below-plan creators
- [ ] Build generator home/studio flow for text-to-video, image-to-video, template mode
- [ ] Add source image local picker with progress and preview
- [ ] Build My AI Videos history screen
- [ ] Build job detail/result preview screen
- [ ] Add retry, cancel, and delete/archive controls if approved

### Backend
- [x] Add create, cancel, retry, list, and detail APIs
- [x] Add source-image upload URL endpoint
- [ ] Persist job lifecycle records and output asset metadata

## Phase 4: Creator Experience on Website

### Website
- [x] Add AI Video Generator creator navigation entry
- [x] Extend website AI video client helper for creator job and source-image upload endpoints
- [x] Add backend-backed AI video jobs history with refresh and retry/cancel actions
- [ ] Build web generator landing and studio
- [ ] Build web entitlement gate and upgrade prompts
- [ ] Add source image upload with progress and preview
- [ ] Build web library/history and detail screens
- [ ] Add retry, cancel, and publish actions on website

### Backend
- [x] Reuse Phase 3 APIs; ensure website parity for launch-critical flows

## Phase 5: Publish to Waves Bridge

### Backend
- [ ] Add `POST /ai-video/jobs/:id/post-to-waves`
- [ ] Store publish linkage from generated asset/job to created wave id
- [ ] Enforce moderation/publish readiness before handoff

### Flutter
- [ ] Add Post to Waves action from completed generated asset
- [ ] Prefill Wave publish flow with generated video and AI-generated label

### Website
- [ ] Add Post to Waves action from completed generated asset
- [ ] Prefill website Wave publish flow with generated video and AI-generated label

## Phase 6: Hardening, Safety, and Rollout

### Backend
- [ ] Add provider adapter abstraction and launch provider integration
- [ ] Add webhook endpoint and signature validation
- [ ] Add usage ledger and quota enforcement
- [ ] Add moderation integration for prompts/source images/outputs
- [ ] Add analytics, alerting, and cost telemetry

### Admin
- [ ] Add operations dashboard for jobs, failures, provider health, and cost
- [ ] Add moderation queue and manual review controls if required

### Website
- [ ] Add funnel analytics and error telemetry

### Flutter
- [ ] Add funnel analytics and error telemetry

## Cross-Phase Release Gates
- [ ] Feature can be disabled without deployment
- [ ] Minimum creator subscription can be changed without deployment
- [ ] Website and Flutter parity achieved for launch-critical flows
- [ ] Publish-to-Waves remains a handoff, not feature ownership
- [ ] QA matrix passed across backend, admin, website, and Flutter
