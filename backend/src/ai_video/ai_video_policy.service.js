const PlanModel = require('../subscriptions/plan.model');
const { hasActiveSubscription } = require('../users/user.model');

function compareCreatorPlanRank(currentPlan, requiredPlan) {
  if (!requiredPlan) return true;
  if (!currentPlan) return false;
  const currentPrice = Number(currentPlan.price || 0);
  const requiredPrice = Number(requiredPlan.price || 0);
  return currentPrice >= requiredPrice;
}

async function evaluateAccess({ user, config }) {
  const normalizedMode = config?.mode || 'disabled';

  if (!config?.enabled || normalizedMode === 'disabled') {
    return { eligible: false, code: 'FEATURE_DISABLED', reason: 'AI video generator is currently disabled.' };
  }

  if (!user) {
    return { eligible: false, code: 'AUTH_REQUIRED', reason: 'Login is required to use AI video generator.' };
  }

  if (user.role !== 'creator' && user.role !== 'admin') {
    return { eligible: false, code: 'CREATOR_ROLE_REQUIRED', reason: 'Only creator accounts can use AI video generator.' };
  }

  if (normalizedMode === 'internal_only' && user.role !== 'admin') {
    return { eligible: false, code: 'FEATURE_MODE_RESTRICTED', reason: 'AI video generator is currently restricted.' };
  }

  if (normalizedMode === 'pilot_whitelist') {
    return { eligible: false, code: 'FEATURE_MODE_RESTRICTED', reason: 'AI video generator is currently limited to a pilot cohort.' };
  }

  if (normalizedMode === 'eligible_creators_only' || normalizedMode === 'open_beta') {
    if (!hasActiveSubscription(user)) {
      return { eligible: false, code: 'MINIMUM_CREATOR_PLAN_REQUIRED', reason: 'An active creator subscription is required.' };
    }

    const requiredPlanName = config.minimum_creator_plan || null;
    if (!requiredPlanName) {
      return { eligible: true, code: 'OK', reason: null };
    }

    const [currentPlan, requiredPlan] = await Promise.all([
      user.subscription_plan ? PlanModel.findByName(user.subscription_plan) : null,
      PlanModel.findByName(requiredPlanName),
    ]);

    if (!currentPlan || currentPlan.type !== 'creator') {
      return { eligible: false, code: 'MINIMUM_CREATOR_PLAN_REQUIRED', reason: 'A qualifying creator plan is required.' };
    }

    if (!requiredPlan || requiredPlan.type !== 'creator') {
      return { eligible: false, code: 'CONFIG_INVALID', reason: 'AI video minimum creator plan is misconfigured.' };
    }

    if (!compareCreatorPlanRank(currentPlan, requiredPlan)) {
      return {
        eligible: false,
        code: 'MINIMUM_CREATOR_PLAN_REQUIRED',
        reason: `A minimum ${requiredPlan.name} creator plan is required.`,
      };
    }
  }

  return { eligible: true, code: 'OK', reason: null };
}

module.exports = {
  evaluateAccess,
};
