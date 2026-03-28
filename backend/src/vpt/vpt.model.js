const crypto = require('crypto');

const transactions = [];

function create({ userId, type, amount, description }) {
  const txn = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    amount,
    description: description || null,
    created_at: new Date().toISOString(),
  };
  transactions.push(txn);
  return txn;
}

function getByUser(userId) {
  return transactions
    .filter((t) => t.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = { create, getByUser };
