function resolveLocale(user = null) {
  const raw = String(
    user?.preferred_locale
      || user?.preferred_language
      || user?.language
      || user?.lang
      || 'en',
  ).toLowerCase();

  if (raw.startsWith('pcm') || raw.startsWith('pidgin')) return 'pcm';
  return 'en';
}

function userReminderTemplate(locale, { channelName, daysLeft }) {
  if (locale === 'pcm') {
    return {
      title: 'Exclusive Access Go Expire Soon',
      body: `Your access for ${channelName} go expire in ${daysLeft} day(s). Renew am quick quick.`,
      emailSubject: `${channelName}: Exclusive access go expire soon`,
      ctaLabel: 'Renew Access',
      type: 'exclusive_access_reminder',
    };
  }

  return {
    title: 'Exclusive Access Expiring Soon',
    body: `Your access for ${channelName} expires in ${daysLeft} day(s). Renew now to keep watching.`,
    emailSubject: `${channelName}: Exclusive access expiring soon`,
    ctaLabel: 'Renew Access',
    type: 'exclusive_access_reminder',
  };
}

function userExpiredTemplate(locale, { channelName }) {
  if (locale === 'pcm') {
    return {
      title: 'Exclusive Access Don Expire',
      body: `Your access for ${channelName} don expire. Renew to keep watching.`,
      emailSubject: `${channelName}: Exclusive access don expire`,
      ctaLabel: 'Renew Access',
      type: 'exclusive_access_expired',
    };
  }

  return {
    title: 'Exclusive Access Expired',
    body: `Your access for ${channelName} has expired. Renew to keep watching.`,
    emailSubject: `${channelName}: Exclusive access expired`,
    ctaLabel: 'Renew Access',
    type: 'exclusive_access_expired',
  };
}

function userPurchaseTemplate(locale, { channelName, isRenewal }) {
  if (locale === 'pcm') {
    return {
      title: isRenewal ? 'Exclusive Access Don Renew' : 'Exclusive Access Don Active',
      body: isRenewal
        ? `Your access for ${channelName} don renew for another 30 days.`
        : `Your access for ${channelName} don active for 30 days.`,
      emailSubject: isRenewal
        ? `${channelName}: Exclusive access renewed`
        : `${channelName}: Exclusive access activated`,
      ctaLabel: 'Watch Channel',
      type: isRenewal ? 'exclusive_access_renewed' : 'exclusive_access_activated',
    };
  }

  return {
    title: isRenewal ? 'Exclusive Access Renewed' : 'Exclusive Access Activated',
    body: isRenewal
      ? `Your access for ${channelName} has been renewed for another 30 days.`
      : `Your access for ${channelName} is active for 30 days.`,
    emailSubject: isRenewal
      ? `${channelName}: Exclusive access renewed`
      : `${channelName}: Exclusive access activated`,
    ctaLabel: 'Watch Channel',
    type: isRenewal ? 'exclusive_access_renewed' : 'exclusive_access_activated',
  };
}

function creatorPurchaseTemplate(locale, { channelName, isRenewal }) {
  if (locale === 'pcm') {
    return {
      title: isRenewal ? 'Subscriber Don Renew Exclusive' : 'New Exclusive Subscriber',
      body: isRenewal
        ? `One subscriber don renew access for ${channelName}.`
        : `A user don buy exclusive access for ${channelName}.`,
      emailSubject: isRenewal
        ? `${channelName}: subscriber renewed exclusive access`
        : `${channelName}: new exclusive subscriber`,
      ctaLabel: 'Open Dashboard',
      type: isRenewal ? 'exclusive_access_renewal' : 'exclusive_access_purchase',
    };
  }

  return {
    title: isRenewal ? 'Exclusive Subscription Renewed' : 'New Exclusive Subscriber',
    body: isRenewal
      ? `A subscriber renewed access to ${channelName}.`
      : `A user purchased access to ${channelName}.`,
    emailSubject: isRenewal
      ? `${channelName}: subscriber renewed exclusive access`
      : `${channelName}: new exclusive subscriber`,
    ctaLabel: 'Open Dashboard',
    type: isRenewal ? 'exclusive_access_renewal' : 'exclusive_access_purchase',
  };
}

function creatorExpiringTemplate(locale, { channelName }) {
  if (locale === 'pcm') {
    return {
      title: 'Exclusive Renewal Risk',
      body: `One subscriber access for ${channelName} go expire within 24 hours.`,
      emailSubject: `${channelName}: renewal risk in 24 hours`,
      ctaLabel: 'Open Dashboard',
      type: 'exclusive_access_expiring_creator',
    };
  }

  return {
    title: 'Exclusive Renewal Risk',
    body: `A subscriber's access to ${channelName} expires within 24 hours.`,
    emailSubject: `${channelName}: renewal risk in 24 hours`,
    ctaLabel: 'Open Dashboard',
    type: 'exclusive_access_expiring_creator',
  };
}

function creatorExpiredTemplate(locale, { channelName }) {
  if (locale === 'pcm') {
    return {
      title: 'Exclusive Access Expired',
      body: `Subscriber access to ${channelName} don expire.`,
      emailSubject: `${channelName}: subscriber access expired`,
      ctaLabel: 'Open Dashboard',
      type: 'exclusive_access_expired_creator',
    };
  }

  return {
    title: 'Exclusive Access Expired',
    body: `A subscriber's access to ${channelName} has expired.`,
    emailSubject: `${channelName}: subscriber access expired`,
    ctaLabel: 'Open Dashboard',
    type: 'exclusive_access_expired_creator',
  };
}

function opsAlertTemplate(locale, { errorCount, anomalyCount }) {
  if (locale === 'pcm') {
    return {
      title: 'Exclusive Lifecycle Worker Alert',
      body: `Run complete with ${errorCount} error(s) and ${anomalyCount} anomaly record(s).`,
      emailSubject: 'Exclusive lifecycle worker alert',
      ctaLabel: 'Open Admin',
      type: 'exclusive_ops_alert',
    };
  }

  return {
    title: 'Exclusive Lifecycle Worker Alert',
    body: `Exclusive lifecycle run completed with ${errorCount} error(s) and ${anomalyCount} anomaly record(s).`,
    emailSubject: 'Exclusive lifecycle worker alert',
    ctaLabel: 'Open Admin',
    type: 'exclusive_ops_alert',
  };
}

function buildExclusiveLifecycleMessage(event, params = {}) {
  const locale = resolveLocale(params.user);

  switch (event) {
    case 'user.purchase':
      return userPurchaseTemplate(locale, params);
    case 'user.reminder':
      return userReminderTemplate(locale, params);
    case 'user.expired':
      return userExpiredTemplate(locale, params);
    case 'creator.purchase':
      return creatorPurchaseTemplate(locale, params);
    case 'creator.expiring':
      return creatorExpiringTemplate(locale, params);
    case 'creator.expired':
      return creatorExpiredTemplate(locale, params);
    case 'ops.alert':
      return opsAlertTemplate(locale, params);
    default:
      return {
        title: 'Exclusive Channel Update',
        body: 'There is an update to your exclusive channel lifecycle.',
        emailSubject: 'Exclusive channel update',
        ctaLabel: 'Open AfroVision',
        type: 'exclusive_update',
      };
  }
}

module.exports = {
  resolveLocale,
  buildExclusiveLifecycleMessage,
};
