const { google } = require('googleapis');
const { extractGCSPath } = require('../utils/gcs');

const LOCATION = process.env.TRANSCODER_LOCATION || 'us-central1';
const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';

// Kill switch: the Transcoder API is expensive (HD SKU ~$0.03/output-minute).
// Transcoding is DISABLED unless TRANSCODING_ENABLED=true is set explicitly.
// When disabled, playback falls back to the original MP4 (already handled by
// broadcast.controller.js and wave.controller.js).
const TRANSCODING_ENABLED = String(process.env.TRANSCODING_ENABLED || '').toLowerCase() === 'true';

// Configurable rendition ladder to control cost when re-enabled.
// e.g. TRANSCODER_RENDITIONS=480 (SD only, cheapest) or TRANSCODER_RENDITIONS=480,720
const ALL_RENDITIONS = {
  240: { key: 'video-240p', height: 240, width: 426, bitrate: 400000 },
  480: { key: 'video-480p', height: 480, width: 854, bitrate: 1100000 },
  720: { key: 'video-720p', height: 720, width: 1280, bitrate: 2500000 },
  1080: { key: 'video-1080p', height: 1080, width: 1920, bitrate: 5000000 },
};

function getEnabledRenditions() {
  const raw = String(process.env.TRANSCODER_RENDITIONS || '240,480').trim();
  const heights = raw.split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter((h) => ALL_RENDITIONS[h]);
  return heights.length > 0 ? heights.map((h) => ALL_RENDITIONS[h]) : [ALL_RENDITIONS[480]];
}

function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || null;
}

function getOutputPrefix(videoId) {
  return `hls/${videoId}`;
}

function getMasterPlaylistUrl(videoId) {
  return `/broadcast/hls/${videoId}/master.m3u8`;
}

function buildJobConfig() {
  const renditions = getEnabledRenditions();
  const elementaryStreams = renditions.map((rendition) => ({
    key: rendition.key,
    videoStream: {
      h264: {
        heightPixels: rendition.height,
        widthPixels: rendition.width,
        bitrateBps: rendition.bitrate,
        frameRate: 30,
        rateControlMode: 'vbr',
        vbvSizeBits: rendition.bitrate * 2,
        vbvFullnessBits: Math.floor(rendition.bitrate * 1.8),
        gopDuration: '2s',
        entropyCoder: 'cabac',
      },
    },
  }));
  elementaryStreams.push({
    key: 'audio-main',
    audioStream: {
      codec: 'aac',
      bitrateBps: 128000,
      channelCount: 2,
      channelLayout: ['fl', 'fr'],
      sampleRateHertz: 48000,
    },
  });

  const muxStreams = renditions.map((rendition) => ({
    key: `hls-${rendition.height}p`,
    container: 'ts',
    elementaryStreams: [rendition.key, 'audio-main'],
    segmentSettings: { segmentDuration: '4s' },
  }));

  return {
    elementaryStreams,
    muxStreams,
    manifests: [{ fileName: 'master.m3u8', type: 'HLS', muxStreams: muxStreams.map((stream) => stream.key) }],
  };
}

async function getClient() {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const authClient = await auth.getClient();
  return { authClient, api: google.transcoder('v1') };
}

async function startTranscode(video, outputPrefixOverride = null) {
  if (!TRANSCODING_ENABLED) {
    // Cost control: skip Transcoder API entirely; playback uses the original MP4.
    return { transcoding_status: 'unavailable', transcoding_error: 'transcoding_disabled' };
  }
  const projectId = getProjectId();
  const inputPath = extractGCSPath(video.video_url);
  if (!projectId || !inputPath) {
    return { transcoding_status: 'unavailable', transcoding_error: !projectId ? 'project_not_configured' : 'invalid_input' };
  }

  const { authClient, api } = await getClient();
  const outputPrefix = outputPrefixOverride || getOutputPrefix(video.id);
  const response = await api.projects.locations.jobs.create({
    auth: authClient,
    parent: `projects/${projectId}/locations/${LOCATION}`,
    requestBody: {
      inputUri: `gs://${BUCKET_NAME}/${inputPath}`,
      outputUri: `gs://${BUCKET_NAME}/${outputPrefix}/`,
      config: buildJobConfig(),
      labels: { video_id: video.id.replace(/[^a-z0-9_-]/gi, '_').toLowerCase().slice(0, 63) },
    },
  });

  return {
    transcoding_status: 'processing',
    transcoding_job_name: response.data.name,
    transcoding_error: null,
    hls_output_prefix: outputPrefix,
  };
}

async function refreshTranscode(video) {
  if (!video?.transcoding_job_name || !['processing', 'pending'].includes(video.transcoding_status)) {
    return null;
  }

  const { authClient, api } = await getClient();
  const response = await api.projects.locations.jobs.get({ auth: authClient, name: video.transcoding_job_name });
  const state = String(response.data.state || '').toUpperCase();

  if (state === 'SUCCEEDED') {
    return {
      transcoding_status: 'ready',
      transcoding_error: null,
      master_playlist_url: getMasterPlaylistUrl(video.id),
      available_renditions: getEnabledRenditions().map((r) => r.height),
      transcoding_completed_at: Date.now(),
      transcoding_checked_at: Date.now(),
    };
  }
  if (state === 'FAILED') {
    return {
      transcoding_status: 'failed',
      transcoding_error: response.data.error?.message || 'Transcoding failed',
      transcoding_completed_at: Date.now(),
      transcoding_checked_at: Date.now(),
    };
  }
  return { transcoding_status: 'processing', transcoding_checked_at: Date.now() };
}

module.exports = {
  buildJobConfig,
  getOutputPrefix,
  getMasterPlaylistUrl,
  startTranscode,
  refreshTranscode,
};
