import { upload } from '@vercel/blob/client';
import { backgroundVideoFileError } from '../../../shared/videoSources';
import { getSessionToken } from './session';

export async function uploadBackgroundVideo(file: File, onProgress: (value: number) => void, signal: AbortSignal) {
  const error = backgroundVideoFileError(file);
  if (error) throw new Error(error);
  const token = getSessionToken();
  if (!token) throw new Error('سجّل دخولك لرفع الفيديو. يمكنك معاينته قبل الرفع.');
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetch('/api/video-upload', { headers, signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'تعذّر بدء رفع الفيديو.');
  if (typeof data.prefix !== 'string') throw new Error('تعذّر بدء رفع الفيديو. تأكد من تشغيل الخادم.');
  const extension = file.type === 'video/webm' ? 'webm' : 'mp4';
  try {
    const blob = await upload(`${data.prefix}${crypto.randomUUID()}.${extension}`, file, {
      access: 'public', handleUploadUrl: '/api/video-upload', headers, multipart: true,
      contentType: file.type, abortSignal: signal,
      onUploadProgress: event => onProgress(Math.round(event.percentage)),
    });
    return blob.url;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Upload aborted', 'AbortError');
    throw new Error('تعذّر رفع الفيديو. تحقق من اتصالك وإعداد تخزين الملفات، ثم حاول مجددًا.');
  }
}
