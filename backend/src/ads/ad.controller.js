const Ad = require('./ad.model');
const AdImpression = require('./ad_impression.model');
const { getNextAd, getBannerAd, getInStreamAds, calculateRevenueSplit } = require('./ad_serving');
const User = require('../users/user.model');
const Ledger = require('../vpt/ledger.model');
const { generateSignedUploadUrl } = require('../utils/gcs');
const { getFirestore } = require('../utils/firestore');
const crypto = require('crypto');
const path = require('path');

// ──────────────────────────────────────────────────────────
//  ADVERTISER ENDPOINTS
// ──────────────────────────────────────────────────────────

/**
 * POST /ads — submit a new ad (any authenticated user)
 */
async function submitAd(req, res) {
  try {
    const {
      category, title, description, media_url, thumbnail_url,
      click_url, duration, budget, price_per_impression,
      target_channels, start_date, end_date,
    } = req.body;

    if (!category || !Ad.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${Ad.VALID_CATEGORIES.join(', ')}` });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!media_url) {
      return res.status(400).json({ error: 'media_url is required' });
    }
    if (budget == null || budget <= 0) {
      return res.status(400).json({ error: 'budget must be greater than 0' });
    }
    if (price_per_impression == null || price_per_impression <= 0) {
      return res.status(400).json({ error: 'price_per_impression must be greater than 0' });
    }
    // Duration check for video ads
    const maxDur = Ad.MAX_DURATION[category];
    if (maxDur > 0 && duration && duration > maxDur) {
      return res.status(400).json({ error: `Duration exceeds max ${maxDur}s for ${category}` });
    }

    const ad = await Ad.create({
      advertiserId: req.userId,
      category,
      title: title.trim(),
      description: (description || '').trim(),
      mediaUrl: media_url,
      thumbnailUrl: thumbnail_url || '',
      clickUrl: click_url || '',
      duration: duration || 0,
      budget,
      pricePerImpression: price_per_impression,
      targetChannels: target_channels || [],
      startDate: start_date ? new Date(start_date).getTime() : null,
      endDate: end_date ? new Date(end_date).getTime() : null,
      isSuperAd: false, // only admin can set super
    });

    res.status(201).json(ad);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/me — list ads belonging to the authenticated user
 */
function getMyAds(req, res) {
  try {
    const ads = Ad.getByAdvertiser(req.userId);
    res.json({ ads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/:id/stats — get impression stats for an ad (owner or admin)
 */
function getAdStats(req, res) {
  try {
    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const user = User.findById(req.userId);
    if (ad.advertiser_id !== req.userId && (!user || user.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const stats = AdImpression.getStats(ad.id);
    res.json({ ad, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /ads/:id/budget — top up budget
 */
async function topUpBudget(req, res) {
  try {
    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.advertiser_id !== req.userId) {
      return res.status(403).json({ error: 'Not your ad' });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const updated = await Ad.update(ad.id, {
      budget: ad.budget + amount,
      status: ad.status === 'depleted' ? 'active' : ad.status,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /ads/upload-url — get a signed upload URL for ad media
 */
async function getAdUploadUrl(req, res) {
  try {
    const { content_type, file_name } = req.body;
    if (!content_type) return res.status(400).json({ error: 'content_type is required' });

    const ALLOWED_TYPES = {
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    };

    if (!ALLOWED_TYPES[content_type]) {
      return res.status(400).json({
        error: `Unsupported type: ${content_type}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`,
      });
    }

    const ext = ALLOWED_TYPES[content_type] || path.extname(file_name || '').toLowerCase() || '.bin';
    const filename = `ads/${crypto.randomUUID()}${ext}`;
    const { signedUrl, publicUrl } = await generateSignedUploadUrl(filename, content_type, 60);
    res.json({ signed_url: signedUrl, public_url: publicUrl, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  ADMIN ENDPOINTS
// ──────────────────────────────────────────────────────────

/**
 * GET /ads/all — admin: list all ads
 */
function getAllAds(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(Ad.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/pending — admin: list pending ads awaiting approval
 */
function getPendingAds(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(Ad.getPending());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /ads/:id/approve — admin: approve an ad
 */
async function approveAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const updated = await Ad.update(ad.id, { status: 'approved' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /ads/:id/reject — admin: reject an ad
 */
async function rejectAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const reason = (req.body.reason || '').trim();
    const updated = await Ad.update(ad.id, { status: 'rejected' });
    res.json({ ...updated, rejection_reason: reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /ads/:id/activate — admin: set approved ad to active
 */
async function activateAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.status !== 'approved' && ad.status !== 'paused') {
      return res.status(400).json({ error: 'Ad must be approved or paused to activate' });
    }

    const updated = await Ad.update(ad.id, { status: 'active' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /ads/:id/pause — admin or owner: pause an active ad
 */
async function pauseAd(req, res) {
  try {
    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const user = User.findById(req.userId);
    if (ad.advertiser_id !== req.userId && (!user || user.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (ad.status !== 'active') {
      return res.status(400).json({ error: 'Only active ads can be paused' });
    }

    const updated = await Ad.update(ad.id, { status: 'paused' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /ads/super — admin: create a super (priority) ad
 */
async function createSuperAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const {
      category, title, description, media_url, thumbnail_url,
      click_url, duration, budget, price_per_impression,
      target_channels, start_date, end_date,
    } = req.body;

    if (!category || !Ad.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category` });
    }
    if (!title) return res.status(400).json({ error: 'title is required' });

    const ad = await Ad.create({
      advertiserId: req.userId,
      category,
      title: title.trim(),
      description: (description || '').trim(),
      mediaUrl: media_url || '',
      thumbnailUrl: thumbnail_url || '',
      clickUrl: click_url || '',
      duration: duration || 0,
      budget: budget || 0,
      pricePerImpression: price_per_impression || 0,
      targetChannels: target_channels || [],
      startDate: start_date ? new Date(start_date).getTime() : null,
      endDate: end_date ? new Date(end_date).getTime() : null,
      isSuperAd: true,
    });

    // Super ads go straight to active
    await Ad.update(ad.id, { status: 'active' });
    res.status(201).json({ ...ad, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /ads/:id — admin: update any ad field
 */
async function updateAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const ad = Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const updated = await Ad.update(ad.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /ads/:id — admin: delete an ad
 */
async function deleteAd(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const removed = await Ad.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Ad not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/impressions — admin: all impression records
 */
function getAllImpressions(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    res.json(AdImpression.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  AD SERVING ENDPOINTS (public / viewer)
// ──────────────────────────────────────────────────────────

/**
 * GET /ads/serve/banner?placement=home|page&channel_id=xxx
 * Returns a single banner ad or null.
 */
function serveBanner(req, res) {
  try {
    const placement = req.query.placement || 'home';
    const channelId = req.query.channel_id || null;
    const ad = getBannerAd(placement, channelId);
    res.json(ad ? { ad } : { ad: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/serve/stream?channel_id=xxx
 * Returns ordered in-stream ads for a channel break.
 */
function serveInStream(req, res) {
  try {
    const channelId = req.query.channel_id || null;
    const ads = getInStreamAds(channelId);
    res.json({ ads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /ads/impression — record that an ad was displayed
 * Body: { ad_id, channel_id?, viewer_count? }
 */
async function recordImpression(req, res) {
  try {
    const { ad_id, channel_id, viewer_count } = req.body;
    if (!ad_id) return res.status(400).json({ error: 'ad_id is required' });

    const ad = Ad.findById(ad_id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const cost = ad.price_per_impression;
    const Channel = require('../channels/channel.model');
    const channel = channel_id ? Channel.findById(channel_id) : null;
    const channelOwnerId = channel ? channel.owner_id : null;

    // Record impression in tracking model
    const impression = await AdImpression.record({
      adId: ad.id,
      channelId: channel_id || null,
      category: ad.category,
      viewerCount: viewer_count || 1,
      cost,
      channelOwnerId,
    });

    // Update ad spend & count
    await Ad.recordImpression(ad.id, cost);

    // Revenue distribution via ledger
    const split = calculateRevenueSplit(ad.category, cost);

    // Record channel owner revenue for in-stream ads
    if (split.channel_share > 0 && channelOwnerId) {
      await Ledger.create({
        uid: channelOwnerId,
        type: 'AD_REVENUE',
        direction: 'credit',
        currency: 'ngn',
        amount_ngn: split.channel_share,
        status: 'success',
        meta: { ad_id: ad.id, impression_id: impression.id, channel_id },
        description: `Ad revenue: channel share (${ad.title})`,
      });
    }

    // Record community pool contribution
    if (split.pool_share > 0) {
      await Ledger.create({
        uid: ad.advertiser_id,
        type: 'SPLIT',
        direction: 'credit',
        currency: 'ngn',
        amount_ngn: split.pool_share,
        status: 'success',
        meta: { ad_id: ad.id, impression_id: impression.id, source: 'ad_revenue' },
        description: `Ad revenue pool split: ₦${split.pool_share}`,
      });
    }

    // ── Credit Firestore pools (single source of truth) ─────────────
    const admin = require('firebase-admin');
    const db = getFirestore();
    if (split.operations_share > 0) {
      await db.collection('pools').doc('operations').set({
        naira: admin.firestore.FieldValue.increment(split.operations_share),
      }, { merge: true });
    }
    if (split.pool_share > 0) {
      await db.collection('pools').doc('community').set({
        naira: admin.firestore.FieldValue.increment(split.pool_share),
      }, { merge: true });
    }

    res.json({
      impression_id: impression.id,
      cost,
      revenue_split: split,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/billing — advertiser billing summary
 */
function getBilling(req, res) {
  try {
    const myAds = Ad.getByAdvertiser(req.userId);
    const totalBudget = myAds.reduce((s, a) => s + (a.budget || 0), 0);
    const totalSpent = myAds.reduce((s, a) => s + (a.spent || 0), 0);
    const totalImpressions = myAds.reduce((s, a) => s + (a.impression_count || 0), 0);
    const activeAds = myAds.filter((a) => a.status === 'active').length;
    const depletedAds = myAds.filter((a) => a.status === 'depleted').length;

    res.json({
      total_ads: myAds.length,
      active_ads: activeAds,
      depleted_ads: depletedAds,
      total_budget: totalBudget,
      total_spent: totalSpent,
      remaining_budget: totalBudget - totalSpent,
      total_impressions: totalImpressions,
      avg_cost_per_impression: totalImpressions > 0 ? +(totalSpent / totalImpressions).toFixed(4) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/my-analytics — advertiser: own campaign analytics with time series
 */
function getMyAnalytics(req, res) {
  try {
    const myAds = Ad.getByAdvertiser(req.userId);
    if (!myAds.length) return res.json({ overview: { total_ads: 0 }, daily: [], per_ad: [], categories: [] });

    const adIds = new Set(myAds.map(a => a.id));
    const allImpressions = AdImpression.getAll().filter(i => adIds.has(i.ad_id));

    const totalBudget = myAds.reduce((s, a) => s + (a.budget || 0), 0);
    const totalSpent = myAds.reduce((s, a) => s + (a.spent || 0), 0);
    const totalImpressions = allImpressions.length;
    const totalViewers = allImpressions.reduce((s, i) => s + (i.viewer_count || 0), 0);

    // Daily time series (last 30 days)
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const dailyMap = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(now - (29 - d) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, impressions: 0, cost: 0, viewers: 0 };
    }
    for (const imp of allImpressions) {
      const ts = imp.played_at?.toDate ? imp.played_at.toDate() : new Date(imp.played_at);
      if (now - ts.getTime() > thirtyDays) continue;
      const key = ts.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].impressions += 1;
        dailyMap[key].cost += imp.cost || 0;
        dailyMap[key].viewers += imp.viewer_count || 0;
      }
    }

    // Per-ad breakdown
    const adMap = {};
    for (const imp of allImpressions) {
      if (!adMap[imp.ad_id]) adMap[imp.ad_id] = { impressions: 0, cost: 0, viewers: 0, channels: new Set() };
      adMap[imp.ad_id].impressions += 1;
      adMap[imp.ad_id].cost += imp.cost || 0;
      adMap[imp.ad_id].viewers += imp.viewer_count || 0;
      if (imp.channel_id) adMap[imp.ad_id].channels.add(imp.channel_id);
    }
    const perAd = myAds.map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      status: a.status,
      budget: a.budget,
      spent: a.spent,
      impressions: adMap[a.id]?.impressions || 0,
      viewers: adMap[a.id]?.viewers || 0,
      cost: adMap[a.id]?.cost || 0,
      unique_channels: adMap[a.id]?.channels?.size || 0,
    })).sort((a, b) => b.cost - a.cost);

    // Category breakdown
    const catMap = {};
    for (const imp of allImpressions) {
      const c = imp.category || 'unknown';
      if (!catMap[c]) catMap[c] = { category: c, impressions: 0, cost: 0, viewers: 0 };
      catMap[c].impressions += 1;
      catMap[c].cost += imp.cost || 0;
      catMap[c].viewers += imp.viewer_count || 0;
    }

    res.json({
      overview: {
        total_ads: myAds.length,
        active_ads: myAds.filter(a => a.status === 'active').length,
        total_budget: +totalBudget.toFixed(2),
        total_spent: +totalSpent.toFixed(2),
        remaining: +(totalBudget - totalSpent).toFixed(2),
        total_impressions: totalImpressions,
        total_viewers: totalViewers,
        avg_cost: totalImpressions > 0 ? +(totalSpent / totalImpressions).toFixed(4) : 0,
      },
      daily: Object.values(dailyMap),
      per_ad: perAd,
      categories: Object.values(catMap),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/revenue-report — admin: platform revenue report from ads
 */
function getRevenueReport(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const allAds = Ad.getAll();
    const allImpressions = AdImpression.getAll();

    const totalRevenue = allAds.reduce((s, a) => s + (a.spent || 0), 0);
    const totalImpressions = allImpressions.length;
    const totalViewers = allImpressions.reduce((s, i) => s + (i.viewer_count || 0), 0);

    // Compute aggregate splits
    let totalOps = 0, totalChannel = 0, totalPool = 0;
    for (const imp of allImpressions) {
      const split = calculateRevenueSplit(imp.category, imp.cost || 0);
      totalOps += split.operations_share;
      totalChannel += split.channel_share;
      totalPool += split.pool_share;
    }

    res.json({
      total_revenue: +totalRevenue.toFixed(2),
      total_impressions: totalImpressions,
      total_viewers: totalViewers,
      operations_revenue: +totalOps.toFixed(2),
      channel_revenue: +totalChannel.toFixed(2),
      pool_revenue: +totalPool.toFixed(2),
      active_ads: allAds.filter((a) => a.status === 'active').length,
      total_ads: allAds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /ads/analytics — admin: comprehensive ad analytics dashboard data
 */
function getAnalytics(req, res) {
  try {
    const user = User.findById(req.userId);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const allAds = Ad.getAll();
    const allImpressions = AdImpression.getAll();

    // ── Revenue overview ──
    const totalRevenue = allAds.reduce((s, a) => s + (a.spent || 0), 0);
    const totalBudget = allAds.reduce((s, a) => s + (a.budget || 0), 0);
    let opsRev = 0, chanRev = 0, poolRev = 0;
    for (const imp of allImpressions) {
      const sp = calculateRevenueSplit(imp.category, imp.cost || 0);
      opsRev += sp.operations_share;
      chanRev += sp.channel_share;
      poolRev += sp.pool_share;
    }

    // ── Daily time series (last 30 days) ──
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const dailyMap = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(now - (29 - d) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, impressions: 0, revenue: 0, viewers: 0 };
    }
    for (const imp of allImpressions) {
      const ts = imp.played_at?.toDate ? imp.played_at.toDate() : new Date(imp.played_at);
      if (now - ts.getTime() > thirtyDays) continue;
      const key = ts.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].impressions += 1;
        dailyMap[key].revenue += imp.cost || 0;
        dailyMap[key].viewers += imp.viewer_count || 0;
      }
    }
    const daily = Object.values(dailyMap);

    // ── Category breakdown ──
    const catMap = {};
    for (const imp of allImpressions) {
      const c = imp.category || 'unknown';
      if (!catMap[c]) catMap[c] = { category: c, impressions: 0, revenue: 0, viewers: 0 };
      catMap[c].impressions += 1;
      catMap[c].revenue += imp.cost || 0;
      catMap[c].viewers += imp.viewer_count || 0;
    }
    const categories = Object.values(catMap);

    // ── Top ads by revenue ──
    const adMap = {};
    for (const imp of allImpressions) {
      const aid = imp.ad_id;
      if (!adMap[aid]) adMap[aid] = { ad_id: aid, impressions: 0, revenue: 0, viewers: 0 };
      adMap[aid].impressions += 1;
      adMap[aid].revenue += imp.cost || 0;
      adMap[aid].viewers += imp.viewer_count || 0;
    }
    const topAds = Object.values(adMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    // Enrich with ad title
    for (const ta of topAds) {
      const ad = allAds.find(a => a.id === ta.ad_id);
      ta.title = ad?.title || 'Unknown';
      ta.category = ad?.category || 'unknown';
      ta.status = ad?.status || 'unknown';
    }

    // ── Top channels by revenue ──
    const chMap = {};
    for (const imp of allImpressions) {
      const cid = imp.channel_id || 'direct';
      if (!chMap[cid]) chMap[cid] = { channel_id: cid, impressions: 0, revenue: 0, viewers: 0 };
      chMap[cid].impressions += 1;
      chMap[cid].revenue += imp.cost || 0;
      chMap[cid].viewers += imp.viewer_count || 0;
    }
    const topChannels = Object.values(chMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ── Status breakdown ──
    const statusMap = {};
    for (const ad of allAds) {
      const s = ad.status || 'unknown';
      if (!statusMap[s]) statusMap[s] = 0;
      statusMap[s]++;
    }

    res.json({
      overview: {
        total_ads: allAds.length,
        active_ads: allAds.filter(a => a.status === 'active').length,
        total_budget: +totalBudget.toFixed(2),
        total_revenue: +totalRevenue.toFixed(2),
        total_impressions: allImpressions.length,
        total_viewers: allImpressions.reduce((s, i) => s + (i.viewer_count || 0), 0),
        operations_revenue: +opsRev.toFixed(2),
        channel_revenue: +chanRev.toFixed(2),
        pool_revenue: +poolRev.toFixed(2),
      },
      daily,
      categories,
      top_ads: topAds,
      top_channels: topChannels,
      status_breakdown: statusMap,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  // Advertiser
  submitAd,
  getMyAds,
  getAdStats,
  topUpBudget,
  getAdUploadUrl,
  getBilling,
  getMyAnalytics,
  // Admin
  getAllAds,
  getPendingAds,
  approveAd,
  rejectAd,
  activateAd,
  pauseAd,
  createSuperAd,
  updateAd,
  deleteAd,
  getAllImpressions,
  getRevenueReport,
  getAnalytics,
  // Serving
  serveBanner,
  serveInStream,
  recordImpression,
};
