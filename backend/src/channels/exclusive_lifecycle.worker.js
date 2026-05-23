const ExclusiveAccess = require('./exclusive_access.model');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const NotificationService = require('../notifications/notification.service');
const { sendExclusiveLifecycleEmail } = require('../utils/email');
const { buildExclusiveLifecycleMessage } = require('./exclusive_lifecycle.messages');
const { getFirestore } = require('../utils/firestore');

const EXCLUSIVE_LOCK_COLLECTION = 'ops_locks';
const EXCLUSIVE_LOCK_DOC = 'exclusive_lifecycle';
const EXCLUSIVE_LOCK_TTL_MS = 55 * 60 * 1000;
const OPS_SUMMARIES_COLLECTION = 'ops_summaries';
const EXCLUSIVE_SUMMARY_DOC = 'exclusive_lifecycle';

const DAY_MS = 24 * 60 * 60 * 1000;

let activeRunPromise = null;

function createSummary(trigger) {
  return {
    trigger,
    started_at: Date.now(),
    scanned_active: 0,
    user_reminders_sent: 0,
    creator_reminders_sent: 0,
    user_expiry_sent: 0,
    creator_expiry_sent: 0,
    expired_marked: 0,
    anomaly_count: 0,
    error_count: 0,
    ops_alerts_sent: 0,
  };
}

function determineReminderBucket(msLeft) {
  if (msLeft <= DAY_MS) return 'd1';
  if (msLeft <= 3 * DAY_MS) return 'd3';
  if (msLeft <= 7 * DAY_MS) return 'd7';
  return null;
}

function daysRemaining(msLeft) {
  return Math.max(0, Math.ceil(msLeft / DAY_MS));
}

function parseOpsAlertRecipients() {
  const raw = String(process.env.EXCLUSIVE_OPS_ALERT_USER_IDS || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function listOpsAlertRecipients() {
  const admins = (await User.getAll(true))
    .filter((user) => user && user.role === 'admin' && !user.deleted_at)
    .map((user) => user.id);

  return [...new Set([...admins, ...parseOpsAlertRecipients()])];
}

async function dispatchOpsAlert({ title, body, data = {} }) {
  const recipients = await listOpsAlertRecipients();
  if (!recipients.length) return 0;

  let sent = 0;
  await Promise.all(recipients.map(async (userId) => {
    try {
      const recipient = await User.findById(userId);
      const opsMessage = buildExclusiveLifecycleMessage('ops.alert', {
        user: recipient,
        errorCount: Number(data.error_count || 0),
        anomalyCount: Number(data.anomaly_count || 0),
      });

      await NotificationService.notifyUser(userId, {
        title: opsMessage.title || title,
        body: opsMessage.body || body,
        type: opsMessage.type || 'exclusive_ops_alert',
        link: '/admin',
        data,
      });

      if (recipient && recipient.email && !recipient.email.endsWith('@afrovision.invalid')) {
        sendExclusiveLifecycleEmail({
          to: recipient.email,
          subject: opsMessage.emailSubject || title,
          title: opsMessage.title || title,
          body: opsMessage.body || body,
          ctaUrl: 'https://afrovision-website-134538542038.us-central1.run.app/admin',
          ctaLabel: opsMessage.ctaLabel || 'Open Admin',
        }).catch((error) => console.error('[ExclusiveLifecycleWorker] Ops email failed:', error.message));
      }

      sent += 1;
    } catch (error) {
      console.error('[ExclusiveLifecycleWorker] Ops alert failed:', error.message);
    }
  }));

  return sent;
}

async function acquireExclusiveLease({ holder, trigger, force = false }) {
  const db = getFirestore();
  const leaseRef = db.collection(EXCLUSIVE_LOCK_COLLECTION).doc(EXCLUSIVE_LOCK_DOC);
  const now = Date.now();
  let acquired = false;
  let currentLease = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(leaseRef);
    const lease = snapshot.exists ? snapshot.data() : null;
    const activeLease = lease
      && lease.status === 'running'
      && typeof lease.expires_at === 'number'
      && lease.expires_at > now;

    if (activeLease && !force) {
      currentLease = lease;
      return;
    }

    const nextLease = {
      status: 'running',
      trigger,
      holder,
      started_at: now,
      updated_at: now,
      expires_at: now + EXCLUSIVE_LOCK_TTL_MS,
    };

    tx.set(leaseRef, nextLease, { merge: true });
    acquired = true;
    currentLease = nextLease;
  });

  return { acquired, lease: currentLease };
}

