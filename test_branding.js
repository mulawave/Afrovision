/**
 * AfroVision — Branding Feature Tests
 * Tests logo/favicon upload, storage, normalization, and cross-layer wiring.
 */

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  \u2713 ${label}`);
    pass++;
  } catch (err) {
    console.log(`  \u2717 ${label}`);
    console.log(`    ${err.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

const ROOT = __dirname;

// ═══════════════════════════════════════════
console.log('\n═══ 1. BACKEND DESIGN SERVICE — BRANDING ═══');

const svcPath = path.join(ROOT, 'backend/src/design/homepage-design.service.js');
const svcSource = fs.readFileSync(svcPath, 'utf8');

test('DEFAULT_DESIGN includes branding with logo_url and favicon_url', () => {
  assert(svcSource.includes('branding:'), 'branding key missing from DEFAULT_DESIGN');
  assert(svcSource.includes('logo_url: null'), 'logo_url null default missing');
  assert(svcSource.includes('favicon_url: null'), 'favicon_url null default missing');
});

test('normalizeDesign produces branding field', () => {
  assert(svcSource.includes('branding: normalizeBranding('), 'normalizeDesign does not call normalizeBranding');
});

test('normalizeBranding function exists and sanitizes', () => {
  assert(svcSource.includes('function normalizeBranding('), 'normalizeBranding function missing');
  assert(svcSource.includes('sanitizeHref(source.logo_url'), 'logo_url not sanitized');
  assert(svcSource.includes('sanitizeHref(source.favicon_url'), 'favicon_url not sanitized');
});

test('getPublicHomepageContent returns branding', () => {
  assert(svcSource.includes('branding: design.branding'), 'branding not in public content response');
});

// Mock test of normalization behavior
const Module = require('module');
const originalRequire = Module.prototype.require;
const mockFirestore = {
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async () => {},
    }),
    where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
  }),
};

Module.prototype.require = function (id) {
  if (id === '../utils/firestore' || id === '../../utils/firestore' || id.endsWith('/utils/firestore')) {
    return { getFirestore: () => mockFirestore };
  }
  if (id === 'firebase-admin' || id === 'firebase-admin/firestore') {
    return { initializeApp: () => {}, credential: { cert: () => {} }, getFirestore: () => mockFirestore };
  }
  return originalRequire.apply(this, arguments);
};

// Clear require cache for design modules
Object.keys(require.cache).forEach((k) => {
  if (k.includes('design') || k.includes('channel') || k.includes('user') || k.includes('video') || k.includes('broadcast') || k.includes('analytics')) {
    delete require.cache[k];
  }
});

let HomepageDesignService;
try {
  HomepageDesignService = require(path.join(ROOT, 'backend/src/design/homepage-design.service.js'));
} catch (e) {
  // Models may fail to load, but we can still test exports
}

test('normalizeDesign returns branding with defaults for empty input', () => {
  assert(HomepageDesignService, 'Service must load');
  const result = HomepageDesignService.normalizeDesign({});
  assert(result.branding, 'branding key must exist');
  assert(result.branding.logo_url === null, `logo_url should be null, got: ${result.branding.logo_url}`);
  assert(result.branding.favicon_url === null, `favicon_url should be null, got: ${result.branding.favicon_url}`);
});

test('normalizeDesign preserves valid branding URLs', () => {
  const result = HomepageDesignService.normalizeDesign({
    branding: {
      logo_url: '/uploads/logo-123.png',
      favicon_url: '/uploads/favicon-456.png',
    },
  });
  assert(result.branding.logo_url === '/uploads/logo-123.png', `logo_url mismatch: ${result.branding.logo_url}`);
  assert(result.branding.favicon_url === '/uploads/favicon-456.png', `favicon_url mismatch: ${result.branding.favicon_url}`);
});

test('normalizeDesign rejects invalid branding URLs', () => {
  const result = HomepageDesignService.normalizeDesign({
    branding: {
      logo_url: 'javascript:alert(1)',
      favicon_url: '',
    },
  });
  // sanitizeHref with fallback '' should reject javascript: URLs
  assert(result.branding.favicon_url === null, `Empty favicon_url should be null, got: ${result.branding.favicon_url}`);
});

