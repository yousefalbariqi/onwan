import { getBearerToken, verifySessionToken } from './_lib/auth.js';
import { pool } from './_lib/db.js';
import { getBinding } from './_lib/runtime.js';
import { allowMethods, handleApiError, HttpError, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';
import type { MediaBucket } from './video-upload.js';
import { contentMatchesType } from '../shared/fileSignatures.js';
import { beginMediaUpload, storeLimitedUpload } from './_lib/mediaUploadLimits.js';

// Note 53: images and PDFs leave the page JSON for Cloudflare R2. The name is
// the SHA-256 of the content, so the same file is stored once, a changed file
// gets a new link (no stale caches), and an unchanged one is never sent again.
// Links are long and unguessable; files on a page are public by nature.
export const MEDIA_FILE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  // Note (9): a custom font for the page.
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
};
// REQ-001/002: PDFs allow 10 MiB; stored images allow 1,000 KB (decimal).
export const MAX_MEDIA_FILE_BYTES = 1_000_000;
export const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FONT_FILE_BYTES = 2 * 1024 * 1024;

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const session = verifySessionToken(getBearerToken(req));
    let user;
    if (session?.kind === 'partner') {
      const result = await pool.query("select id from partners where id = $1 and status = 'active'", [session.userId]);
      user = result.rows[0];
      if (!user) throw new HttpError(403, 'حساب الشريك غير متاح لرفع الملفات.');
    } else {
      user = await requireUser(req, res);
    }
    if (!user) return;
    const media = getBinding<MediaBucket>('MEDIA');
    if (!media || typeof req.arrayBuffer !== 'function') throw new HttpError(503, 'تخزين الملفات غير مفعّل في هذه البيئة.');
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const extension = MEDIA_FILE_TYPES[type];
    if (!extension) throw new HttpError(400, 'المسموح: الصور وملفات PDF فقط.');
    const isFont = type.startsWith('font/');
    const maxBytes = type === 'application/pdf' ? MAX_PDF_FILE_BYTES : isFont ? MAX_FONT_FILE_BYTES : MAX_MEDIA_FILE_BYTES;
    const sizeError = type === 'application/pdf' ? 'حجم ملف PDF أكبر من 10MB.' : isFont ? 'ملف الخط أكبر من 2MB.' : 'حجم الصورة بعد الضغط أكبر من 1,000KB.';
    if (Number(req.headers['content-length']) > maxBytes) throw new HttpError(413, sizeError);
    const declared = Number(req.headers['content-length']);
    const eventId = await beginMediaUpload(user.id, Number.isSafeInteger(declared) && declared > 0 ? declared : maxBytes);
    const body: ArrayBuffer = await req.arrayBuffer();
    if (!body.byteLength) throw new HttpError(400, 'الملف فارغ.');
    if (body.byteLength > maxBytes) throw new HttpError(413, sizeError);
    // REQ-017: the content itself must be what the type says.
    if (!contentMatchesType(new Uint8Array(body, 0, Math.min(16, body.byteLength)), type)) throw new HttpError(400, 'محتوى الملف لا يطابق نوعه. ارفع صورة أو PDF سليمًا.');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', body)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const key = `files/${user.id}/${digest}.${extension}`;
    await storeLimitedUpload(media, user.id, key, body, type, eventId);
    sendJson(res, 200, { url: `/media/${key}` });
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
}
