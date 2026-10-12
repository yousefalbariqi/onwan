import { PoolClient } from 'pg';
import { pool } from './db';
import { HttpError } from './http';

export type Plan = 'monthly' | 'annual';

export function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'annual';
}

export function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function isValidPhone(phone: string) {
  return /^[0-9]{8,20}$/.test(phone);
}

// What the beneficiary sees about their own account (PAGE-11, ACCT-04).
// Invoices and internal request statuses are deliberately not part of it.
export async function getAccountSummary(userId: string) {
  const result = await pool.query(
    `
      select
        u.email,
        u.phone,
        u.email_verified_at,
        p.status as page_status,
        p.suspension_message,
        s.plan,
        s.status as subscription_status,
        s.expires_at
      from users u
      left join pages p on p.user_id = u.id
      left join subscriptions s on s.user_id = u.id
      where u.id = $1
      limit 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    email: row.email ?? '',
    phone: row.phone ?? '',
    emailVerified: Boolean(row.email_verified_at),
    pageStatus: (row.page_status ?? 'draft') as 'draft' | 'published' | 'suspended',
    suspensionMessage: row.suspension_message ?? '',
    subscription: row.plan
      ? {
          plan: row.plan as Plan,
          status: row.subscription_status as 'pending_payment' | 'active' | 'expired',
          expiresAt: row.expires_at as string | null,
        }
      : null,
  };
}

export async function getPlans() {
  const result = await pool.query<{ plan: Plan; price_sar: string | null }>(
    'select plan, price_sar from plans order by plan desc',
  );

  return result.rows.map((row) => ({
    plan: row.plan,
    priceSar: row.price_sar === null ? null : Number(row.price_sar),
  }));
}

// Records the chosen plan while payment is outstanding. It never touches an
// active subscription and never publishes anything.
export async function requestSubscription(userId: string, plan: Plan) {
  const existing = await pool.query<{ status: string }>(
    'select status from subscriptions where user_id = $1 limit 1',
    [userId],
  );

  if (existing.rows[0]?.status === 'active') {
    throw new HttpError(409, 'اشتراكك فعّال بالفعل.');
  }

  await pool.query(
    `
      insert into subscriptions (user_id, plan, status)
      values ($1, $2, 'pending_payment')
      on conflict (user_id) do update
      set plan = excluded.plan, status = 'pending_payment', updated_at = now()
    `,
    [userId, plan],
  );
}

// SUB-02: the ONLY path that may publish a page. Call it from the payment
// gateway's confirmed-payment webhook (gateway is pending decision P-08), or
// from the administration's manual renewal (PERM-07) — never from the browser.
// A suspended page stays suspended: reactivation is a manual administration
// decision (SUB-08).
export async function activateSubscription(
  userId: string,
  plan: Plan,
  paymentReference: string,
  client?: PoolClient,
) {
  const queryable = client ?? pool;
  const period = plan === 'annual' ? '1 year' : '1 month';

  await queryable.query(
    `
      insert into subscriptions (user_id, plan, status, starts_at, expires_at, payment_reference)
      values ($1, $2, 'active', now(), now() + $3::interval, $4)
      on conflict (user_id) do update
      set
        plan = excluded.plan,
        status = 'active',
        starts_at = now(),
        expires_at = greatest(subscriptions.expires_at, now()) + $3::interval,
        payment_reference = excluded.payment_reference,
        updated_at = now()
    `,
    [userId, plan, period, paymentReference],
  );

  await queryable.query(
    "update pages set status = 'published' where user_id = $1 and status = 'draft'",
    [userId],
  );
}
