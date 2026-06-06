const User = require('../users/user.model');
const PlanModel = require('../subscriptions/plan.model');
const AuditService = require('../admin/audit.service');
const FeatureConfig = require('./ai_video_feature_config.model');
const ProviderConfig = require('./ai_video_provider_config.model');

function requireAdmin(req, res) {
  const caller = User.findById(req.userId);
  if (!caller || caller.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return caller;
}

async function getConfig(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    const [config, providers, creatorPlans] = await Promise.all([
      FeatureConfig.get(),
      ProviderConfig.getAll(),
      PlanModel.getAllByType('creator'),
    ]);

    return res.json({
      config,
      providers,
      creator_plans: creatorPlans.filter((plan) => plan.is_active !== false),
    });
  } catch (error) {
    console.error('[AiVideoAdmin] getConfig:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateConfig(req, res) {
  try {
    const caller = requireAdmin(req, res);
    if (!caller) return;
    const body = req.body || {};

    if (body.minimum_creator_plan) {
      const plan = await PlanModel.findByName(body.minimum_creator_plan);
      if (!plan || plan.type !== 'creator') {
        return res.status(400).json({ error: 'Minimum creator plan must reference a valid creator plan' });
      }
    }

    if (body.default_provider) {
      const provider = await ProviderConfig.findByKey(body.default_provider);
      if (!provider) {
        return res.status(400).json({ error: 'Default provider must reference a configured provider' });
      }
    }

    const config = await FeatureConfig.update({
      ...body,
      updated_by: caller.id,
    });
    await AuditService.logAction(caller.id, 'update_ai_video_config', 'ai_video_feature_config', {
      enabled: config.enabled,
      mode: config.mode,
      minimum_creator_plan: config.minimum_creator_plan,
      default_provider: config.default_provider,
    });
    return res.json({ config });
  } catch (error) {
    console.error('[AiVideoAdmin] updateConfig:', error.message);
    return res.status(400).json({ error: error.message || 'Invalid AI video config update' });
  }
}

async function getProviders(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    const providers = await ProviderConfig.getAll();
    return res.json({ providers });
  } catch (error) {
    console.error('[AiVideoAdmin] getProviders:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateProvider(req, res) {
  try {
    const caller = requireAdmin(req, res);
    if (!caller) return;
    const provider = await ProviderConfig.upsert(req.params.providerKey, req.body || {});
    await AuditService.logAction(caller.id, 'update_ai_video_provider', req.params.providerKey, {
      enabled: provider.enabled,
      model_name: provider.model_name,
      api_base_url: provider.api_base_url,
    });
    return res.json({ provider });
  } catch (error) {
    console.error('[AiVideoAdmin] updateProvider:', error.message);
    return res.status(400).json({ error: error.message || 'Invalid AI video provider update' });
  }
}

async function testProvider(req, res) {
  try {
    const caller = requireAdmin(req, res);
    if (!caller) return;
    const provider = await ProviderConfig.findByKey(req.params.providerKey);
    const validation = ProviderConfig.validateForTest(provider);
    await AuditService.logAction(caller.id, 'test_ai_video_provider', req.params.providerKey, {
      ok: validation.ok,
      issues: validation.issues,
    });
    return res.json({
      ok: validation.ok,
      provider_key: req.params.providerKey,
      message: validation.ok
        ? 'Provider configuration looks ready for integration.'
        : 'Provider configuration is incomplete.',
      issues: validation.issues,
    });
  } catch (error) {
    console.error('[AiVideoAdmin] testProvider:', error.message);
    return res.status(500).json({ error: 'Provider test failed' });
  }
}

module.exports = {
  getConfig,
  updateConfig,
  getProviders,
  updateProvider,
  testProvider,
};
