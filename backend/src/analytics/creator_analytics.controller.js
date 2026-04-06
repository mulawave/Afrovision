const Channel = require('../channels/channel.model');
const CreatorStats = require('../channels/creator_stats.model');
const CreatorDailyStats = require('./creator_daily_stats.model');
const StreamStats = require('./stream_stats.model');
const User = require('../users/user.model');
const { getFirestore } = require('../utils/firestore');

// ─── Helpers ─────────────────────────────────────────────

function _generateInsights(last7Days, todayStats, stats) {
  const insights = [];

  // Best streaming day
  const sorted = [...last7Days].sort((a, b) => (b.total_earnings_ngn || 0) - (a.total_earnings_ngn || 0));
  if (sorted.length > 0 && (sorted[0].total_earnings_ngn || 0) > 0) {
    insights.push(`Your best day this week was ${sorted[0].day_label} — keep that momentum!`);
  }

  // Streaming frequency tip
  const totalStreams = last7Days.reduce((sum, d) => sum + (d.streams_count || 0), 0);
  if (totalStreams < 3) {
    insights.push('Streaming 3+ times a week grows subscriber retention by 2x. Try to go live more often.');
  }

  // Gift vs subscription split
  const totalGiftsNgn = last7Days.reduce((sum, d) => sum + (d.gifts_ngn || 0), 0);
  const totalSubsNgn = last7Days.reduce((sum, d) => sum + (d.subscriptions_ngn || 0), 0);
  const totalRevNgn = totalGiftsNgn + totalSubsNgn;
  if (totalRevNgn > 0) {
    const giftPct = Math.round((totalGiftsNgn / totalRevNgn) * 100);
    if (giftPct > 70) {
      insights.push(`${giftPct}% of your earnings came from gifts. Promote your subscription tier to build steady income.`);
    } else if (giftPct < 30) {
      insights.push(`${100 - giftPct}% of earnings are from subscriptions — great retention! Keep engaging live viewers for gifts.`);
    }
  }

  // Weekend comparison
  const weekend = last7Days.filter((d) => ['Sat', 'Sun'].includes(d.day_label));
  const weekday = last7Days.filter((d) => !['Sat', 'Sun'].includes(d.day_label));
  const avgWeekend = weekend.length ? weekend.reduce((s, d) => s + (d.total_earnings_ngn || 0), 0) / weekend.length : 0;
  const avgWeekday = weekday.length ? weekday.reduce((s, d) => s + (d.total_earnings_ngn || 0), 0) / weekday.length : 0;
  if (avgWeekend > avgWeekday * 1.3 && avgWeekend > 0) {
    insights.push('Your audience is more active on weekends. Schedule premium streams for Saturday/Sunday.');
  } else if (avgWeekday > avgWeekend * 1.3 && avgWeekday > 0) {
    insights.push('Weekday streams are earning more. Mid-week live sessions resonate with your audience.');
  }

  // Today momentum
  const todayEarnings = (todayStats?.total_earnings_ngn || 0) + (todayStats?.total_earnings_vpt || 0);
  if (todayEarnings > 0) {
    insights.push(`You've earned already today — great start! Share a post to drive more viewers.`);
  }

  if (insights.length === 0) {
    insights.push('Start streaming to unlock personalised insights about your audience and earnings.');
  }

  return insights;
}

/**
 * GET /creator/stats
 * Creator's own analytics overview.
 */
