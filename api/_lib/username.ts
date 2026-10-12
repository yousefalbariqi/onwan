import { pool } from './db';

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

export async function getUsernameAvailability(username: string, options: { ignoreOrderId?: string } = {}) {
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

  if (existingResult.rowCount || redirectResult.rowCount || heldResult.rowCount) {
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
