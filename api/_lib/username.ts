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

export async function getUsernameAvailability(username: string) {
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

  if (existingResult.rowCount) {
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
