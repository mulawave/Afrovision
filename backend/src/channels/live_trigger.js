const CreatorSub = require('../subscriptions/creator_subscription.model');
const User = require('../users/user.model');
const Channel = require('./channel.model');
const NotificationService = require('../notifications/notification.service');

// Deduplicate go-live events: prevent spamming if called multiple times in quick succession
// Key: channelId, Value: timestamp of last trigger
const _recentTriggers = new Map();
const DEBOUNCE_MS = 60_000; // 1 minute

/**
 * Called when a creator's channel goes live.
 * Notifies all active subscribers with a push notification.
 *
 * @param {string} creatorUid
 * @param {string} channelId
 * @returns {{ notified: number, skipped: boolean }}
 */
async function onCreatorGoLive(creatorUid, channelId) {
  // Debounce — skip if triggered < 1 minute ago for the same channel
  const lastTrigger = _recentTriggers.get(channelId);
  if (lastTrigger && Date.now() - lastTrigger < DEBOUNCE_MS) {
    return { notified: 0, skipped: true };
  }
  _recentTriggers.set(channelId, Date.now());

  // Clean up stale debounce entries every hour
  setInterval(() => {
    const now = Date.now();
    for (const [cid, ts] of _recentTriggers) {
      if (now - ts > DEBOUNCE_MS * 60) _recentTriggers.delete(cid);
    }
  }, 3_600_000).unref();

  const creator = User.findById(creatorUid);
  const channel = Channel.findById(channelId);
  if (!creator || !channel) return { notified: 0, skipped: false };

  const creatorName = creator.name || creator.email || 'A creator';
  const channelName = channel.name || 'their channel';

  // Get all active subscribers
  const activeSubs = CreatorSub.getByCreator(creatorUid).filter((s) => s.status === 'active');
  if (activeSubs.length === 0) return { notified: 0, skipped: false };

  let notified = 0;
  // Send notifications in parallel batches of 10 to avoid rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < activeSubs.length; i += BATCH_SIZE) {
    const batch = activeSubs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sub) => {
        try {
          const result = await NotificationService.notifyUser(sub.subscriber_uid, {
            title: `🔴 ${creatorName} is LIVE`,
            body: `${creatorName} just went live on ${channelName}. Tune in now!`,
            data: {
              type: 'creator_live',
              creator_uid: creatorUid,
              channel_id: channelId,
            },
            type: 'creator_live',
            link: `/live/${channelId}`,
            source: 'go_live',
          });
          notified += result.successCount;
        } catch (_) {
          // Individual notification failure is non-fatal
        }
      })
    );
  }

  return { notified, skipped: false };
}

module.exports = { onCreatorGoLive };
