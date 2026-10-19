import { getEnv } from './runtime.js';
import { pool } from './db.js';

// Manager-entered numbers (see the `settings` table). None has a default.
//   nfc_unit_price / nfc_shipping_price → NFC pricing (SAR)
//   name_hold_days → how long an unpaid beneficiary's name stays held
//   custom_domain_price → fee for serving the page on the entity's own domain (SAR)
export const SETTING_KEYS = ['nfc_unit_price', 'nfc_shipping_price', 'name_hold_days', 'custom_domain_price'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSettings() {
  const result = await pool.query<{ key: SettingKey; value: number }>('select key, value from settings');
  const settings: Record<SettingKey, number | null> = {
    nfc_unit_price: null,
    nfc_shipping_price: null,
    name_hold_days: null,
    custom_domain_price: null,
  };

  for (const row of result.rows) {
    if (row.key in settings && typeof row.value === 'number') {
      settings[row.key] = row.value;
    }
  }

  return settings;
}

// DES-01: the «صمّم لي» price is fixed in the deployment, not editable from
// the panel. Unset until the price is decided (P-03).
export function getDesignPrice() {
  const price = Number(getEnv('DESIGN_SERVICE_PRICE_SAR'));

  return Number.isFinite(price) && price > 0 ? price : null;
}

export type DesignPackage = {
  id: string;
  status: 'pending_payment' | 'active' | 'cancelled';
  price: string | null;
  requested_at: string;
  paid_at: string | null;
  design_approved_at: string | null;
};

// NEW-06: «صمّم لي» is one job that ends when the design is approved. A
// package is open from the request until that approval.
export function isPackageOpen(pkg: DesignPackage | undefined) {
  return Boolean(pkg && pkg.status !== 'cancelled' && !pkg.design_approved_at);
}

export async function getLatestDesignPackage(userId: string) {
  const result = await pool.query<DesignPackage>(
    "select * from design_packages where user_id = $1 and status <> 'cancelled' order by requested_at desc limit 1",
    [userId],
  );

  return result.rows[0];
}

// PAY-05 / PERM-14: every confirmed payment is kept, whatever happens to the
// customer afterwards.
export async function recordPayment(
  queryable: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  payment: {
    userId: string | null;
    kind: 'subscription' | 'partner_subscription' | 'design' | 'nfc' | 'domain';
    amount: number;
    reference: string;
    label: string;
    recordedBy: string;
  },
) {
  await queryable.query(
    'insert into payments (user_id, kind, amount, reference, label, recorded_by) values ($1, $2, $3, $4, $5, $6)',
    [payment.userId, payment.kind, payment.amount, payment.reference, payment.label, payment.recordedBy],
  );
}