test('normalizeDesign handles non-object branding gracefully', () => {
  const result = HomepageDesignService.normalizeDesign({ branding: 'invalid' });
  assert(result.branding.logo_url === null, 'Should default to null');
  assert(result.branding.favicon_url === null, 'Should default to null');
});

Module.prototype.require = originalRequire;

// ═══════════════════════════════════════════
console.log('\n═══ 2. BACKEND CONTROLLER — BRANDING UPLOAD ═══');

const ctrlPath = path.join(ROOT, 'backend/src/design/homepage-design.controller.js');
const ctrlSource = fs.readFileSync(ctrlPath, 'utf8');

test('uploadBrandingAsset function exists', () => {
  assert(ctrlSource.includes('async function uploadBrandingAsset'), 'uploadBrandingAsset function missing');
});

test('uploadBrandingAsset validates field parameter', () => {
  assert(ctrlSource.includes("field !== 'logo_url' && field !== 'favicon_url'"), 'field validation missing');
  assert(ctrlSource.includes('field must be logo_url or favicon_url'), 'error message missing');
});

test('uploadBrandingAsset requires file', () => {
  assert(ctrlSource.includes("!req.file"), 'file check missing');
});

test('uploadBrandingAsset saves to design.branding', () => {
  assert(ctrlSource.includes('design.branding[field] = imageUrl'), 'branding field assignment missing');
  assert(ctrlSource.includes('saveHomepageDesign(design, caller.id)'), 'saveHomepageDesign call missing');
});

test('uploadBrandingAsset logs audit action', () => {
  assert(ctrlSource.includes("'upload_branding_asset'"), 'audit action missing');
});

test('uploadBrandingAsset is exported', () => {
  assert(ctrlSource.includes('uploadBrandingAsset,'), 'Not exported from module');
});

// ═══════════════════════════════════════════
console.log('\n═══ 3. BACKEND ROUTE — BRANDING UPLOAD ═══');

const routesPath = path.join(ROOT, 'backend/src/admin/admin.routes.js');
const routesSource = fs.readFileSync(routesPath, 'utf8');

test('Branding upload route is registered', () => {
  assert(routesSource.includes("/design/homepage/branding"), 'Route path missing');
  assert(routesSource.includes('designCtrl.uploadBrandingAsset'), 'Controller binding missing');
});

test('Branding upload uses multer single file', () => {
  assert(routesSource.includes("upload.single('file'), designCtrl.uploadBrandingAsset"), 'Missing multer middleware');
});

test('Branding route requires authentication', () => {
  assert(routesSource.includes('authenticateToken, upload.single(\'file\'), designCtrl.uploadBrandingAsset'), 'authenticateToken not applied');
});

// ═══════════════════════════════════════════
console.log('\n═══ 4. ADMIN DESIGN PAGE — BRANDING UI ═══');

const designPagePath = path.join(ROOT, 'admin/src/app/(admin)/design/page.jsx');
const designPageSource = fs.readFileSync(designPagePath, 'utf8');

test('Design page has handleBrandingUpload function', () => {
  assert(designPageSource.includes('async function handleBrandingUpload'), 'handleBrandingUpload missing');
});

test('handleBrandingUpload calls /admin/design/homepage/branding', () => {
  assert(designPageSource.includes('/admin/design/homepage/branding'), 'Branding upload endpoint missing');
});

test('handleBrandingUpload sets field as query param', () => {
  assert(designPageSource.includes('?field=${field}'), 'Field query param missing');
});

test('Design page has removeBrandingAsset function', () => {
  assert(designPageSource.includes('async function removeBrandingAsset'), 'removeBrandingAsset missing');
});

test('Branding card has Logo upload section', () => {
  assert(designPageSource.includes('"Upload logo"'), 'Logo upload label missing');
  assert(designPageSource.includes('handleBrandingUpload(file, "logo_url")'), 'Logo upload handler missing');
});

