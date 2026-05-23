---
name: "Implementation Guard"
description: "Guard against half-baked implementations by requiring complete end-to-end feature delivery, flows, UX states, and supporting actions. Use when implementing a new feature, function, flow, or user experience."
argument-hint: "What feature or implementation must be completed end-to-end?"
agent: "agent"
---

Follow the project standards in [copilot-instructions](../copilot-instructions.md).

## Preparation Hook (Hard Block)

This prompt is a mandatory gate for all new implementation tasks.

Before coding, require a feature tracker that follows:
- [new-feature-end-to-end-implementation-template](../templates/new-feature-end-to-end-implementation-template.md)

Required tracker format:
- `*-end-to-end-implementation-tracker.md`

Blocking behavior:
- If the request is a new implementation and no compliant tracker exists, STOP and return `Blocked by Implementation Preparation Hook`.
- In blocked state, create or request the tracker first, then continue implementation only after the checklist is fully satisfied.
- Do not bypass this hook for speed, urgency, or partial delivery.

Implement the requested feature or function as a complete end-to-end experience, not as a partial scaffold.

Treat "done" as meaning all required layers, states, and user actions are wired and usable. Do not stop at a backend endpoint, a database field, a button shell, a page shell, or a partial happy path.

Before coding, define the full completion contract for this request:
- User entry points and discovery surfaces
- UI elements and interaction states
- Backend, storage, API, and data wiring
- Navigation and deep links between related surfaces
- Loading, empty, success, error, offline, and disabled states
- Permissions, validation, and edge cases
- Follow-up actions users expect after the feature appears
- Admin or management controls required to actually operate the feature

Also confirm all Preparation Hook checklist items are complete:
- Tracker file exists and follows the template
- Contracts and non-happy paths are documented
- Security/observability sections are documented
- Acceptance criteria and test matrix are present

Use this standard: if a feature introduces a new visible surface, also build the supporting flow around it so users can meaningfully use it.

Example standard:
- If implementing notifications in a header, include the notification icon, badge counter, dropdown or panel, read vs unread distinction, mark all as read, clear list presentation, links from each item to relevant content, and the full notifications page with controls such as mark as read, archive, delete, select all, delete all, and any other necessary management actions.

Execution rules:
- Expand the scope to include missing supporting pieces that are obviously required for a complete user experience.
- Keep the implementation consistent with existing project patterns, shared widgets, architecture, and design rules.
- Build both the main happy path and the operational states around it.
- If something cannot be fully completed because of a real blocker, stop and clearly identify the blocker instead of shipping a misleading partial implementation.
- Do not claim completion until the feature is functional across all touched surfaces.

Response workflow:
1. State the completion contract for the requested feature.
1.1. Verify the Preparation Hook and cite the tracker file used.
2. Identify all files, layers, and flows that must change.
3. Implement the feature end-to-end.
4. Verify the user experience from entry point to completion, including management actions and non-happy states.
5. Summarize what is now complete and call out any real blockers or intentionally deferred items.

Quality bar:
- No half-implemented controls
- No orphaned UI without data or actions
- No backend capability without usable frontend flow
- No frontend entry point without the destination experience
- No "coming soon" placeholders unless explicitly requested
- No skipped states that make the flow feel unfinished

If the request is too vague to complete end-to-end, ask the minimum clarifying questions needed to finish the whole flow.