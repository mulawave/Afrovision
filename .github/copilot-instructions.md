# AfroVision — GitHub Copilot Instructions

## Design Rules (MANDATORY — apply to ALL screens and components)

1. **Background Gradient**: Every screen MUST use `AppColors.primaryGradient` (lightBlue → darkBlue, top → bottom) as its background. No exceptions.

2. **Premium Consistency**: Maintain the same high-level sophistication, global-standard premium look, structure, design, alignment, and visual effects across the entire application. Every new screen must match the quality and style of the existing auth screens — dark futuristic theme, smooth animations, proper spacing, and polished typography.

3. **Brand Colors Only**: Use colors exclusively from `lib/core/theme/app_colors.dart`. Never hardcode color values outside that file.

4. **Reusable Widgets**: Use existing shared widgets (`AppTextField`, `AppButton`, `AppLogo`, `PasswordStrengthIndicator`) wherever applicable. Create new reusable widgets in `lib/core/widgets/` when a pattern repeats.

5. **Animation Standards**: Screens should include fade-in and slide-up entry animations consistent with existing screens. Interactive elements should have appropriate feedback animations.

## Implementation Completeness (MANDATORY — apply to ALL new features, functions, and flows)

1. **End-to-End Only**: Every new implementation must be completed end to end. Do not stop at a partial scaffold, isolated backend logic, page shell, button shell, placeholder state, or a single happy path.

2. **Full User Experience Required**: If a feature is visible to users, build the full supporting experience around it. This includes entry points, destination screens, connected actions, data wiring, navigation, empty states, loading states, error states, success states, disabled states, and any management controls needed to actually use the feature.

3. **Supporting Flows Are Part of the Feature**: If a new surface implies follow-up actions, those actions must also be implemented. Do not add an icon, menu item, page link, or card unless the downstream flow is also complete and functional.

4. **Operational Controls Must Exist**: If a feature creates manageable content, include the controls users need to operate it properly. Examples include mark as read, archive, delete, select all, clear all, filters, status indicators, and other expected controls relevant to the feature.

5. **Readiness Standard**: A feature is only complete when the full flow works across all touched layers: UI, state management, API or backend, storage, navigation, permissions, validation, and edge cases.

6. **No Misleading Partial Delivery**: Do not present a feature as done if important supporting pieces are missing. If a real blocker prevents complete delivery, explicitly state the blocker and what remains incomplete instead of leaving a half-baked implementation.

7. **Example Standard**: If implementing header notifications, the implementation must include the notification icon, badge counter, dropdown or panel, read and unread distinction, clear notification list presentation, mark all as read, links from each notification to relevant content, and a fully wired notifications page with controls such as mark as read, archive, delete, select all, delete all, and any other necessary management actions.

## Implementation Preparation Hook (MANDATORY BLOCKER)

All new implementation requests must pass a preparation gate before coding starts.

Required process:

1. Create or use a tracker file named `*-end-to-end-implementation-tracker.md`.
2. Tracker must follow `.github/templates/new-feature-end-to-end-implementation-template.md`.
3. The following sections must be explicitly present before implementation begins:
	- completion contract
	- business rules
	- domain model changes
	- API contracts
	- user flows
	- security and observability
	- acceptance criteria and test matrix

Blocking rule:

- If a new implementation task does not use this process and template, agents must stop and return: `Blocked by Implementation Preparation Hook`.
- Agents may proceed only after the tracker and checklist are complete.

Enforcement reference:

- `.github/prompts/implementation-guard.prompt.md`
- `.github/prompts/implementation-completeness-review.prompt.md`

## Brand Colors
- Dark Blue: `#050A30`
- Light Blue: `#173A6D`
- Light Orange: `#F5C16C`
- Orange: `#F49617`
- White: `#FFFFFF`

## Project Structure
- Flutter app: `lib/` (features organized by domain under `lib/features/`)
- Backend: `backend/src/` (Node.js + Express)
- Core utilities: `lib/core/` (theme, widgets, config, storage, api)
