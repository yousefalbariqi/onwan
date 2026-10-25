import { backgroundVideoFileError } from '../../../shared/videoSources';
import { getSessionToken } from './session';

// Background video upload. REQ-023: with Cloudflare Stream on, the file goes
// straight from the browser to Stream (which compresses it), then we wait for
// its MP4 to be ready; otherwise it is stored in R2 as before. XHR rather than
// fetch so the editor can show upload progress.
export function uploadBackgroundVideo(file: File, onProgress: (value: number) => void, signal: AbortSignal, authToken?: string | null, onPhase?: (phase: 'uploading' | 'processing') => void) {
  const error = backgroundVideoFileError(file);
  if (error) return Promise.reject(new Error(error));
  const token = authToken === undefined ? getSessionToken() : authToken;
  if (!token) return Promise.reject(new Error('سجّل دخولك لرفع الفيديو. يمكنك معاينته قبل الرفع.'));
  return uploadToStream(file, onProgress, signal, token, onPhase).then((url) => url ?? uploadToR2(file, onProgress, signal, token));
}

async function streamCall<T>(token: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/stream-video', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'تعذّر رفع الفيديو.'), { code: data.code });
  return data as T;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Upload aborted', 'AbortError')); }, { once: true });
});

// Resolves null when Stream is not on, so the caller falls back to R2.
async function uploadToStream(file: File, onProgress: (value: number) => void, signal: AbortSignal, token: string, onPhase?: (phase: 'uploading' | 'processing') => void) {
  let created: { uploadURL: string; uid: string };
  try {
    created = await streamCall(token, { action: 'create' }, signal);
  } catch (error) {
    if ((error as { code?: string }).code === 'stream_off') return null;
    throw error;
  }
  onPhase?.('uploading');
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', created.uploadURL);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('تعذّر رفع الفيديو. حاول مجددًا.')));
    request.onerror = () => reject(new Error('تعذّر رفع الفيديو. تحقق من اتصالك ثم حاول مجددًا.'));
    request.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
    signal.addEventListener('abort', () => request.abort(), { once: true });
    const form = new FormData();
    form.append('file', file);
    request.send(form);
  });
  // Stream compresses the video; this usually takes seconds, at most minutes.
  onPhase?.('processing');
  for (let attempt = 0; attempt < 100; attempt++) {
    const status = await streamCall<{ ready: boolean; url?: string }>(token, { action: 'status', uid: created.uid }, signal);
    if (status.ready && status.url) return status.url;
    await wait(3000, signal);
  }
  throw new Error('يستغرق تجهيز الفيديو وقتًا أطول من المعتاد. حاول بعد قليل.');
}

function uploadToR2(file: File, onProgress: (value: number) => void, signal: AbortSignal, token: string) {
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
