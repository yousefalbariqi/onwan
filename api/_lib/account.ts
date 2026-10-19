import { PoolClient } from 'pg';
import { pool } from './db.js';
import { HttpError } from './http.js';

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
        cn.is_fixed as name_fixed,
        cn.hold_expires_at,
        p.status as page_status,
        p.suspension_message,
        s.plan,
        s.status as subscription_status,
        s.starts_at,
        s.expires_at
        ,r.invoice_number as renewal_invoice_number,
        r.plan as renewal_plan,
        r.amount::float as renewal_amount,
        r.due_at as renewal_due_at
      from users u
      left join pages p on p.user_id = u.id
      left join subscriptions s on s.user_id = u.id
      left join customer_names cn on cn.user_id = u.id
      left join lateral (
        select invoice_number, plan, amount, due_at
        from subscription_renewals
        where user_id = u.id and status = 'pending_payment'
        order by created_at desc
        limit 1
      ) r on true
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
    // NEW-01 (amended): held until payment, changeable until then.
    nameFixed: Boolean(row.name_fixed),
    nameHoldExpiresAt: (row.hold_expires_at ?? null) as string | null,
    pageStatus: (row.page_status ?? 'draft') as 'draft' | 'published' | 'suspended',
    suspensionMessage: row.suspension_message ?? '',
    subscription: row.plan
      ? {
          plan: row.plan as Plan,
          // Nothing flips the stored status when the paid period ends, so
          // expiry is derived from the date.
          status: (row.subscription_status === 'active' && row.expires_at && new Date(row.expires_at) < new Date()
            ? 'expired'
            : row.subscription_status) as 'pending_payment' | 'active' | 'expired',
          startsAt: row.starts_at as string | null,
          expiresAt: row.expires_at as string | null,
          renewalInvoice: row.renewal_invoice_number
            ? {
                number: Number(row.renewal_invoice_number),
                plan: row.renewal_plan as Plan,
                amount: Number(row.renewal_amount),
                dueAt: row.renewal_due_at as string | null,
              }
            : null,
        }
      : null,
  };
}

export async function getPlans() {
  const result = await pool.query<{ plan: Plan; price_sar: string | null; discount_percent: string | null }>(
    'select plan, price_sar, discount_percent from plans order by plan desc',
  );

  return result.rows.map((row) => ({
    plan: row.plan,
    priceSar: row.price_sar === null ? null : Number(row.price_sar),
    // PAY-02: the general discount the manager put on this plan, if any.
    discountPercent: row.discount_percent === null ? null : Number(row.discount_percent),
  }));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function normalizeDiscountCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

// PAY-02/03/04: the price of a plan in the registration cart. The general
// discount comes first, then the code on what remains, never below zero. The
// code touches the plan only. A code that cannot be used is reported, not
// silently ignored.
export async function pricePlan(plan: Plan, rawCode: unknown, userId: string) {
  const info = (await getPlans()).find((item) => item.plan === plan);

  if (!info || info.priceSar === null) {
    return null;
  }

  const listPrice = info.priceSar;
  const generalDiscount = info.discountPercent ? round2((listPrice * info.discountPercent) / 100) : 0;
  const afterGeneral = round2(listPrice - generalDiscount);
  const code = normalizeDiscountCode(rawCode);
  let codeDiscount = 0;
  let codeError: string | null = null;

  if (code) {
    const result = await pool.query(
      'select kind, value::float, expires_at, max_uses, used_count, is_active from discount_codes where code = $1',
      [code],
    );

    const row = result.rows[0];
    // PAY-03: a code is for the first subscription — once per customer.
    const usedBefore = await pool.query(
      "select 1 from registration_carts where user_id = $1 and status = 'paid' and discount_code is not null limit 1",
      [userId],
    );

    if (!row || !row.is_active) {
      codeError = 'كود الخصم غير صحيح.';
    } else if (row.expires_at && new Date(row.expires_at) <= new Date()) {
      codeError = 'انتهت صلاحية كود الخصم.';
    } else if (row.max_uses !== null && row.used_count >= row.max_uses) {
      codeError = 'استُنفد عدد مرات استخدام هذا الكود.';
    } else if (usedBefore.rowCount) {
      codeError = 'سبق أن استخدمت كود خصم في اشتراكك الأول.';
    } else {
      const raw = row.kind === 'percent' ? (afterGeneral * row.value) / 100 : row.value;
      codeDiscount = round2(Math.min(afterGeneral, raw));
    }
  }

  return {
    listPrice,
    generalDiscountPercent: info.discountPercent,
    generalDiscount,
    code: code && !codeError ? code : null,
    codeDiscount,
    codeError,
    finalPrice: round2(afterGeneral - codeDiscount),
  };
}

// Records the chosen plan while payment is outstanding. It never touches an
// active subscription and never publishes anything.
export async function requestSubscription(userId: string, plan: Plan) {
  const existing = await pool.query<{ status: string }>(
    "select status from subscriptions where user_id = $1 and expires_at > now() limit 1",
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
      where subscriptions.status <> 'active' or subscriptions.expires_at <= now()
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

  // NEW-01 (amended): payment is what fixes the held name. An expired hold
  // that nobody else claimed is still honoured.
  await queryable.query(
    `insert into usernames (user_id, username)
     select r.user_id, r.username from username_reservations r
     where r.user_id = $1
       and not exists (select 1 from usernames un where un.user_id = r.user_id or un.username = r.username)`,
    [userId],
  );

  const fixed = await queryable.query('select 1 from usernames where user_id = $1', [userId]);

  if (!fixed.rowCount) {
    throw new HttpError(409, 'انتهى حجز اسم الرابط وأخذه مستخدم آخر. يجب أن يختار العميل اسمًا جديدًا قبل تأكيد الدفع.');
  }

  await queryable.query('delete from username_reservations where user_id = $1', [userId]);

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

  // A confirmed renewal closes the visible invoice. This is intentionally in
  // the server-side activation path, never in the browser checkout screen.
  await queryable.query(
    `update subscription_renewals
     set status = 'paid', paid_at = now(), payment_reference = $2
     where user_id = $1 and status = 'pending_payment'`,
    [userId, paymentReference],
  );

  await queryable.query(
    "update pages set status = 'published' where user_id = $1 and status = 'draft'",
    [userId],
  );
}
