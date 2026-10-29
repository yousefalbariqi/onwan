import nonprofit from '../api/nonprofit.js';
import walletPass from '../api/wallet-pass.js';
import { retryNonprofitNotifications } from '../api/_lib/nonprofit.js';
import signup from '../api/auth/signup.js';
import login from '../api/auth/login.js';
import resetPassword from '../api/auth/reset-password.js';
import emailCode from '../api/auth/email-code.js';
import pageMe from '../api/page/me.js';
import publicPage from '../api/public-page.js';
import usernameCheck from '../api/username/check.js';
import report from '../api/report.js';
import account from '../api/account.js';
import admin from '../api/admin.js';
import partner from '../api/partner.js';
import videoUpload from '../api/video-upload.js';
import mediaUpload from '../api/media-upload.js';
import streamVideo from '../api/stream-video.js';
import { handleApiError, sendJson } from '../api/_lib/http.js';
import { runMediaCleanup, type MediaStore } from '../api/_lib/mediaCleanup.js';
import { rollUpOldVisits } from '../api/_lib/visitRollup.js';
import { applyRetention } from '../api/_lib/retention.js';
import { runStreamCleanup } from '../api/_lib/streamCleanup.js';
import { edgeCache } from '../api/_lib/publicCache.js';
import { recordVisit } from '../api/_lib/page.js';
import { withRuntime, type RequestRuntime, type RuntimeEnv } from '../api/_lib/runtime.js';

// Explicit allowlist: helpers under api/_lib can never become public routes.
export const routes: Record<string, (req: any, res: any) => Promise<void>> = {
  '/api/auth/signup': signup,
  '/api/auth/login': login,
  '/api/auth/reset-password': resetPassword,
  '/api/auth/email-code': emailCode,
  '/api/page/me': pageMe,
  '/api/public-page': publicPage,
  '/api/username/check': usernameCheck,
  '/api/report': report,
  '/api/account': account,
  '/api/admin': admin,
  '/api/partner': partner,
  '/api/nonprofit': nonprofit,
  '/api/wallet-pass': walletPass,
  '/api/video-upload': videoUpload,
  '/api/media-upload': mediaUpload,
  '/api/stream-video': streamVideo,
};

export async function invokeHandler(request: Request, handler: typeof signup, query?: Record<string, string>) {
  const url = new URL(request.url);
  const req = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    query: query ?? Object.fromEntries(url.searchParams),
    text: () => request.text(),
    arrayBuffer: () => request.arrayBuffer(),
  };
  let status = 200;
  let body: BodyInit | null = null;
  const headers = new Headers();
  const res = {
    headersSent: false,
    status(code: number) { status = code; return this; },
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
    send(value: BodyInit | null) { body = value; this.headersSent = true; },
  };
  try {
    await handler(req, res);
    if (!res.headersSent) throw new Error('API handler did not send a response');
  } catch (error) {
    if (!res.headersSent) handleApiError(res, error);
  }
  // No shared CDN cache for account/auth/admin responses.
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(request.method === 'HEAD' ? null : body, { status, headers });
}

type MediaObject = {
  size: number;
  httpEtag: string;
  range?: { offset?: number; length?: number; suffix?: number };
  body?: ReadableStream;
  writeHttpMetadata(headers: Headers): void;
};
type MediaReader = { get(key: string, options?: { range?: Headers; onlyIf?: Headers }): Promise<MediaObject | null> };

// Background videos from R2, on every host (subdomains and custom domains),
// with byte ranges so phones can stream and seek.
export async function serveMedia(request: Request, env: RuntimeEnv, key: string) {
  const media = env.MEDIA as MediaReader | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!media || !(/^wallpapers\/[a-zA-Z0-9-]{1,64}\/[a-f0-9-]{36}\.(mp4|webm)$/.test(key) || /^files\/[a-zA-Z0-9-]{1,64}\/[a-f0-9]{64}\.(png|jpg|webp|gif|pdf|ttf|otf|woff2|woff)$/.test(key))) return new Response('Not found', { status: 404 });
  // Note 53: whole-file GETs are kept in Cloudflare's edge cache (the CDN);
  // names never change content, so a cached copy never goes stale.
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheable = request.method === 'GET' && !request.headers.has('range');
  if (edge && cacheable) {
    const hit = await edge.match(request);
    if (hit) return hit;
  }
  const object = await media.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  // A stored name is never reused, so the file can be cached for good.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (!object.body) return new Response(null, { status: 304, headers });
  const range = object.range;
  if (range && request.headers.has('range')) {
    const offset = range.suffix !== undefined ? object.size - range.suffix : range.offset ?? 0;
    const length = range.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  const response = new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
  if (edge && cacheable) await edge.put(request, response.clone()).catch(() => undefined);
  return response;
}