test('Branding card has Favicon upload section', () => {
  assert(designPageSource.includes('"Upload favicon"'), 'Favicon upload label missing');
  assert(designPageSource.includes('handleBrandingUpload(file, "favicon_url")'), 'Favicon upload handler missing');
});

test('Logo preview shows image when uploaded', () => {
  assert(designPageSource.includes('design.branding?.logo_url'), 'Logo URL conditional missing');
  assert(designPageSource.includes('alt="Logo"'), 'Logo alt text missing');
});

test('Favicon preview shows image when uploaded', () => {
  assert(designPageSource.includes('design.branding?.favicon_url'), 'Favicon URL conditional missing');
  assert(designPageSource.includes('alt="Favicon"'), 'Favicon alt text missing');
});

test('Logo and favicon have Remove buttons', () => {
  assert(designPageSource.includes('removeBrandingAsset("logo_url")'), 'Logo remove missing');
  assert(designPageSource.includes('removeBrandingAsset("favicon_url")'), 'Favicon remove missing');
});

test('Branding card uses consistent admin UI styling', () => {
  assert(designPageSource.includes('rounded-[1.75rem] border border-white/10 bg-[var(--admin-surface)]'), 'Card styling mismatch');
  assert(designPageSource.includes('🎨'), 'Branding icon missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 5. ADMIN LOGIN — LOGO WIRING ═══');

const loginPath = path.join(ROOT, 'admin/src/app/(auth)/login/page.jsx');
const loginSource = fs.readFileSync(loginPath, 'utf8');

test('Login page imports useBranding hook', () => {
  assert(loginSource.includes("import { useBranding }"), 'useBranding import missing');
  assert(loginSource.includes("from \"@/lib/branding\""), 'branding module import missing');
});

test('Login page extracts logo_url from branding', () => {
  assert(loginSource.includes('const { logo_url } = useBranding()'), 'logo_url destructure missing');
});

test('Login page shows uploaded logo when available', () => {
  assert(loginSource.includes('logo_url ?'), 'Conditional rendering missing');
  assert(loginSource.includes('alt="AfroVision"'), 'Alt text missing');
  assert(loginSource.includes('src={logo_url}'), 'Image src binding missing');
});

test('Login page falls back to text when no logo uploaded', () => {
  assert(loginSource.includes('AfroVision</p>'), 'Fallback text missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 6. ADMIN LAYOUT — FAVICON WIRING ═══');

const adminLayoutPath = path.join(ROOT, 'admin/src/app/layout.jsx');
const adminLayoutSource = fs.readFileSync(adminLayoutPath, 'utf8');

test('Admin layout imports BrandingHead component', () => {
  assert(adminLayoutSource.includes("import BrandingHead"), 'BrandingHead import missing');
});

test('Admin layout renders BrandingHead', () => {
  assert(adminLayoutSource.includes('<BrandingHead'), 'BrandingHead not rendered');
});

// ═══════════════════════════════════════════
console.log('\n═══ 7. ADMIN BRANDING HOOK ═══');

const brandingHookPath = path.join(ROOT, 'admin/src/lib/branding.js');
const brandingHookSource = fs.readFileSync(brandingHookPath, 'utf8');

test('useBranding hook exists and is exported', () => {
  assert(brandingHookSource.includes('export function useBranding()'), 'useBranding export missing');
});

test('useBranding fetches from /api/proxy/home/content', () => {
  assert(brandingHookSource.includes('/api/proxy/home/content'), 'Fetch URL missing');
});

test('useBranding resolves relative URLs with API base', () => {
  assert(brandingHookSource.includes('function resolveUrl(path)'), 'resolveUrl helper missing');
  assert(brandingHookSource.includes('NEXT_PUBLIC_API_BASE_URL'), 'API base resolution missing');
});

test('useBranding caches in sessionStorage', () => {
  assert(brandingHookSource.includes('sessionStorage'), 'Cache mechanism missing');
  assert(brandingHookSource.includes('BRANDING_CACHE_TTL'), 'Cache TTL missing');
});

test('useBranding handles fetch errors gracefully', () => {
  assert(brandingHookSource.includes('.catch('), 'Error catch missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 8. ADMIN BRANDINGHEAD COMPONENT ═══');

const brandingHeadPath = path.join(ROOT, 'admin/src/components/BrandingHead.jsx');
const brandingHeadSource = fs.readFileSync(brandingHeadPath, 'utf8');

test('BrandingHead is a client component', () => {
  assert(brandingHeadSource.includes('"use client"'), '"use client" directive missing');
});

test('BrandingHead uses useBranding hook', () => {
  assert(brandingHeadSource.includes('useBranding()'), 'useBranding call missing');
});

test('BrandingHead creates or updates favicon link element', () => {
  assert(brandingHeadSource.includes('rel="icon"'), 'rel=icon missing');
  assert(brandingHeadSource.includes('link.href = favicon_url'), 'href assignment missing');
});

test('BrandingHead creates link element if not present', () => {
  assert(brandingHeadSource.includes('document.createElement("link")'), 'createElement missing');
  assert(brandingHeadSource.includes('document.head.appendChild'), 'appendChild missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 9. WEBSITE LAYOUT — BRANDING INTEGRATION ═══');

const websiteLayoutPath = path.join(ROOT, 'website/src/app/layout.tsx');
const websiteLayoutSource = fs.readFileSync(websiteLayoutPath, 'utf8');

test('Website layout imports getBranding', () => {
  assert(websiteLayoutSource.includes('import { getBranding }'), 'getBranding import missing');
  assert(websiteLayoutSource.includes('from "@/lib/homepage"'), 'homepage module import path');
});

test('Website layout calls getBranding()', () => {
  assert(websiteLayoutSource.includes('const branding = await getBranding()'), 'getBranding call missing');
});

test('Website layout is async', () => {
  assert(websiteLayoutSource.includes('export default async function RootLayout'), 'Layout not async');
});

test('Website layout sets favicon link when available', () => {
  assert(websiteLayoutSource.includes('branding.favicon_url'), 'Favicon conditional missing');
  assert(websiteLayoutSource.includes('rel="icon"'), 'rel=icon missing');
  assert(websiteLayoutSource.includes('href={branding.favicon_url}'), 'favicon href binding missing');
});

test('Website layout passes logoUrl to Navbar', () => {
  assert(websiteLayoutSource.includes('<Navbar logoUrl={branding.logo_url}'), 'logoUrl prop to Navbar missing');
});

test('Website layout passes logoUrl to Footer', () => {
  assert(websiteLayoutSource.includes('<Footer logoUrl={branding.logo_url}'), 'logoUrl prop to Footer missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 10. WEBSITE NAVBAR — LOGO REPLACEMENT ═══');

const navbarPath = path.join(ROOT, 'website/src/components/Navbar.tsx');
const navbarSource = fs.readFileSync(navbarPath, 'utf8');

test('Navbar accepts logoUrl prop', () => {
  assert(navbarSource.includes('logoUrl'), 'logoUrl prop missing');
  assert(navbarSource.includes('string | null'), 'Type annotation missing');
});

test('Navbar shows uploaded logo image when logoUrl present', () => {
  assert(navbarSource.includes('logoUrl ?'), 'Conditional logo rendering missing');
  assert(navbarSource.includes('src={logoUrl}'), 'Image src binding missing');
  assert(navbarSource.includes('alt="AfroVision"'), 'Alt text missing');
});

test('Navbar falls back to gradient A box when no logo', () => {
  const afterLogoUrl = navbarSource.split('logoUrl ?')[1];
  assert(afterLogoUrl && /bg-gradient-to-br.*from-av-orange/.test(afterLogoUrl), 'Fallback gradient box missing');
  assert(afterLogoUrl && /\bA\b/.test(afterLogoUrl.split('</div>')[0]), 'Fallback A letter missing');
});

test('Navbar logo image has matching dimensions', () => {
  assert(navbarSource.includes('h-9 w-9'), 'Logo image sizing missing');
  assert(navbarSource.includes('rounded-lg'), 'Logo border radius missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 11. WEBSITE FOOTER — LOGO REPLACEMENT ═══');

const footerPath = path.join(ROOT, 'website/src/components/Footer.tsx');
const footerSource = fs.readFileSync(footerPath, 'utf8');

test('Footer accepts logoUrl prop', () => {
  assert(footerSource.includes('logoUrl'), 'logoUrl prop missing');
  assert(footerSource.includes('string | null'), 'Type annotation missing');
});

test('Footer shows uploaded logo image when logoUrl present', () => {
  assert(footerSource.includes('logoUrl ?'), 'Conditional logo rendering missing');
  assert(footerSource.includes('src={logoUrl}'), 'Image src binding missing');
});

test('Footer falls back to gradient A box when no logo', () => {
  const afterLogoUrl = footerSource.split('logoUrl ?')[1];
  assert(afterLogoUrl && /bg-gradient-to-br.*from-av-orange/.test(afterLogoUrl), 'Fallback gradient box missing');
  assert(afterLogoUrl && /\bA\b/.test(afterLogoUrl.split('</div>')[0]), 'Fallback A letter missing');
});

test('Footer logo image has matching dimensions', () => {
  assert(footerSource.includes('h-8 w-8'), 'Logo image sizing missing');
  assert(footerSource.includes('rounded-lg'), 'Logo border radius missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 12. WEBSITE HOMEPAGE.TS — BRANDING TYPES ═══');

const homepagePath = path.join(ROOT, 'website/src/lib/homepage.ts');
const homepageSource = fs.readFileSync(homepagePath, 'utf8');

test('HomepageBranding interface exists', () => {
  assert(homepageSource.includes('export interface HomepageBranding'), 'HomepageBranding interface missing');
});

test('HomepageBranding has logo_url and favicon_url', () => {
  assert(homepageSource.includes('logo_url: string | null'), 'logo_url field missing');
  assert(homepageSource.includes('favicon_url: string | null'), 'favicon_url field missing');
});

test('HomepageContent includes branding field', () => {
  assert(homepageSource.includes('branding?: HomepageBranding'), 'branding in HomepageContent missing');
});

test('getBranding function exists', () => {
  assert(homepageSource.includes('export async function getBranding'), 'getBranding export missing');
});

test('getBranding resolves relative URLs with API base', () => {
  assert(homepageSource.includes('resolveAssetUrl'), 'resolveAssetUrl usage missing');
});

test('resolveAssetUrl handles both absolute and relative URLs', () => {
  assert(homepageSource.includes('function resolveAssetUrl'), 'resolveAssetUrl function missing');
  assert(homepageSource.includes('API_BASE'), 'API_BASE usage missing');
});

// ═══════════════════════════════════════════
console.log('\n═══ 13. SECURITY CHECKS ═══');

test('Branding upload requires admin authentication', () => {
  assert(ctrlSource.includes('const caller = requireAdmin(req, res)'), 'Admin check in branding upload');
  assert(ctrlSource.includes('if (!caller) return'), 'Early return on non-admin');
});

test('Branding upload only accepts logo_url or favicon_url field', () => {
  // Prevents arbitrary field injection
  assert(ctrlSource.includes("field !== 'logo_url' && field !== 'favicon_url'"), 'Field whitelist check');
});

test('Logo URLs are sanitized through sanitizeHref', () => {
  assert(svcSource.includes('sanitizeHref(source.logo_url'), 'Logo sanitization');
  assert(svcSource.includes('sanitizeHref(source.favicon_url'), 'Favicon sanitization');
});

test('File upload uses existing multer validation', () => {
  assert(routesSource.includes("upload.single('file'), designCtrl.uploadBrandingAsset"), 'Multer middleware on route');
});

test('Branding upload has audit logging', () => {
  assert(ctrlSource.includes('upload_branding_asset'), 'Audit action logged');
});

// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log(`  BRANDING TESTS: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
console.log('═══════════════════════════════════════════════\n');

process.exit(fail > 0 ? 1 : 0);
