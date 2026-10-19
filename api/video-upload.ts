import { getEnv } from './_lib/runtime.js';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { BACKGROUND_VIDEO_TYPES, MAX_BACKGROUND_VIDEO_BYTES } from '../shared/videoSources.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http.js';
import { requireUser } from './_lib/session.js';

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!getEnv('BLOB_READ_WRITE_TOKEN')) throw new HttpError(503, 'رفع الفيديو غير مفعّل بعد. يلزم ربط تخزين الملفات بالمشروع.');
      sendJson(res, 200, { prefix: `wallpapers/${user.id}/`, maximumSizeInBytes: MAX_BACKGROUND_VIDEO_BYTES });
      return;
    }
    const body = await readJsonBody(req) as HandleUploadBody;
    const result = await handleUpload({
      body, request: req, token: getEnv('BLOB_READ_WRITE_TOKEN'),
      onBeforeGenerateToken: async pathname => {
        const user = await requireUser(req, res);
        if (!user) throw new HttpError(401, 'سجّل دخولك لرفع الفيديو.');
        if (!getEnv('BLOB_READ_WRITE_TOKEN')) throw new HttpError(503, 'رفع الفيديو غير مفعّل بعد. يلزم ربط تخزين الملفات بالمشروع.');
        const prefix = `wallpapers/${user.id}/`;
        if (!pathname.startsWith(prefix) || !/^[a-f0-9-]{36}\.(mp4|webm)$/.test(pathname.slice(prefix.length))) throw new HttpError(400, 'مسار رفع الفيديو غير صالح.');
        return { allowedContentTypes: BACKGROUND_VIDEO_TYPES, maximumSizeInBytes: MAX_BACKGROUND_VIDEO_BYTES, addRandomSuffix: true, allowOverwrite: false, validUntil: Date.now() + 10 * 60 * 1000 };
      },
    });
    sendJson(res, 200, result);
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
}
