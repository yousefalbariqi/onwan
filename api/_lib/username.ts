import { pool } from './db.js';
import { HttpError } from './http.js';

// The name is a subdomain (name.onwan.link), so it must be a valid DNS label.
export const USERNAME_PATTERN = /^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(username: string) {
  const normalized = normalizeUsername(username);

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: 'الاسم يجب أن يكون من 1 إلى 30 حرفًا من الأحرف الإنجليزية الصغيرة والأرقام والشرطة (-) فقط، ولا يبدأ أو ينتهي بشرطة.',
    };
  }

  return { valid: true, normalized };
}

// B2B-06: a partner's unpaid order holds its name for the payment window.
export const PARTNER_ORDER_WINDOW_DAYS = 3;

export async function getUsernameAvailability(
  username: string,
  options: { ignoreOrderId?: string; ignoreUserId?: string } = {},
) {
  const validation = validateUsername(username);

  if (!validation.valid) {
    return {
      available: false,
      normalized: validation.normalized,
      reason: validation.reason,
      status: 'invalid' as const,
    };
  }

  const reservedResult = await pool.query(
    'select 1 from reserved_usernames where username = $1 limit 1',
    [validation.normalized],
  );

  if (reservedResult.rowCount) {
    return {
      available: false,
      normalized: validation.normalized,
      reason: 'هذا الاسم محجوز.',
      status: 'reserved' as const,
    };
  }

  const existingResult = await pool.query(
    'select 1 from usernames where username = $1 limit 1',
    [validation.normalized],
  );

  // DOMAIN-02: a renamed page's old name stays held while it redirects.
  const redirectResult = await pool.query(
    'select 1 from username_redirects where old_username = $1 and expires_at > now() limit 1',
    [validation.normalized],
  );

  const heldResult = await pool.query(
    `select 1 from partner_orders
     where username = $1 and status = 'awaiting_payment'
       and created_at > now() - make_interval(days => $2)
       and ($3::uuid is null or id <> $3)
     limit 1`,
    [validation.normalized, PARTNER_ORDER_WINDOW_DAYS, options.ignoreOrderId ?? null],
  );

  // NEW-01 / AC-01.02: a name another beneficiary holds cannot be taken
  // during the hold. (A hold without an expiry lasts until payment or change.)
  const nameHoldResult = await pool.query(
    `select 1 from username_reservations
     where username = $1 and (expires_at is null or expires_at > now())
       and ($2::uuid is null or user_id <> $2)
     limit 1`,
    [validation.normalized, options.ignoreUserId ?? null],
  );

  if (existingResult.rowCount || redirectResult.rowCount || heldResult.rowCount || nameHoldResult.rowCount) {
    return {
      available: false,
      normalized: validation.normalized,
      reason: 'هذا الاسم مستخدم بالفعل.',
      status: 'taken' as const,
    };
  }

  return {
    available: true,
    normalized: validation.normalized,
    reason: null,
    status: 'available' as const,
  };
}

// NEW-01 (amended): hold a name for a beneficiary who has not paid yet. Any
// earlier hold of theirs is released, and an expired hold of someone else's
// on this name is cleared. Throws 409 when the name is not available.
export async function reserveUsername(queryable: { query: (text: string, values?: unknown[]) => Promise<any> }, userId: string, username: string) {
  const availability = await getUsernameAvailability(username, { ignoreUserId: userId });

  if (!availability.available) {
    throw new HttpError(409, availability.reason ?? 'الاسم غير متاح.', `username_${availability.status}`);
  }

  const setting = await queryable.query("select value from settings where key = 'name_hold_days'");
  const holdDays = typeof setting.rows[0]?.value === 'number' ? setting.rows[0].value : null;

  await queryable.query(
    'delete from username_reservations where user_id = $1 or (username = $2 and expires_at <= now())',
    [userId, availability.normalized],
  );

  try {
    await queryable.query(
      `insert into username_reservations (username, user_id, expires_at)
       values ($1, $2, case when $3::int is null then null else now() + make_interval(days => $3::int) end)`,
      [availability.normalized, userId, holdDays],
    );
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new HttpError(409, 'هذا الاسم حُجز للتو. اختر اسمًا آخر.', 'username_taken');
    }

    throw error;
  }

  return availability.normalized;
}
