import { getBinding } from './_lib/runtime.js';
import { BACKGROUND_VIDEO_TYPES, MAX_BACKGROUND_VIDEO_BYTES } from '../shared/videoSources.js';
import { allowMethods, handleApiError, HttpError, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';

// The R2 bucket bound as MEDIA in wrangler.jsonc.
export type MediaBucket = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
};

const NOT_READY = 'رفع الفيديو غير مفعّل بعد. يلزم ربط مخزن Cloudflare R2 (MEDIA) بالمشروع.';

// The editor sends the video file itself as the request body; it is stored
// under the owner's folder with a new name, so an upload never overwrites.
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const media = getBinding<MediaBucket>('MEDIA');
    if (!media || typeof req.arrayBuffer !== 'function') throw new HttpError(503, NOT_READY);
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!BACKGROUND_VIDEO_TYPES.includes(type)) throw new HttpError(400, 'اختر ملف فيديو MP4 أو WebM.');
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BACKGROUND_VIDEO_BYTES) throw new HttpError(413, 'حجم الفيديو يتجاوز الحد المعتمد: 20 MB.');
    const body: ArrayBuffer = await req.arrayBuffer();
    if (!body.byteLength) throw new HttpError(400, 'ملف الفيديو فارغ أو غير صالح.');
    if (body.byteLength > MAX_BACKGROUND_VIDEO_BYTES) throw new HttpError(413, 'حجم الفيديو يتجاوز الحد المعتمد: 20 MB.');
    const key = `wallpapers/${user.id}/${crypto.randomUUID()}.${type === 'video/webm' ? 'webm' : 'mp4'}`;
    await media.put(key, body, { httpMetadata: { contentType: type } });
    sendJson(res, 200, { url: `/media/${key}`, size: body.byteLength });
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
}
