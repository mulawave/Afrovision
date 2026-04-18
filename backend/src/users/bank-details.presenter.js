function maskAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  const trimmed = String(accountNumber).trim();
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 2)}******${trimmed.slice(-2)}`;
}

function serializeBankDetails(bankDetails) {
  if (!bankDetails) return null;
  return {
    bank_name: bankDetails.bank_name,
    bank_code: bankDetails.bank_code,
    account_name: bankDetails.account_name,
    account_number: bankDetails.account_number,
    account_number_masked:
      bankDetails.account_number_masked || maskAccountNumber(bankDetails.account_number),
    provider: bankDetails.provider || 'paystack',
    created_at: bankDetails.created_at || null,
    locked: true,
  };
}

module.exports = {
  maskAccountNumber,
  serializeBankDetails,
};