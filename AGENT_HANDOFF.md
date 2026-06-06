# AfroVision Agent Handoff

Last updated: 2026-05-30

## 1) What This Repository Is

AfroVision is a multi-surface product with four primary code surfaces:

- Flutter app: lib/
- Backend API and services: backend/src/
- Website (Next.js): website/
- Admin console (Next.js): admin/

Top-level root script orchestration and deployment helpers exist in the repository root.

## 2) Fast Repository Map

Core paths:

- Flutter features: lib/features/
- Flutter shared core: lib/core/
- Flutter theme colors: lib/core/theme/app_colors.dart
- Flutter shared widgets: lib/core/widgets/
- Backend entrypoint: backend/src/app.js
- Backend tests: backend/test/
- Website app: website/
- Admin app: admin/
- Admin agent guidance: admin/AGENTS.md
- GitHub Copilot project instruction contract: .github/copilot-instructions.md
- Prompt guards/reviews: .github/prompts/
- Feature tracker template (mandatory): .github/templates/new-feature-end-to-end-implementation-template.md
- Premium UI skill: .github/skills/premium-ui/SKILL.md
- Repo memory docs: .github/memory/

Common tracker files already present at root include many *-end-to-end-implementation-tracker.md documents. Continue that naming pattern.

## 3) Non-Negotiable Operating Contract

Primary source of project-specific implementation rules:

- .github/copilot-instructions.md

Mandatory design rules for Flutter surfaces:

1. Every screen uses AppColors.primaryGradient background.
2. Premium dark futuristic consistency is required across new surfaces.
3. Colors must come from lib/core/theme/app_colors.dart only.
4. Reuse shared widgets first (AppTextField, AppButton, AppLogo, PasswordStrengthIndicator).
5. Include coherent fade/slide/interaction animation behavior.

Mandatory implementation completeness rules:

1. No partial scaffolds or single happy-path delivery.
2. Include full UX states: loading, empty, error, success, disabled, and required follow-up controls.
3. No dead-end entry points or unfinished downstream flows.
4. Add management/operational controls where content or workflow demands it.
5. Feature completion must be end-to-end across UI, state, API/backend, storage, routing, permissions, validation, and edge cases.

## 4) Implementation Preparation Hook (Blocking Gate)

Before any new implementation:

1. Use/create a tracker named:
   - *-end-to-end-implementation-tracker.md
2. Tracker must follow:
   - .github/templates/new-feature-end-to-end-implementation-template.md
3. Required sections must be present before coding:
   - completion contract
   - business rules
   - domain model changes
   - API contracts
   - user flows
   - security and observability
   - acceptance criteria and test matrix
4. During implementation, update completion marks in the same change set.

Hard-stop blocker text if violated:

- Blocked by Implementation Preparation Hook

Enforcement prompts:

- .github/prompts/implementation-guard.prompt.md
- .github/prompts/implementation-completeness-review.prompt.md

## 5) Additional Prompt Guards and Reviews

Available guard/review prompts:

- .github/prompts/design-coherence-guard.prompt.md
- .github/prompts/design-coherence-review.prompt.md
- .github/prompts/pre-merge-readiness-review.prompt.md

Recommended usage:

- New implementation: implementation-guard + design-coherence-guard
- Pre-merge audit: pre-merge-readiness-review
- Focused checks: implementation-completeness-review or design-coherence-review

## 6) Agent Customization Files in Repo

Agent definitions:

- .github/agents/Ruby.agent.md

Ruby is explicitly design/prototyping oriented and user-invocable.

Admin-specific operating guide:

- admin/AGENTS.md

Important note:

- admin/AGENTS.md references .github/agents/finisher.agent.md as a designated role, but that file is not currently present in .github/agents/.

## 7) Skills and Design Standards

Skill pack present:

- .github/skills/premium-ui/SKILL.md

Use this for:

- New Flutter screens, cards, components, dialogs, sheets, and premium visual refinements.

The skill reinforces:

- Gradient usage, brand color source-of-truth, reusable widget strategy, premium spacing/typography/shadows, and animation/state quality.

## 8) Memory System for Agent Continuity

Repository memory docs (in-repo files):

- .github/memory/afrovision.md
- .github/memory/admin-features.md
- .github/memory/ledger-system.md

External memory scopes used by coding agents (outside normal repo tree, agent runtime feature):

- /memories/ (user-level persistent memory)
- /memories/session/ (conversation-specific memory)
- /memories/repo/ (repo-scoped memory notes)

Working rule:

1. Read existing memory before adding new notes.
2. Keep notes short and corrective.
3. Update stale or incorrect memory when discovered.

## 9) Runtime, Tooling, and Package Defaults

### Root package scripts (orchestration)

From package.json at repo root:

- npm run dev -> website dev
- npm run dev:web -> website dev
- npm run dev:admin -> admin dev
- npm run dev:backend -> backend start
- npm run build:web -> website build
- npm run lint:web -> website lint
- npm run analyze:flutter -> flutter analyze
- npm run doctor:firestore -> backend firestore doctor
- npm run preflight:blockchain -> backend blockchain preflight
- npm run deploy:testnet -> backend hardhat deploy
- npm run add-liquidity -> backend liquidity script

### Backend scripts

From backend/package.json:

- npm --prefix backend run start
- npm --prefix backend run test
- npm --prefix backend run doctor:firestore
- npm --prefix backend run preflight:blockchain
- npm --prefix backend run deploy:testnet
- npm --prefix backend run add-liquidity

### Website scripts

From website/package.json:

- npm --prefix website run dev
- npm --prefix website run build
- npm --prefix website run start
- npm --prefix website run lint

### Admin scripts

From admin/package.json:

- npm --prefix admin run dev
- npm --prefix admin run build
- npm --prefix admin run start
- npm --prefix admin run lint
- npm --prefix admin run test
- npm --prefix admin run smoke

### Flutter defaults

From pubspec.yaml:

- SDK constraint: ^3.8.1
- App version: 1.1.0+4

## 10) Deployment Defaults and Infra Contract

Primary deployment scripts:

- Windows/PowerShell: deploy_all.ps1
- Unix shell: deploy_all.sh

### Cloud defaults baked into deploy scripts

- GCP Project ID: raven-ai-6ff76
- Region: us-central1
- Domain: afrovision.online

Cloud Run service IDs:

- afrovision-backend
- afrovision-website
- afrovision-admin

### PowerShell deployment controls

deploy_all.ps1 supports:

- -Only backend
- -Only website
- -Only admin
- -Only backend,website
- -SkipFirebase

PowerShell script behavior includes:

- API enablement (run, cloudbuild, artifactregistry, firestore)
- Cloud Run deploy per service
- Backend CORS update with resolved service URLs
- Secret-aware backend update path using Secret Manager if available
- Optional Firebase Hosting deployment

### Firebase hosting rewrite defaults

From firebase.json:

- Site afrovision-website rewrites all paths to Cloud Run service afrovision-website in us-central1
- Site afrovision-admin rewrites all paths to Cloud Run service afrovision-admin in us-central1

### Security caution

- deploy_all.sh currently contains literal ADMIN_PASSWORD in generated env blocks.
- Prefer secret-managed deployment path (deploy_all.ps1 behavior) and avoid committing plaintext secrets.

## 11) Domain and Safety Invariants to Preserve

Critical patterns reflected across docs:

- Backend is source of truth for sensitive writes.
- Financial actions must be ledger-backed and auditable.
- No negative balance behavior.
- No private key/raw secret leakage.
- Role/permission enforcement must remain strict.
- Do not implement fake success states for critical operations.

Primary references:

- .github/memory/ledger-system.md
- .github/memory/admin-features.md
- admin/AGENTS.md

## 12) Recommended Agent Execution Workflow

For new feature work:

1. Read .github/copilot-instructions.md.
2. Create/select compliant tracker file using template.
3. Write completion contract and non-happy paths first.
4. Implement end-to-end across all touched layers.
5. Update tracker completion marks in the same change set.
6. Run relevant analyzers/tests for touched surfaces.
7. Run pre-merge readiness review prompt before finalizing.

For fix-only work (non-new-feature):

1. Confirm if hook applies. If not a new implementation, proceed directly.
2. Keep change scoped, preserve design and security invariants.
3. Validate with nearest tests/analyzers.

## 13) Validation Checklist Before Claiming Completion

- Tracker hook requirements satisfied (for new implementation)
- All implied user flows are functional
- No dead-end controls or placeholders
- Required UX states are implemented
- Design coherence rules are still satisfied
- Sensitive writes and financial paths stay auditable
- Commands/tests/analyzers run for modified surfaces

## 14) Known Gaps and Ambiguities to Resolve Early

- admin/AGENTS.md references Engineer/step_*.md; verify these files exist before step-based execution.
- admin/AGENTS.md references .github/agents/finisher.agent.md, currently absent.
- Deployment script parity differs between deploy_all.ps1 and deploy_all.sh (notably secret handling). Prefer the safer path.

## 15) Quick Start Command Blocks

Local dev (split terminals):

1) Backend

npm --prefix backend install
npm --prefix backend run start

2) Website

npm --prefix website install
npm --prefix website run dev

3) Admin

npm --prefix admin install
npm --prefix admin run dev

4) Flutter

flutter pub get
flutter run --target lib/main.dart

Cross-surface checks:

- flutter analyze
- npm --prefix website run lint
- npm --prefix admin run lint
- npm --prefix backend run test

---

If an agent follows this handoff plus the linked source docs, it should be able to execute safely without re-discovering project policy, deployment defaults, guard hooks, or memory conventions.
