import { getEnv } from './runtime.js';
import { getBearerToken, verifySessionToken } from './auth.js';
import { pool } from './db.js';
import { sendJson } from './http.js';

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string;
  status: 'active' | 'banned';
  email_verified_at: string | null;
  session_version: number;
};

// MOD-06: a banned account sees a ban message and a contact channel.
export function getBannedMessage() {
  const contact = getEnv('SUPPORT_EMAIL');

  return contact
    ? `تم إيقاف هذا الحساب لمخالفة شروط الاستخدام. للتواصل مع الإدارة: ${contact}`
    : 'تم إيقاف هذا الحساب لمخالفة شروط الاستخدام. تواصل مع إدارة عنوان.';
}

// Loads the user on every request so a ban takes effect on live sessions too.
export async function requireUser(req: any, res: any): Promise<SessionUser | null> {
  const session = verifySessionToken(getBearerToken(req));

  if (!session || session.kind) {
    sendJson(res, 401, { error: 'انتهت الجلسة. سجّل الدخول من جديد.' });
    return null;
  }

  const result = await pool.query<SessionUser>(
    'select id, email, phone, status, email_verified_at, session_version from users where id = $1 limit 1',
    [session.userId],
  );

  const user = result.rows[0];

  // Legacy customer tokens have version zero; the first reset revokes them.
  if (!user || (session.sessionVersion ?? 0) !== (user.session_version ?? 0)) {
    sendJson(res, 401, { error: 'انتهت الجلسة. سجّل الدخول من جديد.' });
    return null;
  }

  if (user.status === 'banned') {
    sendJson(res, 403, { error: getBannedMessage(), code: 'banned' });
    return null;
  }

  return user;
}
