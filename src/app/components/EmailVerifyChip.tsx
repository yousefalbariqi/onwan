import { useEffect, useRef, useState } from 'react';
import { VerificationCodeInput } from './VerificationCodeInput';
import { createPortal } from 'react-dom';
import { Check, Mail } from 'lucide-react';
import { resendWait, sendEmailCode, verifyEmailCode } from '../lib/api';
import { usePageContext } from '../context/PageContext';

const CODE_LENGTH = 4;
const RESEND_SECONDS = 60;
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

// Email confirmation from the editor header (replaces the big banner): a small
// «أكّد بريدك» button takes the header's place; the code is typed in a popup,
// and once confirmed a short «تم» shows before the usual buttons come back.
export function EmailVerifyChip({ autoOpen = false, label = 'أكّد بريدك لإتمام النشر' }: { autoOpen?: boolean; label?: string } = {}) {
  const { account, setAccount } = usePageContext();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Note 38: «sent» is shown only once the server accepted the request.
  const [info, setInfo] = useState('');
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!autoOpen || started.current || !account || account.emailVerified) return;
    started.current = true;
    setOpen(true);
    void send();
  }, [autoOpen, account?.emailVerified]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    try {
      setError('');
      setInfo('');
      setBusy(true);
      const response = await sendEmailCode();
      setInfo(response.message);
      setWait(response.retryAfter ?? RESEND_SECONDS);
    } catch (err) {
      // Waiting before another code is normal, not an error.
      const seconds = resendWait(err);
      if (seconds) { setWait(seconds); setInfo('أرسلنا رمز التحقق إلى بريدك الإلكتروني. تحقق من صندوق الوارد.'); }
      else setError(err instanceof Error ? err.message : 'تعذر إرسال الرمز الآن.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    try {
      setError('');
      setBusy(true);
      const response = await verifyEmailCode(code);
      setDone(true);
      // Let the success be seen, then hand the header back.
      window.setTimeout(() => setAccount(response.account), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'الرمز غير صحيح.');
      // The typed code stays, so one wrong digit is fixed without retyping all.
    } finally {
      setBusy(false);
    }
  };

  if (!account || account.emailVerified) return null;

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (wait === 0) send();
        }}
        className="flex h-10 items-center gap-1.5 rounded-full bg-amber-100 px-4 text-sm font-bold text-amber-900 active:scale-95"
        style={{ fontFamily: 'Cairo, sans-serif' }}
      >
        <Mail className="h-4 w-4" />
        {label}
      </button>

      {/* Rendered on <body>: the header uses backdrop-blur, which would make a
          fixed popup inside it position against the header, not the screen. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-[340px] rounded-3xl bg-white p-6 text-center shadow-2xl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {done ? (
              <div className="py-4">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check className="h-8 w-8" /></span>
                <p className="mt-3 text-lg font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>تم تأكيد بريدك</p>
              </div>
            ) : (
              <>
                <p className="text-lg font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>أدخل رمز التأكيد</p>
                <p className="mt-1 text-sm text-[#737373]">أرسلنا {CODE_LENGTH} أرقام إلى <span dir="ltr">{account.email}</span></p>
                <div className="mt-5"><VerificationCodeInput value={code} onChange={value => { setCode(value); setError(''); }} disabled={busy} invalid={Boolean(error)} describedBy={error ? 'email-verify-code-error' : undefined} /></div>
                <button type="button" disabled={busy || code.length !== CODE_LENGTH} onClick={() => void verify(code)} className="mt-4 min-h-12 w-full rounded-full bg-[#ff6b2c] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? 'لحظة…' : 'تأكيد الرمز'}</button>
                {error ? (
                  <p id="email-verify-code-error" role="alert" className="mt-3 text-sm text-[#DC2626]">{error}</p>
                ) : info ? (
                  <p role="status" className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#15803D]"><Check className="h-4 w-4 shrink-0" />{info}</p>
                ) : null}
                <button onClick={send} disabled={wait > 0 || busy} className="mt-4 text-sm font-bold text-[#C2410C] disabled:text-[#737373]">
                  {wait > 0 ? <>إعادة الإرسال بعد <span dir="ltr">{clock(wait)}</span></> : 'إعادة إرسال الرمز'}
                </button>
                <button onClick={() => setOpen(false)} className="mt-2 block w-full py-2 text-sm text-[#737373]">لاحقًا</button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
