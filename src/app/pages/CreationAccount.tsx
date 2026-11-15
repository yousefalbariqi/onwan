import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { PasswordInput } from '../components/PasswordInput';
import { passwordChecks, passwordProblem, normalizeSaudiMobile, PHONE_HINT, isValidEmailAddress } from '../../../shared/accountRules';
import { arabicSlug } from '../lib/arabicSlug';
import { digitsOnly } from '../lib/digits';
import { checkUsername, signup } from '../lib/api';
import { changeCreationEmail, creationSession, clearCreationSession, readCloudCreation, storeCreationSession } from '../lib/creationCloud';
import { createGuestPageSource } from '../lib/creationDraftSource';
import { usePageContext, type PageData } from '../context/PageContext';
import { setSessionToken } from '../lib/session';
import { TurnstileBox, useHumanOk } from '../lib/turnstile';
import '../../styles/creation-email-save.css';

export default function CreationAccount() {
  const navigate = useNavigate();
  const accountContext = usePageContext();
  const [session, setSession] = useState(creationSession);
  const [draft, setDraft] = useState<PageData | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [customLink, setCustomLink] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [editLink, setEditLink] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [recordedConsent, setRecordedConsent] = useState(false);
  const [linkState, setLinkState] = useState<{ name: string; status: string; reason?: string }>({ name: '', status: '' });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const humanOk = useHumanOk();
  const username = customLink ?? arabicSlug(name);
  const formKey = session ? `onwan_account_form:${session.id}` : '';
  useEffect(() => {
    let live = true;
    if (!session) { navigate('/signup?step=save', { replace: true }); return; }
    Promise.all([createGuestPageSource().load(), readCloudCreation(session)]).then(([local, cloud]) => {
      if (!live) return;
      setDraft(local.pageData);
      let saved: any = null; try { saved = JSON.parse(sessionStorage.getItem(formKey) || 'null'); } catch { /* Optional form recovery. */ }
      setName(saved?.baseName === local.pageData.name ? saved.name : local.pageData.name); setPhone(saved?.phone ?? ''); setCustomLink(saved?.customLink ?? (local.pageData.username || null));
      setRecordedConsent(Boolean(cloud.termsAccepted));
    }).catch(problem => { if (live) setError(problem.message); });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (!draft) return; try { sessionStorage.setItem(formKey, JSON.stringify({ name, phone, customLink, baseName: draft.name })); } catch { /* The design still has its durable backup. */ } }, [name, phone, customLink, draft, formKey]);
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [wait]);
  useEffect(() => {
    if (!username) { setLinkState({ name: '', status: '' }); return; }
    let live = true; const controller = new AbortController();
    setLinkState({ name: username, status: 'checking' });
    const timeout = setTimeout(() => controller.abort(), 10000);
    const timer = setTimeout(() => { checkUsername(username, controller.signal).then(result => {
      if (live) setLinkState({ name: username, status: result.available ? 'available' : 'unavailable', reason: result.reason || undefined });
    }).catch(() => { if (live) setLinkState({ name: username, status: 'error', reason: 'تعذر التحقق. أعد المحاولة.' }); }).finally(() => clearTimeout(timeout)); }, 400);
    return () => { live = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [username, retry]);
  async function back() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { if (draft) await createGuestPageSource().saveDraft!({ ...draft, name }); navigate('/signup?step=edit'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function changeEmail() {
    if (running.current || !isValidEmailAddress(newEmail) || (!sent && !humanOk)) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await changeCreationEmail(sent ? 'change-verify' : 'change-send', newEmail.trim().toLowerCase(), code);
      if (!sent) { setSent(true); setWait(result.retryAfter ?? 60); }
      else { storeCreationSession(result); setSession(result); setEditEmail(false); setSent(false); setCode(''); }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر تعديل البريد.'); }
    finally { running.current = false; setBusy(false); }
  }
  const linkReady = linkState.name === username && linkState.status === 'available';
  const ready = Boolean(draft && name.trim() && normalizeSaudiMobile(phone) && !passwordProblem(password) && linkReady && (accepted || recordedConsent) && humanOk && !editEmail);
  async function complete() {
    if (!ready || running.current || !session || !draft) return;
    running.current = true; setBusy(true); setError('');
    try {
      try { await createGuestPageSource().saveDraft!({ ...draft, name: name.trim() }); }
      catch (problem) { if ((problem as any)?.code !== 'creation_completed') throw problem; }
      const current = creationSession();
      if (!current) throw new Error('أعد التحقق من بريدك.');
      const result = await signup({ username, email: current.email, phone: normalizeSaudiMobile(phone)!, password, organizationName: name.trim(), creationToken: current.token, termsAccepted: accepted || recordedConsent });
      setSessionToken(result.token);
      accountContext.replacePageData(result.pageData); accountContext.setAccount(result.account); accountContext.setAuthenticated(true);
      clearCreationSession();
      try { sessionStorage.removeItem(formKey); } catch { /* Account and design are already saved on the server. */ }
      navigate('/plan-selection', { replace: true });
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ الحساب.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <main className="creation-email creation-account" dir="rtl"><div className="creation-email__content">
    <header className="creation-account__header"><button type="button" onClick={() => void back()} disabled={busy} aria-label="الرجوع للمصمم"><ArrowRight size={22} /></button><Link to="/" className="creation-email__logo" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link></header>
    <h1>صفحتك تستاهل نحفظها!</h1><p className="creation-email__description">أكمل بيانات حسابك واختر رابط صفحتك</p>
    <form noValidate onSubmit={event => { event.preventDefault(); void complete(); }}>
      <div className="creation-account__row"><div><span>البريد الإلكتروني</span><strong><bdi>{session?.email}</bdi><Check size={16} aria-label="موثق" /></strong></div><button type="button" disabled={busy} onClick={() => { setEditEmail(value => !value); setNewEmail(''); setSent(false); setCode(''); }}>تعديل</button></div>
      {editEmail && <section className="creation-account__email-change" aria-label="تعديل البريد"><label>البريد الجديد<input type="email" dir="ltr" value={newEmail} disabled={busy || sent} onChange={event => setNewEmail(event.target.value)} /></label>{sent && <label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} maxLength={4} onChange={event => setCode(digitsOnly(event.target.value).slice(0, 4))} /></label>}<button type="button" disabled={busy || !isValidEmailAddress(newEmail) || (sent ? code.length !== 4 : !humanOk)} onClick={() => void changeEmail()}>{sent ? 'تأكيد البريد الجديد' : 'إرسال رمز التحقق'}</button>{sent && <button type="button" disabled={busy || wait > 0 || !humanOk} onClick={() => { setSent(false); setCode(''); }}>{wait ? `إعادة الإرسال بعد ${wait} ثانية` : 'طلب رمز جديد'}</button>}<p>يبقى بريدك الحالي معتمدًا حتى تأكيد البريد الجديد.</p></section>}
      <label className="creation-account__field">كلمة المرور<PasswordInput value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" dir="ltr" maxLength={200} disabled={busy} aria-describedby="creation-password-rules" /></label>
      <ul id="creation-password-rules" className="creation-account__rules" aria-live="polite">{passwordChecks(password).map(rule => <li key={rule.label} data-valid={rule.ok}>{rule.ok ? '✓' : '○'} {rule.label}</li>)}</ul>
      <label className="creation-account__field">رقم الجوال<input type="tel" inputMode="tel" dir="ltr" value={phone} placeholder="05XXXXXXXX" autoComplete="tel" disabled={busy} onChange={event => setPhone(digitsOnly(event.target.value))} aria-invalid={Boolean(phone && !normalizeSaudiMobile(phone))} /></label>{phone && !normalizeSaudiMobile(phone) && <p className="creation-email__error">{PHONE_HINT}</p>}
      <div className="creation-account__row"><div><span>اسم الصفحة</span>{editName ? <input value={name} maxLength={80} disabled={busy} onChange={event => setName(event.target.value)} aria-label="اسم الصفحة" /> : <strong>{name || 'جارٍ تحميل الصفحة…'}</strong>}</div><button type="button" disabled={busy} onClick={() => setEditName(value => !value)}>{editName ? 'تم' : 'تعديل'}</button></div>
      <div className="creation-account__row"><div><span>رابط صفحتك</span>{editLink ? <input dir="ltr" aria-label="اسم رابط الصفحة" value={username} maxLength={30} disabled={busy} onChange={event => setCustomLink(event.target.value.toLowerCase().trim())} /> : <strong dir="ltr">{username || '…'}.onwan.link</strong>}</div><button type="button" disabled={busy} onClick={() => { if (!editLink) setCustomLink(username); setEditLink(value => !value); }}>{editLink ? 'تم' : 'تعديل'}</button></div>
      <p className="creation-account__availability" role="status" data-valid={linkReady}>{linkState.name !== username || linkState.status === 'checking' ? 'جارٍ التحقق من الرابط…' : linkReady ? 'الرابط متاح — يتأكد الحجز عند حفظ الحساب' : linkState.reason || 'اختر رابطًا لصفحتك'}{linkState.status === 'error' && <button type="button" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button>}</p>
      {!recordedConsent ? <label className="creation-account__consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /><span>أوافق على <Link to="/terms" target="_blank">الشروط والأحكام</Link> و<Link to="/privacy" target="_blank">سياسة الخصوصية</Link>.</span></label> : <p className="creation-email__terms">موافقتك على الشروط وسياسة الخصوصية مسجلة.</p>}
      <TurnstileBox />{error && <p className="creation-email__error" role="alert">{error} <Link to="/login">تسجيل الدخول</Link></p>}
      <button type="submit" className="creation-email__button" disabled={busy || !ready}>{busy ? <><Loader2 size={18} className="animate-spin" />جارٍ حفظ صفحتك…</> : 'حفظ صفحتي والمتابعة'}</button>
      <p className="creation-email__note">لن يتم دفع أي مبلغ في هذه الخطوة</p>
    </form>
  </div></main>;
}