async function releaseExclusiveLease({ holder, summary, status, errorMessage = null }) {
  const db = getFirestore();
  const leaseRef = db.collection(EXCLUSIVE_LOCK_COLLECTION).doc(EXCLUSIVE_LOCK_DOC);
  const finishedAt = Date.now();

  await leaseRef.set({
    status,
    holder,
    updated_at: finishedAt,
    expires_at: finishedAt,
    last_finished_at: finishedAt,
    last_error: errorMessage,
    last_summary: summary,
  }, { merge: true });
}

async function persistLifecycleSummary(summary) {
  const db = getFirestore();
  await db.collection(OPS_SUMMARIES_COLLECTION).doc(EXCLUSIVE_SUMMARY_DOC).set({
    ...summary,
    updated_at: Date.now(),
  }, { merge: true });
}

async function processExclusiveLifecycle() {
  const now = Date.now();
  const summary = createSummary('direct');
  const accesses = await ExclusiveAccess.listActiveAccesses();
  summary.scanned_active = accesses.length;

  for (const access of accesses) {
    try {
      const expiresAt = Number(access.expires_at || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
        summary.anomaly_count += 1;
        continue;
      }

      const channel = await Channel.findById(access.channel_id);
      if (!channel) {
        summary.anomaly_count += 1;
        continue;
      }

      const flags = access.lifecycle_flags || {};
      const msLeft = expiresAt - now;
      const viewer = await User.findById(access.user_uid);
      const owner = await User.findById(channel.owner_id);

      if (msLeft <= 0) {
        await ExclusiveAccess.markExpired(access.id, now);
        summary.expired_marked += 1;

        if (!access.expiry_notified_at) {
          const viewerExpiredMessage = buildExclusiveLifecycleMessage('user.expired', {
            user: viewer,
            channelName: channel.name,
          });

          await NotificationService.notifyUser(access.user_uid, {
            title: viewerExpiredMessage.title,
            body: viewerExpiredMessage.body,
            type: viewerExpiredMessage.type,
            link: `/channel/${channel.id}/exclusive-access`,
            data: {
              channel_id: channel.id,
              access_id: access.id,
              expires_at: String(expiresAt),
            },
          });

          if (viewer && viewer.email && !viewer.email.endsWith('@afrovision.invalid')) {
            sendExclusiveLifecycleEmail({
              to: viewer.email,
              subject: viewerExpiredMessage.emailSubject,
              title: viewerExpiredMessage.title,
              body: viewerExpiredMessage.body,
              ctaUrl: `https://afrovision-website-134538542038.us-central1.run.app/channel/${channel.id}/exclusive-access`,
              ctaLabel: viewerExpiredMessage.ctaLabel,
            }).catch((error) => console.error('[ExclusiveLifecycleWorker] viewer expired email failed:', error.message));
          }

          await ExclusiveAccess.markExpiryNotified(access.id, now);
          summary.user_expiry_sent += 1;
        }

        if (!flags.creator_expired) {
          const creatorExpiredMessage = buildExclusiveLifecycleMessage('creator.expired', {
            user: owner,
            channelName: channel.name,
          });

          await NotificationService.notifyUser(channel.owner_id, {
            title: creatorExpiredMessage.title,
            body: creatorExpiredMessage.body,
            type: creatorExpiredMessage.type,
            link: '/dashboard',
            data: {
              channel_id: channel.id,
              user_uid: access.user_uid,
              access_id: access.id,
            },
          });

          if (owner && owner.email && !owner.email.endsWith('@afrovision.invalid')) {
            sendExclusiveLifecycleEmail({
              to: owner.email,
              subject: creatorExpiredMessage.emailSubject,
              title: creatorExpiredMessage.title,
              body: creatorExpiredMessage.body,
              ctaUrl: 'https://afrovision-website-134538542038.us-central1.run.app/dashboard',
              ctaLabel: creatorExpiredMessage.ctaLabel,
            }).catch((error) => console.error('[ExclusiveLifecycleWorker] creator expired email failed:', error.message));
          }

          await ExclusiveAccess.markLifecycleFlag(access.id, 'creator_expired', now);
          summary.creator_expiry_sent += 1;
        }

        continue;
      }

      const bucket = determineReminderBucket(msLeft);
      if (!bucket) continue;

      const reminderState = access.reminder_sent_at || {};
      if (reminderState[bucket]) continue;

      const viewerReminderMessage = buildExclusiveLifecycleMessage('user.reminder', {
        user: viewer,
        channelName: channel.name,
        daysLeft: daysRemaining(msLeft),
      });

      await NotificationService.notifyUser(access.user_uid, {
        title: viewerReminderMessage.title,
        body: viewerReminderMessage.body,
        type: viewerReminderMessage.type,
        link: `/channel/${channel.id}/exclusive-access`,
        data: {
          channel_id: channel.id,
          access_id: access.id,
          reminder_bucket: bucket,
          expires_at: String(expiresAt),
        },
      });

      if (viewer && viewer.email && !viewer.email.endsWith('@afrovision.invalid')) {
        sendExclusiveLifecycleEmail({
          to: viewer.email,
          subject: viewerReminderMessage.emailSubject,
          title: viewerReminderMessage.title,
          body: viewerReminderMessage.body,
          ctaUrl: `https://afrovision-website-134538542038.us-central1.run.app/channel/${channel.id}/exclusive-access`,
          ctaLabel: viewerReminderMessage.ctaLabel,
        }).catch((error) => console.error('[ExclusiveLifecycleWorker] viewer reminder email failed:', error.message));
      }

      await ExclusiveAccess.markReminderSent(access.id, bucket, now);
      summary.user_reminders_sent += 1;

      if (bucket === 'd1' && !flags.creator_d1) {
        const creatorExpiringMessage = buildExclusiveLifecycleMessage('creator.expiring', {
          user: owner,
          channelName: channel.name,
        });

        await NotificationService.notifyUser(channel.owner_id, {
          title: creatorExpiringMessage.title,
          body: creatorExpiringMessage.body,
          type: creatorExpiringMessage.type,
          link: '/dashboard',
          data: {
            channel_id: channel.id,
            user_uid: access.user_uid,
            access_id: access.id,
            expires_at: String(expiresAt),
          },
        });

        if (owner && owner.email && !owner.email.endsWith('@afrovision.invalid')) {
          sendExclusiveLifecycleEmail({
            to: owner.email,
            subject: creatorExpiringMessage.emailSubject,
            title: creatorExpiringMessage.title,
            body: creatorExpiringMessage.body,
            ctaUrl: 'https://afrovision-website-134538542038.us-central1.run.app/dashboard',
            ctaLabel: creatorExpiringMessage.ctaLabel,
          }).catch((error) => console.error('[ExclusiveLifecycleWorker] creator expiring email failed:', error.message));
        }

        await ExclusiveAccess.markLifecycleFlag(access.id, 'creator_d1', now);
        summary.creator_reminders_sent += 1;
      }
    } catch (error) {
      summary.error_count += 1;
      console.error('[ExclusiveLifecycleWorker] Failed lifecycle record:', error.message);
    }
  }

  if (summary.error_count > 0 || summary.anomaly_count > 0) {
    summary.ops_alerts_sent = await dispatchOpsAlert({
      title: 'Exclusive Lifecycle Worker Alert',
      body: `Exclusive lifecycle run completed with ${summary.error_count} error(s) and ${summary.anomaly_count} anomaly record(s).`,
      data: {
        trigger: summary.trigger,
        scanned_active: String(summary.scanned_active),
        error_count: String(summary.error_count),
        anomaly_count: String(summary.anomaly_count),
      },
    });
  }

  summary.finished_at = Date.now();
  await persistLifecycleSummary(summary);
  return summary;
}

