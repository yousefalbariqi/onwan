import { useEffect, useRef } from 'react';

// REQ-020: Cloudflare Turnstile («لست روبوتًا»), mostly invisible. Shown only
// when VITE_TURNSTILE_SITE_KEY is set; requests then carry the token, and the
// server checks it (TURNSTILE_SECRET). A token works once, so it is reset
// after every use.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
let token = '';

type TurnstileApi = { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void };
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
let widgetId: string | undefined;

// The current token for one request; the widget then fetches a fresh one.
export function takeTurnstileToken() {
  const current = token;
  token = '';
  if (current) api()?.reset(widgetId);
  return current || undefined;
}

export function TurnstileBox() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    const mount = () => {
      if (!box.current || !api()) return;
      widgetId = api()!.render(box.current, {
        sitekey: SITE_KEY,
        language: 'ar',
        appearance: 'interaction-only',
        callback: (value: string) => { token = value; },
        'expired-callback': () => { token = ''; },
      });
    };
    if (api()) { mount(); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
  }, []);
  if (!SITE_KEY) return null;
  return <div ref={box} className="flex justify-center" />;
}
