/**
 * AfroVision — Website Page Rendering Tests
 * Tests all pre-rendered HTML pages from the Next.js build output
 */

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const fails = [];

function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; fails.push({ name, error: e.message }); console.log(`  ✗ ${name}\n    → ${e.message}`); }
}

const buildDir = path.join(__dirname, '.next', 'server', 'app');
const pagesDir = path.join(__dirname, 'src', 'app');

console.log('\n═══ WEBSITE PRE-RENDERED PAGE TESTS ═══\n');

// All pages that should exist as pre-rendered HTML
// Next.js 16 uses flat filenames: about.html, not about/index.html
const expectedPages = [
  { route: '/', file: 'index.html' },
  { route: '/about', file: 'about.html' },
  { route: '/careers', file: 'careers.html' },
  { route: '/channels', file: 'channels.html' },
  { route: '/contact', file: 'contact.html' },
  { route: '/cookies', file: 'cookies.html' },
  { route: '/create-channel', file: 'create-channel.html' },
  { route: '/creator-studio', file: 'creator-studio.html' },
  { route: '/download', file: 'download.html' },
  { route: '/forgot-password', file: 'forgot-password.html' },
  { route: '/live', file: 'live.html' },
  { route: '/login', file: 'login.html' },
  { route: '/notifications', file: 'notifications.html' },
  { route: '/pak-login', file: 'pak-login.html' },
  { route: '/press', file: 'press.html' },
  { route: '/privacy', file: 'privacy.html' },
  { route: '/profile', file: 'profile.html' },
  { route: '/referrals', file: 'referrals.html' },
  { route: '/register', file: 'register.html' },
  { route: '/reset-password', file: 'reset-password.html' },
  { route: '/terms', file: 'terms.html' },
  { route: '/wallet', file: 'wallet.html' },
  { route: '/admin', file: 'admin.html' },
  { route: '/_not-found', file: '_not-found.html' },
];

// 1. Test all pages exist
for (const { route, file } of expectedPages) {
  test(`Page ${route} pre-rendered`, () => {
    const htmlPath = path.join(buildDir, file);
    if (!fs.existsSync(htmlPath)) throw new Error(`${file} not found in build output`);
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (html.length < 100) throw new Error(`${file} is suspiciously small (${html.length} bytes)`);
  });
}

// 2. Test key pages have correct content
console.log('\n═══ PAGE CONTENT VALIDATION ═══\n');

test('Homepage has AfroVision branding', () => {
  const html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  if (!html.includes('AfroVision')) throw new Error('Homepage missing AfroVision branding');
});

test('Homepage has Footer with social links', () => {
  const html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  if (!html.includes('footer') && !html.includes('Footer'))
    throw new Error('Homepage missing footer element');
});

test('About page has company description', () => {
  const html = fs.readFileSync(path.join(buildDir, 'about.html'), 'utf8');
  if (!html.includes('About') && !html.includes('about'))
    throw new Error('About page missing about content');
});

test('Terms page has legal content', () => {
  const html = fs.readFileSync(path.join(buildDir, 'terms.html'), 'utf8');
  if (!html.includes('Terms') && !html.includes('terms'))
    throw new Error('Terms page missing terms content');
});

test('Privacy page has policy content', () => {
  const html = fs.readFileSync(path.join(buildDir, 'privacy.html'), 'utf8');
  if (!html.includes('Privacy') && !html.includes('privacy'))
    throw new Error('Privacy page missing privacy content');
});

test('Login page renders client component shell', () => {
  const html = fs.readFileSync(path.join(buildDir, 'login.html'), 'utf8');
  // Client components render as empty shells in static HTML; check it's valid HTML
  if (!html.includes('<!DOCTYPE html') && !html.includes('<html'))
    throw new Error('Login page is not valid HTML');
});

test('Register page renders client component shell', () => {
  const html = fs.readFileSync(path.join(buildDir, 'register.html'), 'utf8');
  if (!html.includes('<!DOCTYPE html') && !html.includes('<html'))
    throw new Error('Register page is not valid HTML');
});

test('404 page has not-found content', () => {
  const html = fs.readFileSync(path.join(buildDir, '_not-found.html'), 'utf8');
  if (html.length < 100) throw new Error('404 page too small');
});

test('Download page has app download info', () => {
  const html = fs.readFileSync(path.join(buildDir, 'download.html'), 'utf8');
  if (!html.includes('Download') && !html.includes('download'))
    throw new Error('Download page missing download content');
});

test('Contact page has contact info', () => {
  const html = fs.readFileSync(path.join(buildDir, 'contact.html'), 'utf8');
  if (!html.includes('Contact') && !html.includes('contact'))
    throw new Error('Contact page missing contact content');
});

// 3. Test error boundary
console.log('\n═══ ERROR BOUNDARY TESTS ═══\n');

test('error.tsx source has retry functionality', () => {
  const src = fs.readFileSync(path.join(pagesDir, 'error.tsx'), 'utf8');
  if (!src.includes('reset') && !src.includes('retry') && !src.includes('Try again'))
    throw new Error('error.tsx missing retry/reset functionality');
});

test('not-found.tsx source has 404 content', () => {
  const src = fs.readFileSync(path.join(pagesDir, 'not-found.tsx'), 'utf8');
  if (!src.includes('404') && !src.includes('not found') && !src.includes('Not Found'))
    throw new Error('not-found.tsx missing 404 content');
});

// 4. Test page titles (SEO)
console.log('\n═══ SEO / TITLE TESTS ═══\n');

const pagesWithMetadata = fs.readdirSync(pagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const dir of pagesWithMetadata) {
  const pagePath = path.join(pagesDir, dir, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    test(`/${dir} page has title or metadata`, () => {
      const src = fs.readFileSync(pagePath, 'utf8');
      const hasMetadata = src.includes('export const metadata') || src.includes('generateMetadata');
      const hasTitle = src.includes('<title>');
      if (!hasMetadata && !hasTitle) throw new Error(`No metadata or <title> tag found`);
    });
  }
}

// Summary
console.log('\n═══════════════════════════════════════════════');
console.log(`  WEBSITE TESTS: ${pass} passed, ${fail} failed out of ${pass + fail}`);
if (fail > 0) { console.log('\n  FAILED:'); fails.forEach(f => console.log(`    ✗ ${f.name}: ${f.error}`)); }
console.log('═══════════════════════════════════════════════\n');

process.exit(fail > 0 ? 1 : 0);
