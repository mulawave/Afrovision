const Channel = require('../channels/channel.model');
const CreatorStats = require('../channels/creator_stats.model');
const CreatorDailyStats = require('./creator_daily_stats.model');
const CreatorSupporter = require('./creator_supporter.model');
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

function _isIndexError(error) {
  const message = error?.message || '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

async function _countQuery(query, fallbackValue = null) {
  try {
    const snapshot = await query.count().get();
    return Number(snapshot.data().count || 0);
  } catch (error) {
    if (_isIndexError(error)) return fallbackValue;
    throw error;
  }
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
async function getMyStreams(req, res) {
  try {
    const streams = await StreamStats.getByCreator(req.userId, 20);
    res.json({ streams });
  } catch (err) {
    console.error('[Analytics] getMyStreams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /creator/supporters
 * Top supporters by total gift spend on the creator's channels.
 * Reads maintained creator_supporters aggregates and backfills once for legacy data.
 */
async function getMyTopSupporters(req, res) {
  try {
    const myChannelsRaw = await Channel.getByOwner(req.userId);
    if (myChannelsRaw.length === 0) return res.json({ supporters: [] });

    let topSupporters = await CreatorSupporter.getTopSupporters(req.userId, 10);
    if (topSupporters.length === 0) {
      await CreatorSupporter.backfillForCreator(req.userId, myChannelsRaw);
      topSupporters = await CreatorSupporter.getTopSupporters(req.userId, 10);
    }

    const usersById = new Map(
      await Promise.all(
        [...new Set(topSupporters.map((entry) => entry.sender_uid).filter(Boolean))]
          .map(async (uid) => [uid, await User.findById(uid)]),
      ),
    );

    const supporters = topSupporters.map((entry) => {
      const user = entry.sender_uid ? usersById.get(entry.sender_uid) : null;
      return {
        uid: entry.sender_uid || '',
        name: entry.sender_alias || user?.name || user?.email || 'Anonymous',
        total_gifts_ngn: Math.round(entry.total_gifts_ngn || 0),
        total_gifts_vpt: Math.round(entry.total_gifts_vpt || 0),
      };
    });

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

    const channel = await Channel.findById(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (channel.owner_id !== req.userId) return res.status(403).json({ error: 'Not your channel' });

    const active = await StreamStats.getActiveByChannel(channel_id);
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
    const caller = await User.findById(req.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { uid } = req.params;
    const creator = await User.findById(uid);
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
    const eventBaseQuery = db.collection('channel_events')
      .where('channel_id', '==', channel_id)
      .where('created_at', '>=', sinceMs);
    const messageBaseQuery = db.collection('channel_chats').doc(channel_id).collection('messages')
      .where('created_at', '>=', sinceMs);
    const sampleEventLimit = Math.min(Math.max(days * 20, 250), 1000);

    // Use exact counts for totals and a bounded event sample for hourly/demographic breakdowns.
    const [reactionCount, giftEventCountRaw, totalComments, eventSampleSnap, channelStreams, dailyDocs] = await Promise.all([
      _countQuery(eventBaseQuery.where('type', '==', 'reaction')),
      _countQuery(eventBaseQuery.where('type', '==', 'gift')),
      _countQuery(messageBaseQuery, 0),
      eventBaseQuery
        .orderBy('created_at', 'desc')
        .limit(sampleEventLimit)
        .get()
        .catch(async (error) => {
          if (!_isIndexError(error)) throw error;
          return eventBaseQuery.limit(sampleEventLimit).get();
        }),
      StreamStats.getByChannel ? StreamStats.getByChannel(channel_id) : [],
      db.collection('creator_daily_stats')
        .where('creator_uid', '==', creatorUid)
        .orderBy('date', 'desc')
        .limit(days)
        .get(),
    ]);

    const events = eventSampleSnap.docs.map((d) => d.data());
    const giftEvents = events.filter((e) => e.type === 'gift');
    const totalReactions = reactionCount ?? events.filter((e) => e.type === 'reaction').length;
    const totalGiftsCount = giftEventCountRaw ?? giftEvents.length;

    // Use a bounded event sample for hourly activity and demographic enrichment only.
    const sampledSendersByDay = {};
    for (const ev of events) {
      if (!ev.sender_uid) continue;
      const dayKey = new Date(ev.created_at).toISOString().split('T')[0];
      if (!sampledSendersByDay[dayKey]) sampledSendersByDay[dayKey] = new Set();
      sampledSendersByDay[dayKey].add(ev.sender_uid);
    }

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
      // Prefer daily stats; fall back to the bounded event sample if stats are missing.
      const derivedUniqueViewers = sampledSendersByDay[key] ? sampledSendersByDay[key].size : 0;
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

    // Use daily aggregates instead of scanning raw gift events for the full period.
    const totalGiftsNgn = timeline.reduce((sum, day) => sum + (day.gifts_ngn || 0), 0);
    const totalGiftsVpt = timeline.reduce((sum, day) => sum + (day.gifts_vpt || 0), 0);

    // ── Demographics from KYC records of sampled unique senders
    const senderUids = [...new Set(events.map((e) => e.sender_uid).filter(Boolean))];

    const genderCounts = { male: 0, female: 0, non_binary: 0, prefer_not_to_say: 0, unknown: 0 };
    const ageCounts = { '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, unknown: 0 };
    const countryMap = {};

    const kycRecordsByUser = await KycModel.findManyByUserIds(senderUids);

    for (const uid of senderUids) {
      const kyc = kycRecordsByUser.get(uid);
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
        total_reactions: totalReactions,
        total_comments: totalComments,
        total_gifts_count: totalGiftsCount,
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
