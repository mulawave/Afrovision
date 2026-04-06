---
name: "Design Coherence Review"
description: "Audit an existing screen, component, flow, or diff for theme drift, off-brand colors, weak hierarchy, inconsistent states, and visual mismatches before merge."
argument-hint: "What screen, component, or diff should be audited for visual consistency?"
agent: "agent"
---

Follow the project standards in [copilot-instructions](../copilot-instructions.md) and the premium UI guidance in [premium-ui](../skills/premium-ui/SKILL.md).

Review the provided screen, component, feature flow, or diff for design-system compliance and visual coherence with AfroVision.

Audit the work against these standards:
- `AppColors.primaryGradient` is used for screens where required
- Colors come only from `lib/core/theme/app_colors.dart`
- Shared widgets are reused where appropriate before introducing custom UI
- Typography, spacing, border radius, shadows, and layout hierarchy match the premium design language
- Animations and interactive states are present and consistent
- The result matches the sophistication of existing auth and premium surfaces
- The UI is responsive and does not visually break on smaller or larger layouts

Flag visual drift such as:
- Hardcoded colors or off-brand palettes
- Missing gradient backgrounds on screens
- Generic or flat UI that looks out of place in the app
- Inconsistent buttons, cards, inputs, badges, list items, or panel styling
- Weak text hierarchy, cramped spacing, or mismatched radii and shadows
- Missing focus, loading, disabled, error, or selected states
- Repeated design patterns that should be extracted into shared widgets

Output format:
1. Verdict: `Aligned`, `Needs Revision`, or `Blocked`
2. Findings: list concrete visual or design-system issues, ordered by impact
3. Theme drift and inconsistency: call out where the UI diverges from AfroVision's default theme or component patterns
4. Reusability gaps: note duplicated visual patterns that should become shared widgets
5. Verification gaps: note missing responsive checks, state coverage, or visual validation
6. Open blockers or assumptions: only if they materially affect the review

Review rules:
- Findings come first
- Be explicit about what is off-theme and what project rule it violates
- Do not treat visual polish as optional if it affects consistency with the existing app
- If no significant drift is found, say so directly and mention any residual risk
- Ask only the minimum clarifying questions needed to judge visual coherence