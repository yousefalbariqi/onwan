import { useEffect, useRef, useSyncExternalStore } from 'react';

// REQ-020: Cloudflare Turnstile («لست روبوتًا»). Active only when
// VITE_TURNSTILE_SITE_KEY is set; requests then carry the token, and the
// server checks it (TURNSTILE_SECRET).
//
// Note (11), 25 Oct 2026: the check is always visible with its state, the
// form's button waits until it has passed, and any failure (script blocked,
// domain not allowed, expired) says so with «إعادة المحاولة» — nothing typed
// is lost. A token works once, so a fresh one is fetched after every use.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

export type TurnstileState = { status: 'off' | 'loading' | 'ready' | 'error'; message: string };
let state: TurnstileState = { status: SITE_KEY ? 'loading' : 'off', message: '' };
let token = '';
let widgetId: string | undefined;
const listeners = new Set<() => void>();
const set = (next: TurnstileState) => { state = next; listeners.forEach((listener) => listener()); };

export function useTurnstile() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state, () => state);
}

// True when the form's button may be pressed.
export function useHumanOk() {
  const { status } = useTurnstile();
  return status === 'off' || status === 'ready';
}

// True when the form may be sent now (no check needed, or it has passed).
export function turnstilePassed() {
  return !SITE_KEY || Boolean(token);
}

export function retryTurnstile() {
  token = '';
  set({ status: 'loading', message: '' });
  if (widgetId && api()) api()!.reset(widgetId);
  else loadScript(true);
}

// The token for one request; a fresh check starts at once for the next try.
export function takeTurnstileToken() {
  if (!SITE_KEY) return undefined;
  const current = token;
  if (!current) throw new Error('انتظر لحظة حتى يكتمل التحقق «لست روبوتًا»، ثم حاول مجددًا.');
  token = '';
  set({ status: 'loading', message: '' });
  if (widgetId) api()?.reset(widgetId);
  return current;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(again = false) {
  if (api()) return Promise.resolve();
  if (scriptPromise && !again) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('timeout')), 12000);
    script.onload = () => { window.clearTimeout(timer); resolve(); };
    script.onerror = () => { window.clearTimeout(timer); reject(new Error('blocked')); };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    set({ status: 'error', message: 'تعذّر تحميل التحقق «لست روبوتًا». تحقق من الاتصال، أو أوقف مانع الإعلانات لهذا الموقع.' });
    throw error;
  });
  return scriptPromise;
}

// Cloudflare's error codes, in plain words.
function explain(code: string) {
  if (code.startsWith('110200')) return 'أداة التحقق غير مفعّلة لهذا النطاق. (للإدارة: أضف النطاق في إعدادات Turnstile.)';
  if (code.startsWith('300') || code.startsWith('600')) return 'لم يكتمل التحقق. اضغط «إعادة المحاولة».';
  return 'تعذّر التحقق الآن. اضغط «إعادة المحاولة».';
}

export function TurnstileBox() {
  const box = useRef<HTMLDivElement>(null);
  const current = useTurnstile();
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let active = true;
    token = '';
    set({ status: 'loading', message: '' });
    loadScript().then(() => {
      if (!active || !box.current || !api()) return;
      widgetId = api()!.render(box.current, {
        sitekey: SITE_KEY,
        language: 'ar',
        appearance: 'always',
        theme: 'light',
        size: 'flexible',
        'refresh-expired': 'auto',
        callback: (value: string) => { token = value; set({ status: 'ready', message: '' }); },
        'expired-callback': () => { token = ''; set({ status: 'loading', message: '' }); },
        'error-callback': (code: string) => { token = ''; set({ status: 'error', message: explain(String(code ?? '')) }); return true; },
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      if (widgetId && api()) api()!.remove(widgetId);
      widgetId = undefined;
    };
  }, []);
  if (!SITE_KEY) return null;
  return (
    <div className="space-y-1.5 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div ref={box} className="min-h-[65px] w-full overflow-hidden rounded-2xl" />
      {current.status === 'loading' && <p className="text-xs text-[#8e8e93]">جارٍ التحقق أنك لست روبوتًا…</p>}
      {current.status === 'error' && (
        <p role="alert" className="text-xs text-[#ff3b30]">
          {current.message}{' '}
          <button type="button" onClick={retryTurnstile} className="font-bold text-[#0a84ff] underline">إعادة المحاولة</button>
        </p>
      )}
    </div>
  );
}