// REQ-021: a public page (its data, and its HTML on the subdomain) is served
// from a ready copy for 60 s. A visit is still counted for every load of the
// data, from the page id the copy carries.
async function cachedPublic(request: Request, build: () => Promise<Response>) {
  const cache = edgeCache();
  if (!cache || request.method !== 'GET') return build();
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) {
    const pageId = hit.headers.get('X-Onwan-Page');
    if (pageId) await recordVisit(pageId).catch(() => undefined);
    return hit;
  }
  const response = await build();
  if (response.status === 200 && /s-maxage=/.test(response.headers.get('Cache-Control') ?? '')) {
    await cache.put(key, response.clone()).catch(() => undefined);
  }
  return response;
}

async function dispatch(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/api/public-page' && !url.searchParams.has('image') && !url.searchParams.has('host')) {
    return cachedPublic(request, () => invokeHandler(request, publicPage));
  }
  if (path === '/api' || path.startsWith('/api/')) {
    const handler = routes[path];
    if (handler) return invokeHandler(request, handler);
    return invokeHandler(request, async (_req, res) => sendJson(res, 404, { error: 'Not found' }));
  }
  if (path.startsWith('/media/wallpapers/') || path.startsWith('/media/files/')) return serveMedia(request, env, path.slice('/media/'.length));
  const root = typeof env.ROOT_DOMAIN === 'string' ? env.ROOT_DOMAIN : 'onwan.link';
  const suffix = `.${root}`;
  const label = url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : '';
  // Dedicated association landing bypasses public customer lookup and its cache.
  if (label === 'nonprofit' && path === '/') {
    if (!env.ASSETS) return new Response('Static assets unavailable', { status: 503 });
    return env.ASSETS.fetch(request);
  }
  if (path === '/' && label !== 'www' && label !== 'admin' && /^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
    // Override query values, just as the former host rewrite did.
    return cachedPublic(request, () => invokeHandler(request, publicPage, { render: 'html', username: label }));
  }
  if (!env.ASSETS) return new Response('Static assets unavailable', { status: 503 });
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const scope: RequestRuntime = { env };
    return withRuntime(scope, async () => {
      try {
        return await dispatch(request, env);
      } finally {
        // No connections or credentials escape the current request.
        await scope.pool?.end();
      }
    });
  },

  // Hourly: delete unused files (30 days if ever saved; 24 hours if abandoned).
  async scheduled(_event: unknown, env: RuntimeEnv): Promise<void> {
    const scope: RequestRuntime = { env };
    await withRuntime(scope, async () => {
      try {
        if (!env.MEDIA) throw new Error('no MEDIA bucket');
        const result = await runMediaCleanup(env.MEDIA as MediaStore);
        console.log('[media-cleanup]', JSON.stringify(result));
      } catch (error) {
        console.error('[media-cleanup] failed', error);
      }
      try {
        await retryNonprofitNotifications();
      } catch (error) { console.error('[nonprofit-notifications] failed', error); }
      try {
        console.log('[visit-rollup]', JSON.stringify(await rollUpOldVisits()));
      } catch (error) {
        console.error('[visit-rollup] failed', error);
      }
      try {
        console.log('[stream-cleanup]', JSON.stringify(await runStreamCleanup()));
      } catch (error) {
        console.error('[stream-cleanup] failed', error);
      }
      try {
        console.log('[retention]', JSON.stringify(await applyRetention()));
      } catch (error) {
        console.error('[retention] failed', error);
      } finally {
        await scope.pool?.end();
      }
    });
  },
};
