const { Router } = require('express');
const { authenticateToken } = require('../utils/jwt');
const Channel = require('./channel.model');
const User = require('../users/user.model');
const Ledger = require('../vpt/ledger.model');

const router = Router();

// GET /home/stats — community pool, recent channels, total counts
router.get('/stats', authenticateToken, (req, res) => {
  const vptToNaira = 750; // 1 vPT = ₦750

  // Community pool balance = sum of (community_pool - vpt_extraction) from all SPLIT entries
  // i.e., the 70% that stays in the pool, converted to vPT at market rate
  const splits = Ledger.getAll().filter((e) => e.type === 'SPLIT' && e.status === 'success');
  let communityPoolNgn = 0;
  for (const s of splits) {
    const fullPool = (s.meta && s.meta.community_pool) || 0;
    const extracted = s.amount_ngn || 0; // the 30% that went to vPT queue
    communityPoolNgn += (fullPool - extracted); // 70% remains
  }
  const communityPoolVpt = Math.round((communityPoolNgn / vptToNaira) * 100) / 100;

  // Recent public channels (top 10)
  const recentChannels = Channel.getRecentPublic(10).map((ch) => {
    const owner = User.findById(ch.owner_id);
    return {
      id: ch.id,
      name: ch.name,
      category: ch.category,
      channel_number: ch.channel_number,
      logo_url: ch.logo_url,
      banner_url: ch.banner_url,
      created_at: ch.created_at,
      owner_name: owner?.name || owner?.email || 'Unknown',
    };
  });

  // Promoted channels (for now: public channels with banners)
  const promoted = Channel.getPublicChannels()
    .filter((ch) => ch.banner_url)
    .slice(0, 5)
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      channel_number: ch.channel_number,
      logo_url: ch.logo_url,
      banner_url: ch.banner_url,
    }));

  const allUsers = User.getAll();
  const totalChannels = Channel.getAll().length;
  const totalMembers = allUsers.length;

  res.json({
    community_pool: {
      total_vpt: communityPoolVpt,
      total_ngn: communityPoolNgn,
      vpt_rate: vptToNaira,
      naira_equivalent: communityPoolNgn,
    },
    recent_channels: recentChannels,
    promoted_channels: promoted,
    stats: {
      total_channels: totalChannels,
      total_members: totalMembers,
    },
  });
});

module.exports = router;
