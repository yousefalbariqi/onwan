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
import { handleApiError, sendJson } from '../api/_lib/http.js';
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
  '/api/video-upload': videoUpload,
};

export async function invokeHandler(request: Request, handler: typeof signup, query?: Record<string, string>) {
  const url = new URL(request.url);
  const req = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    query: query ?? Object.fromEntries(url.searchParams),
    text: () => request.text(),
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

async function dispatch(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/api' || path.startsWith('/api/')) {
    const handler = routes[path];
    if (handler) return invokeHandler(request, handler);
    return invokeHandler(request, async (_req, res) => sendJson(res, 404, { error: 'Not found' }));
  }
  const root = typeof env.ROOT_DOMAIN === 'string' ? env.ROOT_DOMAIN : 'onwan.link';
  const suffix = `.${root}`;
  const label = url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : '';
  if (path === '/' && label !== 'www' && /^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
    // Override query values, just as the former host rewrite did.
    return invokeHandler(request, publicPage, { render: 'html', username: label });
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
};
