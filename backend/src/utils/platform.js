// The 3 client platforms Afrovision ships on. Shared so viewer/watch-time
// analytics are tagged consistently across channel.controller.js,
// socket.service.js, and the admin dashboard.
const PLATFORMS = ['web', 'android', 'tv'];

function normalizePlatform(raw) {
  const value = String(raw || '').toLowerCase().trim();
  return PLATFORMS.includes(value) ? value : 'web';
}

function emptyPlatformBreakdown() {
  return { web: 0, android: 0, tv: 0 };
}

module.exports = {
  PLATFORMS,
  normalizePlatform,
  emptyPlatformBreakdown,
};
