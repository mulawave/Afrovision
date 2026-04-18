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
    const myChannelsRaw = Channel.getByOwner(req.userId);
    const myChannels = myChannelsRaw.map((c) => c.id);
    const channelTypeById = new Map(
      myChannelsRaw.map((channel) => [channel.id, channel.type || 'public']),
    );
    if (myChannels.length === 0) return res.json({ supporters: [] });

    // Firestore `in` query max 10 items — chunk
    const CHUNK = 10;
    const chunks = [];
    for (let i = 0; i < myChannels.length; i += CHUNK) {
      chunks.push(myChannels.slice(i, i + CHUNK));
    }

    const totals = {}; // key -> { uid, name, ngn, vpt }

    await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await db.collection('gift_stats')
          .where('channel_id', 'in', chunk)
          .get();
        snapshot.forEach((doc) => {
          const d = doc.data();
          const channelType = channelTypeById.get(d.channel_id) || 'public';

          if (channelType === 'private') {
            const alias = d.sender_alias || 'Anonymous';
            const key = `anon:${d.channel_id}:${alias}`;
            if (!totals[key]) {
              totals[key] = { uid: '', name: alias, ngn: 0, vpt: 0 };
            }
            totals[key].ngn += (d.naira || 0) * 0.5;
            totals[key].vpt += Math.floor((d.vpt_units || 0) * 0.5);
            return;
          }

          const uid = d.sender_uid;
          if (!uid) return;
          const key = `uid:${uid}`;
          if (!totals[key]) {
            totals[key] = { uid, name: null, ngn: 0, vpt: 0 };
          }
          totals[key].ngn += (d.naira || 0) * 0.5; // creator's 50% share
          totals[key].vpt += Math.floor((d.vpt_units || 0) * 0.5);
        });
      }),
    );

    const supporters = Object.entries(totals)
      .map(([, data]) => {
        const user = data.uid ? User.findById(data.uid) : null;
        return {
          uid: data.uid,
          name: data.name || user?.name || user?.email || 'Anonymous',
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

const KycModel = require('../kyc/kyc.model');

/**
 * GET /analytics/creator/channel?channel_id=X&period=7d|30d|90d|365d
 * Comprehensive channel analytics for a creator.
 */
async function getChannelAnalytics(req, res) {
  try {
    const creatorUid = req.userId;
    const { channel_id, period = '30d' } = req.query;

    if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30;

    // ── Date range
    const now = Date.now();
    const sinceMs = now - days * 24 * 60 * 60 * 1000;

    const db = getFirestore();

    // ── Fetch in parallel: events + stream stats + daily stats
    const [eventsSnap, channelStreams, dailyDocs, chatSnap] = await Promise.all([
      db.collection('channel_events')
        .where('channel_id', '==', channel_id)
        .where('created_at', '>=', sinceMs)
        .orderBy('created_at', 'asc')
        .limit(5000)
        .get(),
      StreamStats.getByChannel ? StreamStats.getByChannel(channel_id) : [],
      db.collection('creator_daily_stats')
        .where('creator_uid', '==', creatorUid)
        .orderBy('date', 'desc')
        .limit(days)
        .get(),
      db.collection('channel_chats').doc(channel_id).collection('messages')
        .where('created_at', '>=', sinceMs)
        .limit(2000)
        .get().catch(() => ({ size: 0, forEach: () => {} })),
    ]);

    const events = eventsSnap.docs.map((d) => d.data());
    const reactions = events.filter((e) => e.type === 'reaction');
    const giftEvents = events.filter((e) => e.type === 'gift');
    const viewEvents = events.filter((e) => e.type === 'view');
    const totalComments = chatSnap.size || 0;

    // ── Derive views from channel_events (unique senders = unique viewers)
    // Anyone who sent a reaction, gift, comment, or view event has viewed the channel
    const allSendersByDay = {};
    for (const ev of events) {
      if (!ev.sender_uid) continue;
      const dayKey = new Date(ev.created_at).toISOString().split('T')[0];
      if (!allSendersByDay[dayKey]) allSendersByDay[dayKey] = new Set();
      allSendersByDay[dayKey].add(ev.sender_uid);
    }
    // Also count chat senders as viewers
    const chatSendersByDay = {};
    chatSnap.forEach((doc) => {
      const msg = doc.data();
      if (!msg.sender_uid) return;
      const dayKey = new Date(msg.created_at).toISOString().split('T')[0];
      if (!chatSendersByDay[dayKey]) chatSendersByDay[dayKey] = new Set();
      chatSendersByDay[dayKey].add(msg.sender_uid);
      if (!allSendersByDay[dayKey]) allSendersByDay[dayKey] = new Set();
      allSendersByDay[dayKey].add(msg.sender_uid);
    });

    // ── Viewer activity by hour of day (based on event timestamps)
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, events: 0 }));
    for (const ev of events) {
      const h = new Date(ev.created_at).getUTCHours();
      hourBuckets[h].events++;
    }
    const peakHourEntry = hourBuckets.reduce((a, b) => (b.events > a.events ? b : a), hourBuckets[0]);
    const peakHour = peakHourEntry.hour;
    const peakHourLabel = `${peakHour.toString().padStart(2, '0')}:00`;

    // ── Daily timeline from creator_daily_stats
    const dailyMap = {};
    dailyDocs.forEach((doc) => {
      const d = doc.data();
      dailyMap[d.date] = d;
    });
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = dt.toISOString().split('T')[0];
      const d = dailyMap[key] || {};
      // Use daily stats if available; otherwise derive from channel_events unique senders
      const derivedUniqueViewers = allSendersByDay[key] ? allSendersByDay[key].size : 0;
      const statsViewers = d.total_viewers || 0;
      const statsUnique = d.unique_viewers || 0;
      timeline.push({
        date: key,
        views: Math.max(statsViewers, derivedUniqueViewers),
        unique_viewers: Math.max(statsUnique, derivedUniqueViewers),
        gifts_ngn: d.gifts_ngn || 0,
        gifts_vpt: d.gifts_vpt || 0,
        streams: d.streams_count || 0,
      });
    }

    // ── Period highs from timeline
    const sortedByViews = [...timeline].sort((a, b) => b.views - a.views);
    const bestDay = sortedByViews[0] || null;

    // Weekly / monthly totals from timeline
    const last7 = timeline.slice(-7);
    const last30 = timeline.slice(-30);
    const weeklyViews = last7.reduce((s, d) => s + d.views, 0);
    const monthlyViews = last30.reduce((s, d) => s + d.views, 0);
    const yearlyViews = timeline.reduce((s, d) => s + d.views, 0);

    // ── Stream-level peak viewers
    const filteredStreams = channelStreams.filter
      ? channelStreams.filter((s) => s.start_time >= sinceMs)
      : [];
    const peakViewers = filteredStreams.length
      ? Math.max(...filteredStreams.map((s) => s.peak_viewers || 0))
      : 0;

    // ── Gift totals from gift_events
    let totalGiftsNgn = 0;
    let totalGiftsVpt = 0;
    giftEvents.forEach((e) => {
      totalGiftsNgn += e.naira || e.ngn || 0;
      totalGiftsVpt += e.vpt_units || e.vpt || 0;
    });

    // ── Demographics from KYC records of unique senders
    const senderUids = [...new Set(events.map((e) => e.sender_uid).filter(Boolean))];

    const genderCounts = { male: 0, female: 0, non_binary: 0, prefer_not_to_say: 0, unknown: 0 };
    const ageCounts = { '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, unknown: 0 };
    const countryMap = {};

    for (const uid of senderUids) {
      const kyc = KycModel.findByUserId(uid);
      if (!kyc) { genderCounts.unknown++; ageCounts.unknown++; continue; }

      // Gender
      const g = kyc.gender || 'unknown';
      genderCounts[g] = (genderCounts[g] || 0) + 1;

      // Age from date_of_birth
      if (kyc.date_of_birth) {
        const dob = new Date(kyc.date_of_birth);
        const age = Math.floor((now - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) ageCounts['13-17']++;
        else if (age < 25) ageCounts['18-24']++;
        else if (age < 35) ageCounts['25-34']++;
        else if (age < 45) ageCounts['35-44']++;
        else if (age < 55) ageCounts['45-54']++;
        else ageCounts['55+']++;
      } else {
        ageCounts.unknown++;
      }

      // Country from nationality
      const country = kyc.nationality || 'NG';
      countryMap[country] = (countryMap[country] || 0) + 1;
    }

    const totalWithDemographics = senderUids.length || 1;

    const genderLabels = { male: 'Male', female: 'Female', non_binary: 'Non-binary', prefer_not_to_say: 'Prefer not to say', unknown: 'Unknown' };
    const genderDemographics = Object.entries(genderCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: genderLabels[k] || k, count: v, pct: Math.round((v / totalWithDemographics) * 100) }))
      .sort((a, b) => b.count - a.count);

    const ageGroups = Object.entries(ageCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: k, count: v, pct: Math.round((v / totalWithDemographics) * 100) }))
      .sort((a, b) => b.count - a.count);

    const countryNames = { NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa', US: 'United States', GB: 'United Kingdom', CA: 'Canada', SN: 'Senegal', ET: 'Ethiopia', TZ: 'Tanzania', CI: "Côte d'Ivoire" };
    const topCountries = Object.entries(countryMap)
      .map(([k, v]) => ({ code: k, country: countryNames[k] || k, count: v, pct: Math.round((v / totalWithDemographics) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      channel_id,
      period,
      overview: {
        total_views: timeline.reduce((s, d) => s + d.views, 0),
        unique_viewers: timeline.reduce((s, d) => s + d.unique_viewers, 0),
        peak_viewers: peakViewers,
        peak_hour: peakHourLabel,
        total_reactions: reactions.length,
        total_comments: totalComments,
        total_gifts_count: giftEvents.length,
        total_gifts_ngn: Math.round(totalGiftsNgn),
        total_gifts_vpt: Math.round(totalGiftsVpt),
        weekly_views: weeklyViews,
        monthly_views: monthlyViews,
        yearly_views: yearlyViews,
        best_day_views: bestDay?.views || 0,
        best_day_date: bestDay?.date || null,
      },
      viewer_activity_by_hour: hourBuckets,
      timeline,
      demographics: {
        gender: genderDemographics,
        age_groups: ageGroups,
        top_countries: topCountries,
        total_identified: senderUids.length,
      },
    });
  } catch (err) {
    console.error('[Analytics] getChannelAnalytics error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getMyStats,
  getMyStreams,
  getMyTopSupporters,
  endMyStream,
  adminGetCreatorStats,
  getChannelAnalytics,
};
