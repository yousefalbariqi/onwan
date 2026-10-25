import { pool } from './db.js';
import { HttpError } from './http.js';

// REQ-019 (owner: 7 attempts): after 7 failed sign-ins within 15 minutes for
// the same email / phone, sign-in waits until the oldest of them is 15 minutes
// old. Before phase21 runs there is no table, and nothing is blocked.
const MAX_FAILURES = 7;
const WINDOW_MINUTES = 15;

export async function assertNotLocked(scope: string, identifier: string) {
  if (!identifier) return;
  const result = await pool.query<{ failures: number; wait: number }>(
    `select count(*)::int as failures,
            ceil(extract(epoch from (min(failed_at) + make_interval(mins => $3) - now())) / 60)::int as wait
     from login_failures where scope = $1 and identifier = $2 and failed_at > now() - make_interval(mins => $3)`,
    [scope, identifier, WINDOW_MINUTES],
  ).catch(() => null);
  const row = result?.rows[0];
  if (row && row.failures >= MAX_FAILURES) {
    throw new HttpError(429, `محاولات دخول كثيرة. حاول بعد ${Math.max(1, row.wait)} دقيقة، أو استخدم «نسيت كلمة المرور».`, 'login_locked');
  }
}

export async function recordFailure(scope: string, identifier: string) {
  if (!identifier) return;
  await pool.query('insert into login_failures (scope, identifier) values ($1, $2)', [scope, identifier]).catch(() => undefined);
}

export async function clearFailures(scope: string, identifier: string) {
  if (!identifier) return;
  await pool.query('delete from login_failures where scope = $1 and identifier = $2', [scope, identifier]).catch(() => undefined);
}
