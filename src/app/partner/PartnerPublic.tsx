import { PageView } from '../components/PageView';
import { mergeWithDefaults } from '../context/PageContext';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BRAND_NAME, ROOT_DOMAIN } from '../lib/site';
import { useAuthSuccess } from '../lib/useAuthSuccess';
import { Button, ErrorNote, Field, PLAN_NAMES, inputClass, useAction } from '../admin/ui';
import { partnerCall } from './partnerApi';
import { PasswordInput } from '../components/PasswordInput';
import { TurnstileBox } from '../lib/turnstile';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-xl font-black text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// B2B-01 / note 54: partnership application — what it is, three benefits,
// then a short form with no password. The account opens after approval, and
// sign-in is by a code sent to the email.
export function PartnerApply() {
  const [form, setForm] = useState({ shopName: '', contactName: '', email: '', phone: '', city: '' });
  const [done, setDone] = useState('');
  const action = useAction();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  const field = 'min-w-0 flex-1 bg-transparent py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none';
  const ready = form.shopName.trim().length > 1 && form.contactName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.phone.length >= 9;

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f7] p-5" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="w-full max-w-[380px] text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759] text-3xl text-white">✓</span>
          <h1 className="mt-4 text-[26px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>وصلنا طلبك</h1>
          <p className="mt-2 text-[15px] leading-7 text-[#6e6e73]">تراجع إدارة {BRAND_NAME} طلبك، ونبلغك على بريدك عند الموافقة. بعدها تدخل البوابة برمز يصلك على البريد.</p>
          <Link to="/" className="mt-6 inline-block text-[15px] font-bold text-[#0a84ff]">العودة إلى {BRAND_NAME}</Link>
        </div>
      </div>
    );
  }

  const benefits = [
    { title: 'ربح من أول اشتراك', text: 'الفرق بين سعرك وسعر البيع لك.' },
    { title: 'عمولة على التجديد', text: 'نصيبك يستمر مع تجديد عملائك.' },
    { title: 'بوابة سهلة', text: 'تسجّل عملاءك وتتابع طلباتهم من جوالك.' },
  ];

  return (
    <div className="min-h-screen bg-[#f2f2f7]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="mx-auto max-w-[440px] space-y-6 px-5 pb-10 pt-12">
        <header className="text-center">
          <p className="text-[13px] font-bold text-[#0a84ff]">برنامج الشركاء</p>
          <h1 className="mt-1 text-[30px] font-black leading-tight text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>كن شريكًا في {BRAND_NAME}</h1>
          {/* Note 56: open to individuals, establishments and companies alike, for any kind of client. */}
          <p className="mt-2 text-[15px] leading-7 text-[#6e6e73]">انضم إلى برنامج شركاء {BRAND_NAME}، وساعد الأفراد والمنشآت على إنشاء صفحاتهم الرقمية، واستفد من مكافآت الاشتراكات وعمولات التجديد.</p>
        </header>

        <ul className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
          {benefits.map((item) => (
            <li key={item.title} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#34c759]/12 text-sm font-black text-[#1f7a35]">✓</span>
              <span><b className="block text-[15px] text-[#1d1d1f]">{item.title}</b><span className="text-[13px] text-[#6e6e73]">{item.text}</span></span>
            </li>
          ))}
        </ul>

        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); action.run(async () => setDone((await partnerCall('apply', form)).message)); }}>
          <p className="px-1 text-[13px] font-bold text-[#6e6e73]">بيانات الطلب</p>
          <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
            {([
              ['shopName', 'الاسم', 'اسمك أو اسم منشأتك', {}],
              ['contactName', 'للتواصل', 'اسم الشخص المسؤول', {}],
              ['phone', 'الجوال', '05XXXXXXXX', { dir: 'ltr', inputMode: 'numeric' as const }],
              ['email', 'البريد', 'name@example.com', { dir: 'ltr', type: 'email' }],
              ['city', 'المدينة', 'اختياري', {}],
            ] as const).map(([key, label, placeholder, extra]) => (
              <label key={key} className="flex min-h-[52px] items-center gap-3 px-4">
                <span className="w-16 shrink-0 text-[15px] text-[#1d1d1f]">{label}</span>
                <input value={form[key]} onChange={key === 'phone' ? (e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') }) : key === 'email' ? (e) => setForm({ ...form, email: e.target.value.trim() }) : set(key)} placeholder={placeholder} className={field} {...extra} style={extra && 'dir' in extra ? { textAlign: 'right' } : undefined} />
              </label>
            ))}
          </div>
          <TurnstileBox />
          <ErrorNote message={action.error} />
          <button type="submit" disabled={action.busy || !ready} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white shadow-[0_6px_16px_rgba(10,132,255,0.28)] disabled:bg-[#c7c7cc] disabled:shadow-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {action.busy ? 'لحظات…' : 'إرسال طلب الشراكة'}
          </button>
          <p className="text-center text-[13px] text-[#8e8e93]">لا تحتاج كلمة مرور. يُفعَّل حسابك بعد موافقة الإدارة.</p>
        </form>

        <Link to="/partner" className="block text-center text-[15px] text-[#0a84ff]">لديك حساب شريك؟ سجّل الدخول</Link>
      </div>
    </div>
  );
}

// The customer's side of the link a partner sends them.
export function PayOrder() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  // Note 64: the customer sees the real page first, then approves or asks for changes.
  const [stage, setStage] = useState<'review' | 'checkout' | 'changes' | 'changesSent'>('review');
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  // Note 57: the test payment (DEMO_PRICES only) and the link it returns.
  const [setupLink, setSetupLink] = useState('');

  useEffect(() => {
    partnerCall('order.view', { token })
      .then((response) => {
        setData(response);
        // Without a design there is nothing to review: straight to the order.
        if (!response.order.withDesign) setStage('checkout');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل الطلب.'));
  }, [token]);

  if (error) return <Shell title="رابط الطلب"><ErrorNote message={error} /></Shell>;
  if (!data) return <Shell title="رابط الطلب"><p className="text-sm text-gray-500">جاري التحميل...</p></Shell>;

  const { order } = data;
  const open = order.status === 'awaiting_payment' && data.pageData !== null;
  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try { await step(); } catch (err) { setActionError(err instanceof Error ? err.message : 'تعذر تنفيذ الطلب.'); } finally { setBusy(false); }
  };
  const whatsapp = order.partnerPhone ? `https://wa.me/${String(order.partnerPhone).replace(/\D/g, '').replace(/^0/, '966')}` : '';
  const sheet = 'w-full max-w-md rounded-t-[28px] bg-[#f2f2f7] px-5 pb-7 pt-5 sm:rounded-[28px]';
  const primary = 'flex min-h-[52px] w-full items-center justify-center rounded-2xl text-[17px] font-bold text-white disabled:opacity-50';

  const checkout = (
    <div className="space-y-4">
      {!setupLink && <h2 className="text-center text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>مراجعة الطلب</h2>}
      {setupLink ? (
        <FinishAccount setupLink={setupLink} username={order.username} />
      ) : (
        <>
          <dl className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white text-[15px]">
            {[
              ['رابط الصفحة', <span dir="ltr">{order.username}.{ROOT_DOMAIN}</span>],
              ['عن طريق', order.shopName],
              [`اشتراك ${PLAN_NAMES[order.plan]}`, `${order.price} ريال`],
              ...(order.withDesign ? [['التصميم', order.designPrice ? `${order.designPrice} ريال` : 'مجانًا']] : []),
            ].map(([label, value]) => <div key={String(label)} className="flex min-h-[48px] items-center justify-between gap-3 px-4"><dt className="text-[#6e6e73]">{label}</dt><dd className="font-bold text-[#1d1d1f]">{value}</dd></div>)}
            <div className="flex min-h-[52px] items-center justify-between px-4 text-[17px]"><dt className="font-black">الإجمالي</dt><dd className="font-black">{order.total} ريال</dd></div>
          </dl>
          {/* Note 62: the customer reads and accepts the terms themself. */}
          <ul className="space-y-1.5 rounded-2xl bg-white px-4 py-3 text-[13px] leading-6 text-[#3a3a3c]">
            <li>• يبدأ الاشتراك وتُنشر الصفحة بعد تأكيد الدفع فقط.</li>
            <li>• الصفحة والحساب ملكك وحدك، ولا يملك الشريك أي صلاحية عليهما بعد الدفع.</li>
            {order.withDesign && <li>• صفحتك مجهزة مسبقًا بالتصميم الذي عاينته، وتستطيع إدارتها وتعديلها بعد الشراء.</li>}
            {!order.withDesign && <li>• بعد الشراء، صمّم صفحتك بنفسك باستخدام أدوات {BRAND_NAME}.</li>}
          </ul>
          <label className="flex items-start gap-2 px-1 text-[13px] text-[#3a3a3c]"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-[#0a84ff]" />اطلعت على تفاصيل الطلب والشروط وأوافق عليها.</label>
          {open && data.testMode ? (
            <>
              <button disabled={busy || !terms} onClick={() => run(async () => setSetupLink((await partnerCall('order.testPay', { token, termsAccepted: true })).setupLink))} className={`${primary} bg-[#34c759]`}>{busy ? 'لحظات…' : `ادفع ${order.total} ريال (تجريبي)`}</button>
              <p className="text-center text-xs font-bold text-[#9a5b00]">وضع الاختبار — لا تُحصَّل أي مبالغ.</p>
            </>
          ) : open ? (
            <p className="rounded-xl bg-[#ff9500]/12 px-4 py-3 text-[13px] leading-6 text-[#9a5b00]">الدفع الإلكتروني عبر بوابة عنوان يُفعَّل قريبًا. بعد إتمام الدفع تُنشر صفحتك ويصلك على بريدك رابط إنشاء كلمة المرور.</p>
          ) : order.status === 'completed' ? (
            <p className="rounded-xl bg-[#34c759]/12 px-4 py-3 text-[13px] text-[#1f7a35]">تم تأكيد الدفع وصفحتك منشورة. وصلك على بريدك رابط إنشاء كلمة المرور.</p>
          ) : <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-[#6e6e73]">انتهت مهلة هذا الطلب. تواصل مع الشريك.</p>}
          {actionError && <ErrorNote message={actionError} />}
          {order.withDesign && open && <button onClick={() => setStage('review')} className="block w-full text-center text-[15px] text-[#0a84ff]">العودة إلى التصميم</button>}
        </>
      )}
    </div>
  );

  // Without a design: the order on its own.
  if (!order.withDesign || !data.pageData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f2f7] p-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="w-full max-w-md">{checkout}</div>
      </main>
    );
  }

  // With a design: the page itself, as it will be published, under a slim bar.
  return (
    <div dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] leading-5 text-[#1d1d1f]"><b>تصميم صفحتك جاهز للمراجعة</b><span className="text-[#6e6e73]"> · الدفع مطلوب للتفعيل</span></p>
          {open && (
            <div className="flex gap-2">
              <button onClick={() => { setActionError(''); setStage('changes'); }} className="rounded-full bg-[#f2f2f7] px-4 py-2 text-[13px] font-bold text-[#1d1d1f]">طلب تعديل</button>
              <button disabled={busy} onClick={() => run(async () => { await partnerCall('order.approve', { token }); setStage('checkout'); })} className="rounded-full bg-[#34c759] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">موافق، متابعة الدفع</button>
            </div>
          )}
        </div>
      </div>

      {/* The real public page; its own links work, nothing can be edited. */}
      <PageView data={mergeWithDefaults({ ...data.pageData, username: order.username })} variant="public" />

      {stage !== 'review' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={() => !busy && setStage('review')}>
          <section className={`${sheet} max-h-[92dvh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            {stage === 'checkout' && checkout}
            {stage === 'changes' && (
              <div className="space-y-4">
                <h2 className="text-center text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>طلب تعديل</h2>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={1000} placeholder="ما الذي تريد تغييره؟ مثل: لون الأزرار، صورة الغلاف، نص الوصف…" className="w-full resize-none rounded-2xl bg-white p-4 text-[16px] leading-7 text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
                {actionError && <ErrorNote message={actionError} />}
                <button disabled={busy || note.trim().length < 3} onClick={() => run(async () => { await partnerCall('order.requestChanges', { token, note }); setStage('changesSent'); })} className={`${primary} bg-[#0a84ff]`}>{busy ? 'لحظات…' : 'إرسال للشريك'}</button>
                {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="block text-center text-[15px] font-bold text-[#1f8a3b]">أو تواصل مع {order.shopName} على واتساب</a>}
              </div>
            )}
            {stage === 'changesSent' && (
              <div className="space-y-3 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0a84ff] text-2xl text-white">✓</span>
                <h2 className="text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>وصل طلبك للشريك</h2>
                <p className="text-[15px] leading-7 text-[#6e6e73]">يعدّل {order.shopName} التصميم ويرسل لك النسخة الجديدة على هذا الرابط نفسه.</p>
                <button onClick={() => setStage('review')} className="block w-full text-center text-[15px] text-[#0a84ff]">العودة إلى التصميم</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// Note 73: straight after paying — a code to the account's email plus a
// password, then the customer is signed in and lands in their editor. The
// emailed set-password link stays as the fallback.
function FinishAccount({ setupLink, username }: { setupLink: string; username: string }) {
  const token = setupLink.split('/welcome/')[1] ?? '';
  const onSuccess = useAuthSuccess();
  const [sent, setSent] = useState<{ email: string } | null>(null);
  const [wait, setWait] = useState(0);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    try {
      setError('');
      const response = await partnerCall<{ email: string; retryAfter: number }>('welcome.sendCode', { token });
      setSent(response);
      setWait(response.retryAfter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرمز.');
    }
  };
  useEffect(() => { void send(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try { onSuccess(await partnerCall('welcome.complete', { token, code, password })); }
        catch (err) { setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.'); }
        finally { setBusy(false); }
      }}
    >
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759] text-2xl text-white">✓</span>
        <h2 className="mt-3 text-[22px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>تم الدفع بنجاح!</h2>
        <p className="mt-1 text-[15px] text-[#6e6e73]">بقيت خطوة واحدة للدخول إلى صفحتك <span dir="ltr">{username}.{ROOT_DOMAIN}</span></p>
      </div>
      <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
        <label className="block px-4 py-2">
          <span className="text-[13px] text-[#6e6e73]">{sent ? <>الرمز المرسل إلى <span dir="ltr">{sent.email}</span></> : 'رمز التأكيد'}</span>
          <input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • •" aria-label="رمز التأكيد" className="w-full bg-transparent py-2 text-center text-2xl tracking-[0.6em] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" dir="ltr" />
        </label>
        <label className="block px-4 py-2">
          <span className="text-[13px] text-[#6e6e73]">كلمة المرور (8 أحرف على الأقل)</span>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-label="كلمة المرور" className="w-full bg-transparent py-2 text-[17px] text-[#1d1d1f] focus:outline-none" dir="ltr" />
        </label>
      </div>
      {error && <p role="alert" className="px-1 text-[13px] text-[#ff3b30]">{error}</p>}
      <button type="submit" disabled={busy || code.length !== 4 || password.length < 8} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white disabled:bg-[#c7c7cc]" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {busy ? 'لحظات…' : 'إنشاء حسابي والدخول'}
      </button>
      <button type="button" disabled={wait > 0} onClick={() => void send()} className="block w-full text-center text-[15px] text-[#0a84ff] disabled:text-[#8e8e93]">
        {wait > 0 ? `إعادة إرسال الرمز بعد ${wait} ث` : 'إعادة إرسال الرمز'}
      </button>
      <p className="text-center text-xs leading-5 text-[#8e8e93]">إن غادرت الآن، تستطيع إكمال هذه الخطوة لاحقًا من الرابط الآمن في بريدك.</p>
    </form>
  );
}

// B2B-05: first entry — the customer creates their own password.
export function Welcome() {
  const { token } = useParams();
  const [info, setInfo] = useState<{ email: string; username: string } | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  const onSuccess = useAuthSuccess();

  useEffect(() => {
    partnerCall('welcome.view', { token })
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : 'الرابط غير صالح.'));
  }, [token]);

  if (error) {
    return (
      <Shell title="إنشاء كلمة المرور">
        <ErrorNote message={error} />
        <Link to="/reset-password" className="block text-center text-sm font-semibold text-emerald-700 hover:underline">
          نسيت كلمة المرور
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={`مرحبًا بك في ${BRAND_NAME}`}>
      {info && (
        <>
          <p className="text-sm text-gray-700">
            صفحتك <span dir="ltr" className="font-semibold">{info.username}.{ROOT_DOMAIN}</span> جاهزة. هذا الحساب مستقل وملكك وحدك: الشريك الذي
            سجّلك لا يملك كلمة مرورك ولا يستطيع الدخول أو التعديل.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => onSuccess(await partnerCall('welcome.setPassword', { token, password })));
            }}
          >
            <Field label="بريد الدخول">
              <input value={info.email} readOnly className={`${inputClass} bg-gray-50`} dir="ltr" />
            </Field>
            <Field label="كلمة المرور (8 أحرف على الأقل)">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} dir="ltr" autoComplete="new-password" autoFocus />
            </Field>
            <ErrorNote message={action.error} />
            <Button tone="primary" type="submit" className="w-full" disabled={action.busy || password.length < 8}>
              حفظ كلمة المرور والدخول
            </Button>
          </form>
        </>
      )}
    </Shell>
  );
}
