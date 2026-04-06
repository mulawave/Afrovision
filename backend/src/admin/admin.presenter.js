const User = require('../users/user.model');
const Channel = require('../channels/channel.model');

function summarizeUser(user) {
  if (!user) return null;

  const email = user.deleted_email || user.email || null;

  return {
    id: user.id,
    email,
    name: user.name || null,
    display_name: user.name || email || user.id,
    role: user.role || null,
  };
}

function findAnyChannel(channelId) {
  if (!channelId) return null;
  return Channel.getEvery().find((channel) => channel.id === channelId) || null;
}

function serializeChannelForAdmin(channel) {
  if (!channel) return null;

  const owner = summarizeUser(User.findById(channel.owner_id));

  return {
    ...channel,
    owner,
    owner_name: owner?.name || null,
    owner_email: owner?.email || null,
    owner_display_name: owner?.display_name || channel.owner_id || 'Unknown owner',
  };
}

function summarizeChannel(channel) {
  const serialized = serializeChannelForAdmin(channel);
  if (!serialized) return null;

  return {
    type: 'channel',
    id: serialized.id,
    name: serialized.name || null,
    display_name: serialized.name || serialized.id,
    owner: serialized.owner,
    owner_display_name: serialized.owner_display_name,
    owner_email: serialized.owner_email,
    is_active: Boolean(serialized.is_active),
    requires_payment: Boolean(serialized.requires_payment),
  };
}

function serializeWithdrawalForAdmin(withdrawal) {
  if (!withdrawal) return null;

  const user = summarizeUser(User.findById(withdrawal.uid));
  const handledBy = summarizeUser(User.findById(withdrawal.handled_by || withdrawal.processed_by || null));

  return {
    ...withdrawal,
    user,
    user_display_name: user?.display_name || withdrawal.uid,
    user_email: user?.email || null,
    handled_by_user: handledBy,
  };
}

function serializeCreatorSubscriptionForAdmin(subscription) {
  if (!subscription) return null;

  const subscriber = summarizeUser(User.findById(subscription.subscriber_uid));
  const creator = summarizeUser(User.findById(subscription.creator_uid));

  return {
    ...subscription,
    subscriber,
    creator,
    subscriber_display_name: subscriber?.display_name || subscription.subscriber_uid,
    creator_display_name: creator?.display_name || subscription.creator_uid,
  };
}

module.exports = {
  summarizeUser,
  findAnyChannel,
  serializeChannelForAdmin,
  summarizeChannel,
  serializeWithdrawalForAdmin,
  serializeCreatorSubscriptionForAdmin,
};