const { google } = require('googleapis');
const { extractGCSPath } = require('../utils/gcs');

const LOCATION = process.env.TRANSCODER_LOCATION || 'us-central1';
const BUCKET_NAME = process.env.GCS_BUCKET || 'afrovision-media';

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
  const renditions = [
    { key: 'video-240p', height: 240, width: 426, bitrate: 400000 },
    { key: 'video-480p', height: 480, width: 854, bitrate: 1100000 },
    { key: 'video-720p', height: 720, width: 1280, bitrate: 2500000 },
    { key: 'video-1080p', height: 1080, width: 1920, bitrate: 5000000 },
  ];
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

async function startTranscode(video) {
  const projectId = getProjectId();
  const inputPath = extractGCSPath(video.video_url);
  if (!projectId || !inputPath) {
    return { transcoding_status: 'unavailable', transcoding_error: !projectId ? 'project_not_configured' : 'invalid_input' };
  }

  const { authClient, api } = await getClient();
  const outputPrefix = getOutputPrefix(video.id);
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
      available_renditions: [240, 480, 720, 1080],
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
