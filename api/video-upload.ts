import { getBearerToken, verifySessionToken } from './_lib/auth.js';
import { pool } from './_lib/db.js';
import { getBinding } from './_lib/runtime.js';
import { BACKGROUND_VIDEO_TYPES, MAX_BACKGROUND_VIDEO_BYTES } from '../shared/videoSources.js';
import { allowMethods, handleApiError, HttpError, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';
import { contentMatchesType } from '../shared/fileSignatures.js';
import { beginMediaUpload, storeLimitedUpload } from './_lib/mediaUploadLimits.js';

// The R2 bucket bound as MEDIA in wrangler.jsonc.
export type MediaBucket = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  list?(options: { prefix: string; cursor?: string }): Promise<{ objects: { key: string; size: number }[]; truncated: boolean; cursor?: string }>;
};

const NOT_READY = 'رفع الفيديو غير مفعّل بعد. يلزم ربط مخزن Cloudflare R2 (MEDIA) بالمشروع.';

// The editor sends the video file itself as the request body; it is stored
// under the owner's folder with a new name, so an upload never overwrites.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const session = verifySessionToken(getBearerToken(req));
    let user;
    if (session?.kind === 'partner') {
      const result = await pool.query("select id from partners where id = $1 and status = 'active'", [session.userId]);
      user = result.rows[0];
      if (!user) throw new HttpError(403, 'حساب الشريك غير متاح لرفع الفيديو.');
    } else {
      user = await requireUser(req, res);
    }
    if (!user) return;
    const media = getBinding<MediaBucket>('MEDIA');
    if (!media || typeof req.arrayBuffer !== 'function') throw new HttpError(503, NOT_READY);
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!BACKGROUND_VIDEO_TYPES.includes(type)) throw new HttpError(400, 'اختر ملف فيديو MP4 أو WebM.');
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BACKGROUND_VIDEO_BYTES) throw new HttpError(413, 'حجم الفيديو يتجاوز الحد المعتمد: 20 MB.');
    const eventId = await beginMediaUpload(user.id, Number.isSafeInteger(declared) && declared > 0 ? declared : MAX_BACKGROUND_VIDEO_BYTES);
    const body: ArrayBuffer = await req.arrayBuffer();
    if (!body.byteLength) throw new HttpError(400, 'ملف الفيديو فارغ أو غير صالح.');
    if (body.byteLength > MAX_BACKGROUND_VIDEO_BYTES) throw new HttpError(413, 'حجم الفيديو يتجاوز الحد المعتمد: 20 MB.');
    // REQ-017: the content itself must be an MP4 / WebM video.
    if (!contentMatchesType(new Uint8Array(body, 0, Math.min(16, body.byteLength)), type)) throw new HttpError(400, 'محتوى الملف ليس فيديو MP4 أو WebM سليمًا.');
    const key = `wallpapers/${user.id}/${crypto.randomUUID()}.${type === 'video/webm' ? 'webm' : 'mp4'}`;
    await storeLimitedUpload(media, user.id, key, body, type, eventId);
    sendJson(res, 200, { url: `/media/${key}`, size: body.byteLength });
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
}
