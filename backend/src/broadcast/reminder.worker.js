const Reminder = require('./reminder.model');
const User = require('../users/user.model');
const NotificationService = require('../notifications/notification.service');
const { sendReminderEmail } = require('../utils/email');
const { getFirestore } = require('../utils/firestore');

const REMINDER_LOCK_COLLECTION = 'ops_locks';
const REMINDER_LOCK_DOC = 'broadcast_reminders';
const REMINDER_LOCK_TTL_MS = 55 * 1000;

let activeRunPromise = null;

function createSummary(trigger) {
  return {
    trigger,
    started_at: Date.now(),
    due_count: 0,
    sent_count: 0,
    error_count: 0,
  };
}

async function acquireReminderLease({ holder, trigger, force = false }) {
  const db = getFirestore();
  const leaseRef = db.collection(REMINDER_LOCK_COLLECTION).doc(REMINDER_LOCK_DOC);
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
      expires_at: now + REMINDER_LOCK_TTL_MS,
    };

    tx.set(leaseRef, nextLease, { merge: true });
    acquired = true;
    currentLease = nextLease;
  });

  return { acquired, lease: currentLease };
}

async function releaseReminderLease({ holder, summary, status, errorMessage = null }) {
  const db = getFirestore();
  const leaseRef = db.collection(REMINDER_LOCK_COLLECTION).doc(REMINDER_LOCK_DOC);
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

async function processDueReminders() {
  const summary = createSummary('direct');
  const now = Date.now();
  const due = await Reminder.getDueReminders(now);
  summary.due_count = due.length;

  for (const reminder of due) {
    try {
      await NotificationService.notifyUser(reminder.user_id, {
        title: '🔔 Show Starting Soon!',
        body: `"${reminder.program_title}" on ${reminder.channel_name} is about to start!`,
        type: 'reminder',
        link: `/live/${reminder.channel_id}`,
        data: {
          program_id: reminder.program_id,
          channel_id: reminder.channel_id,
        },
      });

      const user = await User.findById(reminder.user_id);
      if (user && user.email && !user.email.endsWith('@afrovision.invalid')) {
        sendReminderEmail({
          to: user.email,
          programTitle: reminder.program_title,
          channelName: reminder.channel_name,
          channelId: reminder.channel_id,
        }).catch((err) => console.error('[ReminderWorker] Email error:', err.message));
      }

      await Reminder.markSent(reminder.id);
      summary.sent_count += 1;
    } catch (error) {
      summary.error_count += 1;
      console.error(`[ReminderWorker] Failed reminder ${reminder.id}:`, error.message);
    }
  }

  summary.finished_at = Date.now();
  return summary;
}

async function runScheduledReminderDispatch({ trigger = 'manual', force = false } = {}) {
  if (activeRunPromise) {
    return activeRunPromise;
  }

  const holder = `${trigger}:${process.pid}:${Date.now()}`;

  activeRunPromise = (async () => {
    const { acquired, lease } = await acquireReminderLease({ holder, trigger, force });
    if (!acquired) {
      return {
        skipped: true,
        reason: 'lease-held',
        lease,
      };
    }

    try {
      const summary = await processDueReminders();
      summary.trigger = trigger;
      await releaseReminderLease({ holder, summary, status: 'idle' });
      return {
        skipped: false,
        summary,
      };
    } catch (error) {
      await releaseReminderLease({
        holder,
        summary: null,
        status: 'failed',
        errorMessage: error.message,
      });
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
  processDueReminders,
  runScheduledReminderDispatch,
};