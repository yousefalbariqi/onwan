// The public subscription prices (database/phase23-plan-prices.sql), shown on
// the home page before sign-up. The checkout always charges the server's price;
// keep these two in step when a price changes.
export const PUBLIC_PLAN_PRICES = { monthly: 19.28, annual: 192.24 } as const;
