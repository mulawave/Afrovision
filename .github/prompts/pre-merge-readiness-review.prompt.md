---
name: "Pre-Merge Readiness Review"
description: "Audit a feature, screen, component, flow, or diff for both end-to-end completeness and AfroVision design coherence before merge."
argument-hint: "What feature, screen, component, flow, or diff should be reviewed before merge?"
agent: "agent"
---

Follow the project standards in [copilot-instructions](../copilot-instructions.md) and the premium UI guidance in [premium-ui](../skills/premium-ui/SKILL.md).

Use the standards from [implementation-completeness-review](./implementation-completeness-review.prompt.md) and [design-coherence-review](./design-coherence-review.prompt.md) in a single review pass.

Review the provided feature, code, screen, component, flow, or diff for merge readiness across both implementation quality and design coherence.

Audit implementation readiness across:
- User entry points and discovery surfaces
- Destination pages, dialogs, panels, and linked flows
- Backend, API, storage, state, and navigation wiring
- Loading, empty, error, success, offline, disabled, validation, permission, and edge-case handling
- Operational controls needed to actually use or manage the feature
- Verification appropriate to the scope of change

Audit design readiness across:
- Required use of `AppColors.primaryGradient` for screens where applicable
- Colors coming only from `lib/core/theme/app_colors.dart`
- Reuse of shared widgets before introducing custom UI
- Typography, spacing, radius, shadows, hierarchy, and layout consistency
- Animation and interaction-state consistency
- Responsiveness across relevant layouts
- Alignment with the premium dark futuristic AfroVision design language

Use these rules:
- A feature is not merge-ready if it is functionally incomplete, visually off-theme, or operationally unfinished.
- Do not accept backend-only slices, UI-only slices, placeholder controls, dead-end navigation, or styling that drifts from AfroVision's default design system.
- If no significant gaps are found, say so directly and note any residual risks.

Example standard:
- If a header notifications feature is under review, verify the icon, badge, dropdown or panel, read vs unread distinction, list presentation, mark all as read, deep links, full notifications page, and management actions such as archive, delete, select all, and delete all, while also verifying brand colors, gradients, hierarchy, shared widget usage, animations, and state styling.

Output format:
1. Verdict: `Ready`, `Needs Revision`, or `Blocked`
2. Findings: list the highest-impact issues first, regardless of whether they are completeness or design problems
3. Completeness gaps: missing flows, states, controls, wiring, or verification
4. Design coherence gaps: theme drift, off-brand styling, inconsistent patterns, or missing visual states
5. Reusability gaps: duplicated UI patterns that should be shared widgets
6. Verification gaps: missing tests, responsive checks, runtime validation, or manual review steps
7. Open blockers or assumptions: only if they materially affect merge readiness

Review rules:
- Findings come first
- Cite the concrete problem and why it blocks readiness
- Keep the review strict and pre-merge focused
- Ask only the minimum clarifying questions needed to determine whether the work is merge-ready