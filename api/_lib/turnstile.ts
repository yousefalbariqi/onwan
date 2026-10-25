import { getEnv } from './runtime.js';
import { HttpError } from './http.js';

// REQ-020: Cloudflare Turnstile («لست روبوتًا»), mostly invisible to people.
// Off until TURNSTILE_SECRET is set (with VITE_TURNSTILE_SITE_KEY for the
// browser); then sign-up, sign-in, password reset and partner applications
// need a valid token. Cloudflare's own rules handle temporary blocking.
export async function assertHuman(req: any, body: any) {
  const secret = getEnv('TURNSTILE_SECRET');
  if (!secret) return;
  const token = String(body?.turnstileToken ?? '');
  if (!token) throw new HttpError(400, 'أكمل التحقق «لست روبوتًا» ثم حاول مجددًا.', 'turnstile_required');
  const form = new URLSearchParams({ secret, response: token });
  const ip = req.headers?.['cf-connecting-ip'];
  if (ip) form.set('remoteip', String(ip));
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    .then((response) => response.json() as Promise<{ success?: boolean }>)
    .catch(() => ({ success: false }));
  if (!result.success) throw new HttpError(400, 'تعذر التحقق أنك لست روبوتًا. أعد المحاولة.', 'turnstile_failed');
}
