const { canonicalPoolStats } = require('./pool.service');

describe('pool.service canonicalPoolStats', () => {
  test('balance_ngn equals round(balance_vpt * vpt_price_ngn)', () => {
    const pool = {
      balance_vpt: 29.87,
      next_distribution_vpt: 3.2001,
    };
    const vptPrice = 750;
    const out = canonicalPoolStats(pool, vptPrice);
    expect(out.balance_ngn).toBe(Math.round(out.balance_vpt * out.vpt_price_ngn));
    expect(out.next_distribution_ngn).toBe(Math.round(out.next_distribution_vpt * out.vpt_price_ngn));
  });
});