async function getMyStats(req, res) {
  try {
    const creatorUid = req.userId;

    const [todayStats, last7Days, stats] = await Promise.all([
      CreatorDailyStats.getToday(creatorUid),
      CreatorDailyStats.getLastNDays(creatorUid, 7),
      CreatorStats.getStats(creatorUid),
    ]);

    const last30Days = await CreatorDailyStats.getLastNDays(creatorUid, 30);

    const totalNgn30 = last30Days.reduce(
      (sum, d) => sum + (d.total_earnings_ngn || 0), 0,
    );
    const totalVpt30 = last30Days.reduce(
      (sum, d) => sum + (d.total_earnings_vpt || 0), 0,
    );

    const todayStreams = todayStats?.streams_count || 0;

    const insights = _generateInsights(last7Days, todayStats, stats);

    return res.json({
      stats: {
        total_earnings_ngn_30d: totalNgn30,
        total_earnings_vpt_30d: totalVpt30,
        subscriber_count: stats.subscriber_count || 0,
        lifetime_gifts_vpt: stats.total_gifts_received_vpt || 0,
        lifetime_gifts_ngn: stats.total_gifts_received_ngn || 0,
      },
      today: {
        gifts_ngn: todayStats?.gifts_ngn || 0,
        gifts_vpt: todayStats?.gifts_vpt || 0,
        subscriptions_ngn: todayStats?.subscriptions_ngn || 0,
        subscriptions_vpt: todayStats?.subscriptions_vpt || 0,
        stream_entries_ngn: todayStats?.stream_entries_ngn || 0,
        stream_entries_vpt: todayStats?.stream_entries_vpt || 0,
        total_earnings_ngn: todayStats?.total_earnings_ngn || 0,
        total_earnings_vpt: todayStats?.total_earnings_vpt || 0,
        streams_count: todayStreams,
      },
      chart: last7Days.map((d) => ({
        day_label: d.day_label,
        total_earnings_ngn: d.total_earnings_ngn || 0,
        total_earnings_vpt: d.total_earnings_vpt || 0,
      })),
      insights,
    });
  } catch (err) {
    console.error('[Analytics] getMyStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /creator/streams
 * Recent streams for the authenticated creator.
 */
function getMyStreams(req, res) {
  try {
    const streams = StreamStats.getByCreator(req.userId, 20);
    res.json({ streams });
  } catch (err) {
    console.error('[Analytics] getMyStreams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /creator/supporters
 * Top supporters by total gift spend on the creator's channels.
 * Aggregates gift_stats Firestore documents; results sorted desc.
 */
async function getMyTopSupporters(req, res) {
  try {
    const db = getFirestore();

    // Get all channel IDs owned by this creator
    const myChannels = Channel.getByOwner(req.userId).map((c) => c.id);
    if (myChannels.length === 0) return res.json({ supporters: [] });

    // Firestore `in` query max 10 items — chunk
    const CHUNK = 10;
    const chunks = [];
    for (let i = 0; i < myChannels.length; i += CHUNK) {
      chunks.push(myChannels.slice(i, i + CHUNK));
    }

    const totals = {}; // uid -> { ngn, vpt }

    await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await db.collection('gift_stats')
          .where('channel_id', 'in', chunk)
          .get();
        snapshot.forEach((doc) => {
          const d = doc.data();
          const uid = d.sender_uid;
          if (!uid) return;
          if (!totals[uid]) totals[uid] = { ngn: 0, vpt: 0 };
          totals[uid].ngn += (d.naira || 0) * 0.5; // creator's 50% share
          totals[uid].vpt += Math.floor((d.vpt_units || 0) * 0.5);
        });
      }),
    );

    const supporters = Object.entries(totals)
      .map(([uid, data]) => {
        const user = User.findById(uid);
        return {
          uid,
          name: user?.name || user?.email || 'Anonymous',
          total_gifts_ngn: Math.round(data.ngn),
          total_gifts_vpt: data.vpt,
        };
      })
      .sort((a, b) => (b.total_gifts_ngn + b.total_gifts_vpt) - (a.total_gifts_ngn + a.total_gifts_vpt))
      .slice(0, 10);

    res.json({ supporters });
  } catch (err) {
    console.error('[Analytics] getMyTopSupporters error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /creator/streams/end
 * Creator manually ends their active stream record.
 */
async function endMyStream(req, res) {
  try {
    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    const channel = Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) return res.status(403).json({ error: 'Not your channel' });

    const active = StreamStats.getActiveByChannel(channel_id);
    if (!active) return res.json({ message: 'No active stream to end' });

    const ended = await StreamStats.endStream(active.id);
    res.json({ stream: ended });
  } catch (err) {
    console.error('[Analytics] endMyStream error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /admin/creator/:uid/stats
 * Admin: view any creator's analytics.
 */
async function adminGetCreatorStats(req, res) {
  try {
    const caller = User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { uid } = req.params;
    const creator = User.findById(uid);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const [todayStats, last7Days, stats] = await Promise.all([
      CreatorDailyStats.getToday(uid),
      CreatorDailyStats.getLastNDays(uid, 7),
      CreatorStats.getStats(uid),
    ]);

    const last30Days = await CreatorDailyStats.getLastNDays(uid, 30);

    const totalNgn30 = last30Days.reduce((s, d) => s + (d.total_earnings_ngn || 0), 0);
    const totalVpt30 = last30Days.reduce((s, d) => s + (d.total_earnings_vpt || 0), 0);

    res.json({
      creator: { uid, name: creator.name, email: creator.email },
      stats: {
        total_earnings_ngn_30d: totalNgn30,
        total_earnings_vpt_30d: totalVpt30,
        subscriber_count: stats.subscriber_count || 0,
        lifetime_gifts_vpt: stats.total_gifts_received_vpt || 0,
        lifetime_gifts_ngn: stats.total_gifts_received_ngn || 0,
      },
      today: {
        total_earnings_ngn: todayStats?.total_earnings_ngn || 0,
        total_earnings_vpt: todayStats?.total_earnings_vpt || 0,
        streams_count: todayStats?.streams_count || 0,
      },
      chart: last7Days.map((d) => ({
        day_label: d.day_label,
        total_earnings_ngn: d.total_earnings_ngn || 0,
      })),
    });
  } catch (err) {
    console.error('[Analytics] adminGetCreatorStats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getMyStats,
  getMyStreams,
  getMyTopSupporters,
  endMyStream,
  adminGetCreatorStats,
};
