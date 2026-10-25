import { getEnv } from './runtime.js';

// TEST PRICES ONLY (owner request, 21 Oct 2026): with DEMO_PRICES=true the
// cart can be walked through end to end before the real prices are decided
// (they are still pending, P-01..P-16). They fill only what the manager has
// not entered — any real price in the database always wins — and the cart
// labels them «سعر تجريبي». Never set DEMO_PRICES in production.
export const DEMO_PRICES = {
  monthly: 19.28,
  annual: 192.24,
  nfc_unit_price: 49,
  nfc_shipping_price: 25,
  custom_domain_price: 99,
} as const;

// What a partner pays Onwan per plan, in test mode only, when the manager has
// not set the partner's price yet (note 57).
export const DEMO_PARTNER_FLOORS = { monthly: 19, annual: 190 } as const;

export function demoPricesOn() {
  return getEnv('DEMO_PRICES') === 'true';
}
