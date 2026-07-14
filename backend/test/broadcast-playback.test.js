const { resolveScheduleState } = require('../src/broadcast/scheduler-resolver');
const { buildJobConfig, getMasterPlaylistUrl } = require('../src/broadcast/transcoder.service');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  + ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  - ${name}: ${error.message}`);
  }
}

console.log('\n-- Broadcast Playback Tests --\n');

const now = 10_000;
const ended = { id: 'ended', start_time: 1_000, end_time: 5_000 };
const current = { id: 'current', start_time: 8_000, end_time: 12_000 };
const upcoming = { id: 'upcoming', start_time: 15_000, end_time: 20_000 };

test('current program is authoritative when its window contains server time', () => {
  const state = resolveScheduleState([upcoming, ended, current], now);
  assert(state.reason === 'current', 'expected current reason');
  assert(state.chosenProgram?.id === 'current', 'expected current program');
  assert(state.upcomingProgram?.id === 'upcoming', 'expected upcoming program');
  assert(state.isLoop === false, 'current playback must not loop');
});

test('upcoming-only schedule does not loop ended content', () => {
  const state = resolveScheduleState([ended, upcoming], now);
  assert(state.reason === 'upcoming', 'expected upcoming reason');
  assert(state.chosenProgram === null, 'expected no now-playing program');
  assert(state.upcomingProgram?.id === 'upcoming', 'expected next program');
});

test('last ended program loops only when no future schedule exists', () => {
  const state = resolveScheduleState([ended], now);
  assert(state.reason === 'loop', 'expected loop reason');
  assert(state.chosenProgram?.id === 'ended', 'expected latest ended program');
  assert(state.isLoop === true, 'expected loop flag');
});

test('empty schedule resolves offline', () => {
  const state = resolveScheduleState([], now);
  assert(state.reason === 'offline', 'expected offline reason');
  assert(state.chosenProgram === null, 'expected no chosen program');
});

test('transcoder config includes adaptive HLS renditions', () => {
  const config = buildJobConfig();
  const heights = config.elementaryStreams
    .map((stream) => stream.videoStream?.h264?.heightPixels)
    .filter(Boolean);
  assert(JSON.stringify(heights) === JSON.stringify([240, 480, 720, 1080]), 'expected 240p through 1080p');
  assert(config.manifests[0].type === 'HLS', 'expected HLS manifest');
  assert(config.muxStreams.length === 4, 'expected four mux streams');
  assert(getMasterPlaylistUrl('video-1') === '/broadcast/hls/video-1/master.m3u8', 'expected proxied master URL');
});

console.log(`\n-- ${passed} passed, ${failed} failed --\n`);
if (failed > 0) process.exit(1);
