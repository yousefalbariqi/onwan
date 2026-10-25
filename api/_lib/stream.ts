import { getEnv } from './runtime.js';
import { HttpError } from './http.js';

// REQ-023 (owner bought Cloudflare Stream, 25 Oct 2026): background videos go
// to Stream, which compresses them and serves them fast. The account and the
// delivery domain are public settings (wrangler vars); STREAM_API_TOKEN is a
// secret. Without the token, uploads keep using R2 as before.
export const STREAM_MAX_SECONDS = 60;

export function streamConfig() {
  const account = getEnv('CF_ACCOUNT_ID');
  const token = getEnv('STREAM_API_TOKEN');
  const host = getEnv('STREAM_CUSTOMER_HOST');
  return account && token && host ? { account, token, host } : null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = streamConfig();
  if (!config) throw new HttpError(503, 'Stream غير مفعّل.', 'stream_off');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account}/stream${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({})) as { success?: boolean; result?: T };
  if (!response.ok || !data.success) throw new HttpError(502, 'تعذّر الاتصال بخدمة الفيديو. حاول مجددًا.');
  return data.result as T;
}

// A one-time upload address, tied to its owner through the video's metadata.
export async function createStreamUpload(owner: string) {
  const result = await call<{ uploadURL: string; uid: string }>('/direct_upload', {
    method: 'POST',
    body: JSON.stringify({ maxDurationSeconds: STREAM_MAX_SECONDS, requireSignedURLs: false, meta: { owner } }),
  });
  return { uploadURL: result.uploadURL, uid: result.uid };
}

type StreamVideo = { uid: string; readyToStream: boolean; size?: number; meta?: { owner?: string }; status?: { state?: string } };

export function streamUrls(uid: string) {
  const host = streamConfig()!.host;
  return { url: `https://${host}/${uid}/downloads/default.mp4`, poster: `https://${host}/${uid}/thumbnails/thumbnail.jpg?time=0s` };
}

// Ready once Stream finished encoding and the MP4 rendition (what a muted,
// looping <video> plays) exists. Only the owner's own videos are answered.
export async function streamStatus(uid: string, owner: string) {
  if (!/^[a-f0-9]{32}$/.test(uid)) throw new HttpError(400, 'معرّف فيديو غير صالح.');
  const video = await call<StreamVideo>(`/${uid}`);
  if (video.meta?.owner !== owner) throw new HttpError(403, 'هذا الفيديو لا يتبع حسابك.');
  if (video.status?.state === 'error') throw new HttpError(400, 'تعذّر تجهيز الفيديو. جرّب ملفًا آخر.');
  if (!video.readyToStream) return { ready: false as const };
  const downloads = await call<{ default?: { status?: string } }>(`/${uid}/downloads`, { method: 'POST' });
  if (downloads.default?.status !== 'ready') return { ready: false as const };
  return { ready: true as const, ...streamUrls(uid), size: video.size ?? null };
}

const STREAM_URL = /^https:\/\/(customer-[a-z0-9]+\.cloudflarestream\.com)\/([a-f0-9]{32})\/downloads\/default\.mp4$/;

export function streamUidFromUrl(value: string) {
  const match = STREAM_URL.exec(value);
  return match && match[1] === streamConfig()?.host ? match[2] : null;
}

// On save: the Stream video must exist and belong to the saving account.
export async function verifyStreamVideo(value: string, owner: string) {
  const uid = streamUidFromUrl(value);
  if (!uid) return null;
  const video = await call<StreamVideo>(`/${uid}`);
  if (video.meta?.owner !== owner) throw new HttpError(403, 'فيديو الخلفية لا يتبع ملفات حسابك.');
  return { size: video.size ?? null };
}

// For the daily cleanup (REQ-023): every video on the account, and deletion.
export async function listStreamVideos() {
  const videos = await call<{ uid: string; created: string }[]>('');
  return videos.map((video) => ({ uid: video.uid, created: video.created }));
}

export async function deleteStreamVideo(uid: string) {
  const config = streamConfig();
  if (!config || !/^[a-f0-9]{32}$/.test(uid)) return;
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account}/stream/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${config.token}` },
  });
}
