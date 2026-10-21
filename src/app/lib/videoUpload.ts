import { backgroundVideoFileError } from '../../../shared/videoSources';
import { getSessionToken } from './session';

// Sends the file to our API, which stores it in Cloudflare R2; XHR rather than
// fetch so the editor can show upload progress.
export function uploadBackgroundVideo(file: File, onProgress: (value: number) => void, signal: AbortSignal) {
  const error = backgroundVideoFileError(file);
  if (error) return Promise.reject(new Error(error));
  const token = getSessionToken();
  if (!token) return Promise.reject(new Error('سجّل دخولك لرفع الفيديو. يمكنك معاينته قبل الرفع.'));
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/video-upload');
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(request.responseText); } catch { /* not JSON */ }
      if (request.status >= 200 && request.status < 300 && typeof data.url === 'string') resolve(data.url);
      else reject(new Error(data.error || 'تعذّر رفع الفيديو. حاول مجددًا.'));
    };
    request.onerror = () => reject(new Error('تعذّر رفع الفيديو. تحقق من اتصالك ثم حاول مجددًا.'));
    request.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
    signal.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}
