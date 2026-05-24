---
name: "Implementation Completeness Review"
description: "Review a feature, diff, or implementation for end-to-end completeness and identify missing flows, states, controls, or wiring before it is treated as done."
argument-hint: "What feature, diff, or implementation should be audited for completeness?"
agent: "agent"
---

Follow the project standards in [copilot-instructions](../copilot-instructions.md).

Preparation hook validation is mandatory for new implementations:
- Ensure a tracker exists using [new-feature-end-to-end-implementation-template](../templates/new-feature-end-to-end-implementation-template.md)
- Ensure tracker completion marks are updated to reflect completed work items in the reviewed change
- If missing or incomplete, verdict must be `Blocked` or `Not Ready`

Review the provided feature, code, diff, or implementation with a strict completeness standard.

Assess whether the work is actually complete across:
- Preparation process compliance (tracker/template/hook checklist)
- Tracker completion-state accuracy (completed/in-progress/not-started marks)
- User entry points and discovery surfaces
- Destination pages, dialogs, panels, and linked flows
- Backend, API, storage, and state wiring
- Navigation and deep links between related surfaces
- Loading, empty, error, success, offline, and disabled states
- Permissions, validation, and edge cases
- Operational controls needed to manage created content
- Verification appropriate to the change

Use this rule: a visible feature is not complete unless the surrounding user experience and expected follow-up actions are also complete.

Example standard:
- If a header notifications feature exists, verify the icon, badge, dropdown or panel, read vs unread distinction, list presentation, mark all as read, deep links to relevant content, and a fully wired notifications page with management actions such as mark as read, archive, delete, select all, and delete all.

Output format:
1. Verdict: `Ready`, `Not Ready`, or `Blocked`
2. Findings: list the gaps or risks that prevent the work from being truly complete, ordered by impact
3. Missing supporting flows and states: call out anything implied by the feature but not actually implemented
4. Verification gaps: note missing tests, manual validation, or runtime checks
5. Open blockers or assumptions: only if they materially affect readiness

Review rules:
- Findings come first
- Do not accept backend-only or UI-only slices as complete when the feature clearly requires both
- Flag placeholder controls, dead-end navigation, or missing management actions
- If no major gaps are found, say that explicitly and note any residual risk
- Ask only the minimum clarifying questions needed to judge completeness