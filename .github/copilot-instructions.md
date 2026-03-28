# AfroVision — GitHub Copilot Instructions

## Design Rules (MANDATORY — apply to ALL screens and components)

1. **Background Gradient**: Every screen MUST use `AppColors.primaryGradient` (lightBlue → darkBlue, top → bottom) as its background. No exceptions.

2. **Premium Consistency**: Maintain the same high-level sophistication, global-standard premium look, structure, design, alignment, and visual effects across the entire application. Every new screen must match the quality and style of the existing auth screens — dark futuristic theme, smooth animations, proper spacing, and polished typography.

3. **Brand Colors Only**: Use colors exclusively from `lib/core/theme/app_colors.dart`. Never hardcode color values outside that file.

4. **Reusable Widgets**: Use existing shared widgets (`AppTextField`, `AppButton`, `AppLogo`, `PasswordStrengthIndicator`) wherever applicable. Create new reusable widgets in `lib/core/widgets/` when a pattern repeats.

5. **Animation Standards**: Screens should include fade-in and slide-up entry animations consistent with existing screens. Interactive elements should have appropriate feedback animations.

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
