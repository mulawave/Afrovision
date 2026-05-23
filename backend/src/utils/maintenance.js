function parseMaintenanceRequest(req, options = {}) {
  const body = req.body || {};
  const query = req.query || {};
  const confirmationToken = options.confirmationToken || null;
  const defaultLimit = Number.isInteger(options.defaultLimit) ? options.defaultLimit : null;
  const maxLimit = Number.isInteger(options.maxLimit) ? options.maxLimit : null;
  const rawDryRun = body.dryRun ?? body.dry_run ?? query.dryRun ?? query.dry_run;
  const dryRun = rawDryRun === true || String(rawDryRun).toLowerCase() === 'true';

  let limit = null;
  if (defaultLimit !== null) {
    const rawLimit = body.limit ?? query.limit;
    if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
      limit = defaultLimit;
    } else {
      const parsedLimit = Number(rawLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        return { error: 'limit must be a positive integer' };
      }
      limit = maxLimit === null ? parsedLimit : Math.min(parsedLimit, maxLimit);
    }
  }

  const confirmation = String(body.confirmation || body.confirm || '').trim();
  const confirmed = confirmationToken ? confirmation === confirmationToken : true;

  return {
    dryRun,
    limit,
    confirmation,
    confirmationToken,
    confirmed,
  };
}

function getMaintenanceConfirmationMessage(token) {
  return `Maintenance execution requires confirmation='${token}'. Use dryRun=true to preview first.`;
}

module.exports = {
  parseMaintenanceRequest,
  getMaintenanceConfirmationMessage,
};