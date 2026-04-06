---
name: "Design Coherence Guard"
description: "Keep every new implementation aligned with AfroVision's default UI/UX theme, brand colors, premium styling, animations, and reusable component patterns. Use alongside implementation completeness."
argument-hint: "What feature, screen, flow, or component needs to stay visually consistent with the AfroVision design system?"
agent: "agent"
---

Follow the project standards in [copilot-instructions](../copilot-instructions.md) and the premium UI guidance in [premium-ui](../skills/premium-ui/SKILL.md).

Use this prompt alongside [implementation-guard](./implementation-guard.prompt.md) when building a new feature, flow, screen, page, panel, widget, or interaction.

Your job is to keep the implementation visually and behaviorally coherent with AfroVision's default design language.

Treat design consistency as a delivery requirement, not a polish pass.

Before coding, define the design coherence contract for the request:
- Which existing screens, widgets, or flows set the visual precedent
- Required use of `AppColors.primaryGradient` for screens
- Required use of colors from `lib/core/theme/app_colors.dart` only
- Required use or extension of shared widgets from `lib/core/widgets/`
- Typography, spacing, radius, shadow, and layout patterns that should match the app
- Required animations, transitions, and interactive feedback states
- Mobile and desktop responsiveness expectations
- Any new reusable design patterns that should be extracted instead of duplicated

Design rules:
- Keep every new surface aligned with the existing premium dark futuristic theme
- Do not introduce off-brand colors, inconsistent spacing, weak hierarchy, or generic placeholder styling
- Do not hardcode colors outside the theme file
- Reuse existing shared widgets first and create new shared widgets only when the pattern repeats
- Give interactive elements complete default, focused, active, disabled, loading, and error states when applicable
- Match the sophistication of the auth experience and other premium surfaces already in the app

Response workflow:
1. State the design coherence contract for the requested implementation
2. Identify which existing design patterns, widgets, and tokens must be followed
3. Implement or refine the feature so it matches the AfroVision visual system
4. Verify that colors, gradients, spacing, typography, animations, and component states are consistent
5. Summarize how the result conforms to the default design theme and call out any real blockers

Quality bar:
- No color drift from `AppColors`
- No flat or generic UI that breaks the premium look
- No new surface without the required gradient, hierarchy, and animation treatment
- No inconsistent buttons, cards, fields, badges, or state styling
- No duplicated visual pattern that should be a reusable widget
- No claiming visual completion if the new feature still looks out of place in the app

If the request is ambiguous, ask the minimum questions needed to identify the closest existing design precedent and keep the result coherent.