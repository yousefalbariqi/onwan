import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { isValidEmailAddress } from '../../../shared/accountRules';
import { VerificationCodeInput } from '../components/VerificationCodeInput';
import { TurnstileBox, useHumanOk } from '../lib/turnstile';
import { clearCreationSession, sendCreationCode, storeCreationSession, verifyCreationCode, type CreationSession } from '../lib/creationCloud';
import { createGuestPageSource } from '../lib/creationDraftSource';
import { mergeWithDefaults } from '../context/PageContext';
import '../../styles/creation-email-save.css';

export default function CreationEmailSave() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code' | 'existing' | 'saving'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const verified = useRef<(CreationSession & { pageData?: any }) | null>(null);
  const running = useRef(false);
  const humanOk = useHumanOk();
  useEffect(() => { if (!wait) return; const timer = window.setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000); return () => window.clearTimeout(timer); }, [wait]);
  useEffect(() => { const previous = document.title; document.title = 'خلّنا نحفظ صفحتك — عنوان'; return () => { document.title = previous; }; }, []);
  const send = async () => {
    if (running.current || !isValidEmailAddress(email.trim()) || !humanOk) return;
    running.current = true; setBusy(true); setError('');
    try { const result = await sendCreationCode(email.trim().toLowerCase()); setWait(result.retryAfter); setStage('code'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر إرسال الرمز. حاول مجددًا.'); }
    finally { running.current = false; setBusy(false); }
  };
  const complete = async () => {
    if (running.current || (!verified.current && code.length !== 4)) return;
    running.current = true; setBusy(true); setError('');
    try {
      if (!verified.current) {
        // Read the chosen design before establishing a cloud session, so a previous
        // mailbox session can never replace a newly selected local design.
        const local = await createGuestPageSource({ cloud: false }).load().catch(() => null);
        let clientKey: string | undefined;
        try { if (local) clientKey = sessionStorage.getItem('onwan_guest_creation_tab') || undefined; } catch { /* Recover newest cloud draft if no local key is available. */ }
        const result = await verifyCreationCode(email.trim().toLowerCase(), code, clientKey);
        if (result.existingAccount) { setStage('existing'); return; }
        verified.current = { ...result, pageData: local?.pageData || result.pageData };
      }
      const session = verified.current!;
      storeCreationSession(session);
      setStage('saving');
      const data = session.pageData;
      if (!data) throw new Error('لم نجد مسودة محفوظة. ارجع واختر تصميمًا ثم أعد المحاولة.');
      // The source first backs up locally, uploads media through the scoped token,
      // then saves to the verified mailbox. Failed cloud writes never discard local edits.
      await createGuestPageSource().saveDraft!(mergeWithDefaults(data));
      navigate('/signup?step=edit', { replace: true });
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ بداية صفحتك. حاول مجددًا.'); }
    finally { running.current = false; setBusy(false); }
  };
  const login = `/login?email=${encodeURIComponent(email.trim())}`;
  return <main className="creation-email" dir="rtl"><div className="creation-email__content">
    <Link to="/" className="creation-email__logo" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
    {!verified.current && <button type="button" className="creation-email__back" disabled={busy} onClick={() => {
      if (stage === 'email') navigate('/signup?step=templates');
      else { setStage('email'); setCode(''); setError(''); clearCreationSession(); }
    }}><ArrowRight size={20} aria-hidden="true" />رجوع</button>}
    <h1>{stage === 'email' ? 'خلّنا نحفظ صفحتك!' : stage === 'existing' ? 'أهلًا بعودتك!' : 'تحقق من بريدك'}</h1>
    <p className="creation-email__description">{stage === 'email' ? 'أدخل بريدك عشان تقدر ترجع وتكمل تصميمك بأي وقت.' : stage === 'existing' ? 'بريدك مرتبط بحساب موجود. سجّل الدخول أو استعد الوصول لحسابك، وتصميمك المختار محفوظ على هذا الجهاز.' : <>أدخل الرمز المكوّن من ٤ أرقام المرسل إلى <bdi>{email}</bdi></>}</p>
    {stage === 'existing' ? <div className="creation-email__existing"><Link className="creation-email__button" to={login}>تسجيل الدخول</Link><Link to={`/reset-password?email=${encodeURIComponent(email.trim())}`}>استعادة الوصول للحساب</Link></div> : <form noValidate onSubmit={event => { event.preventDefault(); void (stage === 'email' ? send() : complete()); }}>
      {stage === 'email' ? <label><span className="sr-only">البريد الإلكتروني</span><input type="email" inputMode="email" autoComplete="email" placeholder="البريد الإلكتروني" aria-label="البريد الإلكتروني" dir="ltr" value={email} onChange={event => { setEmail(event.target.value.trim()); setError(''); }} disabled={busy} maxLength={255} /></label> : <VerificationCodeInput value={code} onChange={value => { setCode(value); setError(''); }} invalid={Boolean(error)} describedBy={error ? 'creation-code-error' : undefined} disabled={busy || Boolean(verified.current)} />}

      {error && <p id="creation-code-error" role="alert" className="creation-email__error">{error}</p>}
      {stage === 'email' && <TurnstileBox />}
      <button type="submit" className="creation-email__button" disabled={busy || (stage === 'email' ? !isValidEmailAddress(email.trim()) || !humanOk : code.length !== 4 && !verified.current)}>{busy ? <><Loader2 size={20} className="animate-spin" />{stage === 'saving' ? 'جارٍ حفظ صفحتك…' : 'لحظة…'}</> : verified.current ? 'إعادة محاولة الحفظ' : 'متابعة'}</button>
      {stage !== 'email' && !verified.current && <div className="creation-email__resend"><button type="button" disabled={busy || wait > 0 || !humanOk} onClick={() => void send()}>{wait > 0 ? `إعادة الإرسال بعد ${wait} ثانية` : 'إعادة إرسال الرمز'}</button><button type="button" disabled={busy} onClick={() => { setStage('email'); setCode(''); setError(''); clearCreationSession(); }}>تغيير البريد</button><TurnstileBox /></div>}
    </form>}
    <p className="creation-email__login">لديك حساب؟ <Link to={login}>سجّل الدخول</Link></p>
    <p className="creation-email__terms">بالمتابعة، توافق على <Link to="/terms">الشروط والأحكام</Link> و<Link to="/privacy">سياسة الخصوصية</Link>.</p>
    <p className="creation-email__note">لحفظ تصميمك فقط، بدون دفع أو نشر.</p>
  </div></main>;
}