async function runScheduledExclusiveLifecycle({ trigger = 'manual', force = false } = {}) {
  if (activeRunPromise) {
    return activeRunPromise;
  }

  const holder = `${trigger}:${process.pid}:${Date.now()}`;

  activeRunPromise = (async () => {
    const { acquired, lease } = await acquireExclusiveLease({ holder, trigger, force });
    if (!acquired) {
      return {
        skipped: true,
        reason: 'lease-held',
        lease,
      };
    }

    try {
      const summary = await processExclusiveLifecycle();
      summary.trigger = trigger;
      await releaseExclusiveLease({ holder, summary, status: 'idle' });
      return {
        skipped: false,
        summary,
      };
    } catch (error) {
      await releaseExclusiveLease({
        holder,
        summary: null,
        status: 'failed',
        errorMessage: error.message,
      });

      const alertsSent = await dispatchOpsAlert({
        title: 'Exclusive Lifecycle Worker Failed',
        body: `Exclusive lifecycle run failed: ${error.message}`,
        data: {
          trigger,
          holder,
        },
      });
      console.error(`[ExclusiveLifecycleWorker] Failure alerts sent: ${alertsSent}`);
      throw error;
    }
  })();

  try {
    return await activeRunPromise;
  } finally {
    activeRunPromise = null;
  }
}

module.exports = {
  processExclusiveLifecycle,
  runScheduledExclusiveLifecycle,
};
