// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Import everything with:
//    import * as PremiumKit from './web_ui_ux_template/react';
//
//  Or pick what you need:
//    import PremiumTheme from './web_ui_ux_template/react/theme/color-engine';
//    import LoginPage from './web_ui_ux_template/react/pages/LoginPage';
//
// ═══════════════════════════════════════════════════════════════════════════════

// Theme engine
export { PremiumTheme, DEFAULTS, hexToRgba } from './theme/color-engine.js';
export { default as presets } from './theme/presets.js';

// Hooks
export { useTheme } from './hooks/useTheme.js';

// Components
export { default as PremiumScaffold } from './components/PremiumScaffold.jsx';
export { PremiumButton, PremiumOutlineButton, PremiumTextButton, PremiumPillButton } from './components/PremiumButton.jsx';
export { default as PremiumTextField, PremiumPasswordStrength } from './components/PremiumTextField.jsx';
export { PremiumCard, PremiumHeroCard, PremiumStatCard, PremiumWalletStatCard, PremiumPlanCard } from './components/PremiumCards.jsx';
export { PremiumNavbar, PremiumSidebar, PremiumLogo, PremiumBadgeCounter } from './components/PremiumNavigation.jsx';
export { PremiumBanner, PremiumStatusBadge, PremiumModal, PremiumConfirmDialog, PremiumDrawer, PremiumSpinner, PremiumEmptyState } from './components/PremiumFeedback.jsx';
export { default as PremiumDataTable } from './components/PremiumDataTable.jsx';
export { PremiumAvatar, PremiumProfileHeader, PremiumMenuItem, PremiumBadge, PremiumUserDropdown } from './components/PremiumProfile.jsx';
export { default as PremiumFooter } from './components/PremiumFooter.jsx';

// Pages
export { default as LoginPage } from './pages/LoginPage.jsx';
export { default as RegisterPage } from './pages/RegisterPage.jsx';
export { default as ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
export { default as AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
export { default as WalletPage } from './pages/WalletPage.jsx';
export { default as PricingPage } from './pages/PricingPage.jsx';
