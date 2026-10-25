import { getBearerToken, verifySessionToken } from './_lib/auth.js';
import { pool } from './_lib/db.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';
import { createStreamUpload, streamConfig, streamStatus } from './_lib/stream.js';

// REQ-023: background video through Cloudflare Stream.
//   { action: 'config' }        → whether Stream is on
//   { action: 'create' }        → a one-time upload address for the browser
//   { action: 'status', uid }   → ready yet? then the MP4 and poster links
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const session = verifySessionToken(getBearerToken(req));
    let owner: string | undefined;
    if (session?.kind === 'partner') {
      const result = await pool.query("select id from partners where id = $1 and status = 'active'", [session.userId]);
      owner = result.rows[0]?.id;
      if (!owner) throw new HttpError(403, 'حساب الشريك غير متاح لرفع الفيديو.');
    } else {
      const user = await requireUser(req, res);
      if (!user) return;
      owner = user.id;
    }
    const body = await readJsonBody(req);
    if (body.action === 'config') { sendJson(res, 200, { enabled: Boolean(streamConfig()) }); return; }
    if (!streamConfig()) throw new HttpError(503, 'Stream غير مفعّل.', 'stream_off');
    if (body.action === 'create') { sendJson(res, 200, await createStreamUpload(owner!)); return; }
    if (body.action === 'status') { sendJson(res, 200, await streamStatus(String(body.uid ?? ''), owner!)); return; }
    throw new HttpError(400, 'إجراء غير معروف.');
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
}
