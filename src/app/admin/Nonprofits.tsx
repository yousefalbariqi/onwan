import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, FileText, Loader2, Mail, MessageCircle, Pencil, Phone, Search, ShieldCheck, Users } from 'lucide-react';
import { adminCall } from './adminApi';
import { PageView } from '../components/PageView';
import { mergeWithDefaults } from '../context/PageContext';
import { quoteStatus } from '../lib/nonprofit';
import { adminLink, pageHost, pageUrl } from '../lib/site';
import { Badge, formatDate, PAGE_STATUS } from './ui';
import { NonprofitSummaryAssets } from '../components/NonprofitSummaryAssets';
import './nonprofits.css';

type Quote = { amount: number | string; months: number | string; includes: string; notes: string };
const stages = ['pending', 'contacted', 'quoted', 'paid', 'active'];
const stepTitle: Record<string, string> = { pending: 'طلب جديد', agreed: 'طلب جديد', contacted: 'تم التواصل — أرسل عرض السعر', quoted: 'تم إرسال العرض — بانتظار الدفع', paid: 'تم الدفع — انشر الصفحة', active: 'الصفحة منشورة' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const actions: Record<string, string> = { content: 'عدّل محتوى صفحة الجمعية', assign: 'استلم متابعة الطلب', update: 'حدّث المتابعة', quote: 'حفظ عرض السعر', sent: 'سجّل إرسال العرض', sendQuote: 'أرسل عرض السعر', payment: 'أكد التحويل', activate: 'فعّل الصفحة', suspend: 'أوقف الصفحة', reactivate: 'أعاد تشغيل الصفحة' };
const defaultQuote: Quote = { amount: 243, months: 12, includes: 'رابط صفحة الجمعية، استضافة، محرر الصفحة، رمز QR، Apple Wallet، التواصل والدعم', notes: '' };
const money = (value: unknown) => new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR' }).format(Number(value ?? 0));
const tone = (stage: string) => stage === 'active' ? 'green' : stage === 'cancelled' ? 'red' : stage === 'paid' || stage === 'quoted' ? 'amber' : 'gray';
function Status({ stage }: { stage: string }) { return <Badge tone={tone(stage)}>{quoteStatus[stage] || stage}</Badge>; }
function wa(phone: string) { const digits = phone.replace(/\D/g, ''); return `https://wa.me/${digits.startsWith('05') ? '966' + digits.slice(1) : digits}`; }

export function Nonprofits() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('nonprofit');
  const filter = params.get('status') || 'all';
  const query = params.get('q') || '';
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.get('page')) || 1)));
  const [search, setSearch] = useState(query);
  const [list, setList] = useState<any>({ requests: [], stats: [], total: 0 });
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote>(defaultQuote);
  const [payment, setPayment] = useState({ amount: '', reference: '', receivedAt: '' });
  const [username, setUsername] = useState('');
  const [snapshot, setSnapshot] = useState(false);
  const [confirm, setConfirm] = useState<null | 'cancelled' | 'suspend'>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('هذه الصفحة متوقفة مؤقتًا.');
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const mutation = useRef(false);
  const modal = useRef<HTMLElement>(null);
  const record = detail?.request;
  const adminWallet = useCallback(async () => (await adminCall('nonprofits.wallet', { id: selectedId })).url as string, [selectedId]);

  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.current) setConfirm(null);
      if (event.key !== 'Tab') return;
      const nodes = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]') || []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [confirm]);

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params); next.set('section', 'nonprofits');
    for (const [key, value] of Object.entries(changes)) value === null ? next.delete(key) : next.set(key, value);
    setParams(next);
  };
  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => {
    const id = ++generation.current;
    setLoading(true); setError(''); setDetail(null); setSnapshot(false); setConfirm(null);
    const request = selectedId ? adminCall('nonprofits.get', { id: selectedId }) : adminCall('nonprofits.list', { q: query, status: filter, page });
    request.then(data => {
      if (generation.current !== id) return;
      if (selectedId) {
        setDetail(data); setNotes(data.request.admin_notes || '');
        setQuote((['paid', 'active'].includes(data.request.status) ? data.request.sent_quote_json : data.request.quote_json) || data.request.sent_quote_json || defaultQuote);
        setUsername(data.request.fixed_username || data.pageData?.username || data.request.suggested_username || '');
        setPayment({ amount: String(data.request.sent_quote_json?.amount ?? ''), reference: '', receivedAt: today() });
      } else setList(data);
    }).catch(e => { if (generation.current === id) setError(e.message); })
      .finally(() => { if (generation.current === id) setLoading(false); });
  }, [selectedId, query, filter, page, refresh]);

  const run = async (action: string, fields: Record<string, unknown> = {}, done = 'تم حفظ الإجراء بنجاح.') => {
    if (!record || mutation.current) return false;
    mutation.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      await adminCall(`nonprofits.${action}`, { id: record.id, version: record.version, ...fields });
      setConfirm(null); setSuccess(done); setRefresh(value => value + 1);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { mutation.current = false; setBusy(false); }
  };
  // Saving and recording the quote as sent is one server step; the text is copied for manual delivery.
  const sendQuote = async () => {
    if (await run('sendQuote', { quote }, 'تم إرسال العرض. الخطوة التالية: تأكيد الدفع.')) {
      navigator.clipboard?.writeText(quoteText(quote)).then(() => setSuccess('تم إرسال العرض ونُسخ نصه لترسله للجمعية. الخطوة التالية: تأكيد الدفع.'), () => undefined);
    }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setSuccess('تم النسخ.'); }
    catch { setError('تعذّر النسخ. يمكنك تحديد النص ونسخه يدويًا.'); }
  };
  const quoteText = (saved: any) => `عرض سعر — ${record.organization_name}\nالقيمة: ${money(saved.amount)} — دفعة واحدة\nمدة الاشتراك: ${Number(saved.months) === 12 ? 'سنة كاملة (12 شهرًا)' : `${saved.months} شهرًا`}\nيشمل: ${saved.includes}${saved.notes ? '\n' + saved.notes : ''}\nالتفعيل بعد تأكيد التحويل.`;
  const quoteFields = <fieldset disabled={busy} className="np-fields">
    <div className="np-two"><label className="np-field">القيمة بالريال<input type="number" min="0" max="1000000" step="0.01" value={quote.amount} onChange={e => setQuote({ ...quote, amount: e.target.value })} /></label><label className="np-field">مدة الاستضافة بالأشهر<input type="number" min="1" max="120" step="1" value={quote.months} onChange={e => setQuote({ ...quote, months: e.target.value })} /></label></div>
    <details className="np-disclosure"><summary>الخدمات المشمولة والملاحظات</summary>
      <label className="np-field">الخدمات المشمولة<textarea rows={3} maxLength={4000} value={quote.includes} onChange={e => setQuote({ ...quote, includes: e.target.value })} /></label>
      <label className="np-field">ملاحظات العرض<textarea rows={2} maxLength={4000} value={quote.notes} onChange={e => setQuote({ ...quote, notes: e.target.value })} /></label>
    </details>
  </fieldset>;
  const toast =<>{error && <div role="alert" className="np-alert np-alert-error">{error}<button type="button" onClick={() => setRefresh(value => value + 1)}>تحديث البيانات</button></div>}{success && <p role="status" className="np-alert np-alert-success"><Check size={16} />{success}</p>}</>;

  return <div className="np-admin" aria-busy={loading || busy}>
    {selectedId ? <>
      <button className="np-back" disabled={busy} onClick={() => { setSuccess(''); navigate({ nonprofit: null }); }}><ArrowRight size={17} />كل الجمعيات</button>
      {toast}
      {loading ? <Loading /> : record ? <>
        <header className="np-heading">
          <div><p className="np-eyebrow">ملف الجمعية · طلب #{record.request_number}</p><h1>{record.organization_name}</h1><div className="np-header-badges"><Status stage={record.status} /><Badge tone={record.page_status === 'published' ? 'green' : 'gray'}>{PAGE_STATUS[record.page_status]}</Badge>{record.account_status !== 'active' && <Badge tone="red">الحساب محظور</Badge>}</div></div>
          <Link className="np-button np-primary" to={`${adminLink(`edit/${record.user_id}`)}?${new URLSearchParams({ nonprofit: record.id, q: query, status: filter, page: String(page) })}`}><Pencil size={16} />تعديل صفحة الجمعية</Link>
        </header>
        <ol className="np-progress" aria-label="مراحل الطلب">{stages.map((stage, index) => {
          const position = stages.indexOf(record.status === 'agreed' ? 'contacted' : record.status);
          return <li key={stage} className={index <= position ? 'np-reached' : ''} aria-current={stage === record.status ? 'step' : undefined}><span>{index < position ? <Check size={14} /> : index + 1}</span>{quoteStatus[stage]}</li>;
        })}</ol>
        <div className="np-detail-grid">
          <div className="np-workspace">
            <section className="np-card np-step"><p className="np-eyebrow">المرحلة الحالية</p><h2>{stepTitle[record.status] || quoteStatus[record.status]}</h2>
              {['pending', 'agreed'].includes(record.status) && <>
                <p className="np-muted">تواصل مع {record.contact_name} ثم سجّل ذلك للانتقال إلى عرض السعر.</p>
                <div className="np-toolbar"><a className="np-button" href={`tel:${record.phone}`}><Phone size={15} />اتصال</a><a className="np-button" href={wa(record.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} />واتساب</a><button className="np-button np-primary" disabled={busy} onClick={() => run('update', { status: 'contacted', adminNotes: notes }, 'تم تسجيل التواصل. الخطوة التالية: عرض السعر.')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}تم التواصل</button></div>
              </>}
              {record.status === 'contacted' && <>
                {quoteFields}
                <p className="np-muted">يُحفظ العرض ويُنسخ نصه لترسله للجمعية بنفسك؛ النظام لا يرسل رسالة.</p>
                <button className="np-button np-primary" disabled={busy} onClick={sendQuote}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}إرسال عرض السعر</button>
              </>}
              {record.status === 'quoted' && <>
                <div className="np-saved-offer"><p>العرض المرسل: <strong>{money(record.sent_quote_json?.amount)}</strong> · {record.sent_quote_json?.months} شهرًا</p><button className="np-text-button" onClick={() => copy(quoteText(record.sent_quote_json))}>نسخ نص العرض</button></div>
                <div className="np-two"><label className="np-field">المبلغ المحصّل بالريال<input type="number" min="0" step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} /></label><label className="np-field">تاريخ التحويل<input type="date" value={payment.receivedAt} onChange={e => setPayment({ ...payment, receivedAt: e.target.value })} /></label></div>
                <label className="np-field">مرجع التحويل<input maxLength={500} value={payment.reference} onChange={e => setPayment({ ...payment, reference: e.target.value })} placeholder="مرجع البنك أو تفاصيل التحويل المؤكد" /></label>
                <button className="np-button np-primary" disabled={busy || !payment.reference.trim() || !payment.receivedAt} onClick={() => run('payment', payment, 'تم تأكيد الدفع. الخطوة التالية: نشر الصفحة.')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}تأكيد الدفع</button>
                <details className="np-disclosure"><summary>تعديل العرض وإعادة إرساله</summary>{quoteFields}<button className="np-button" disabled={busy} onClick={sendQuote}>إعادة إرسال العرض</button></details>
              </>}
              {record.status === 'paid' && <>
                <label className="np-field">رابط الصفحة<input dir="ltr" value={username} maxLength={30} onChange={e => setUsername(e.target.value.toLowerCase())} /><small dir="ltr">{pageHost(username || 'name')}</small></label>
                <p className="np-muted">تُنشر الصفحة للعامة وتبدأ استضافة {record.sent_quote_json?.months} شهرًا من الآن. يُفحص توفر الرابط عند النشر.</p>
                <button className="np-button np-primary" disabled={busy || !username} onClick={() => run('activate', { username }, 'تم نشر الصفحة.')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}نشر الصفحة</button>
              </>}
              {record.status === 'active' && <>
                <div className="np-toolbar"><Badge tone={record.page_status === 'published' ? 'green' : 'red'}>{PAGE_STATUS[record.page_status]}</Badge><span dir="ltr" className="np-muted">{pageHost(record.fixed_username)}</span></div>
                <p className="np-muted">الاستضافة حتى {formatDate(record.hosting_expires_at)}</p>
                <div className="np-toolbar"><a className="np-button np-primary" target="_blank" rel="noreferrer" href={pageUrl(record.fixed_username)}><ExternalLink size={15} />فتح الصفحة</a><button className="np-button" onClick={() => copy(pageUrl(record.fixed_username))}><Copy size={15} />نسخ الرابط</button></div>
              </>}
              {record.status === 'cancelled' && <p className="np-muted">أُلغي هذا الطلب.{record.admin_notes && <span className="np-note">{record.admin_notes}</span>}</p>}
            </section>
            <section className="np-card"><div className="np-card-title"><h2>بيانات الجمعية</h2><span className="np-muted">أنشئ {formatDate(record.created_at)}</span></div>
              <dl className="np-contact"><div><dt>مسؤول التواصل</dt><dd>{record.contact_name}</dd></div><div><dt>الجوال</dt><dd dir="ltr">{record.phone}</dd></div><div><dt>البريد</dt><dd dir="ltr">{record.email}</dd></div><div><dt>بريد الحساب</dt><dd>{record.email_verified_at ? 'مؤكد' : 'غير مؤكد'}</dd></div></dl>
              {record.notes && <p className="np-note">{record.notes}</p>}
            </section>
            <details className="np-card np-more"><summary>المزيد</summary>
              <div className="np-toolbar">
                <button className="np-button" onClick={() => copy(record.email)}><Mail size={15} />نسخ البريد</button>
                <button className="np-button" disabled={busy} onClick={() => run('assign')}>استلام المتابعة</button>
                {['pending', 'contacted', 'agreed', 'quoted'].includes(record.status) && <button className="np-button np-danger" disabled={busy} onClick={() => setConfirm('cancelled')}>إلغاء الطلب</button>}
                {record.activated_at && record.page_status === 'published' && <button className="np-button np-danger" disabled={busy || record.account_status !== 'active'} onClick={() => setConfirm('suspend')}>إيقاف الصفحة</button>}
                {record.activated_at && record.page_status === 'suspended' && <button className="np-button" disabled={busy || record.account_status !== 'active'} onClick={() => run('reactivate', {}, 'عادت الصفحة للعامة.')}>إعادة تفعيل الصفحة</button>}
                {record.email_status === 'failed' && <button className="np-button" disabled={busy} onClick={() => run('retryEmail')}>إعادة إشعار الإدارة بالبريد</button>}
              </div>
              <p className="np-muted">الموظف المتابع: {record.assigned_staff_name || 'لم يُعيّن بعد'}</p>
              <label className="np-field">ملاحظات داخلية<textarea rows={3} maxLength={8000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="نتيجة التواصل، احتياج الجمعية، والخطوة القادمة…" /></label>
              <button className="np-button" disabled={busy} onClick={() => run('update', { adminNotes: notes })}>حفظ الملاحظات</button>
              {record.quote_sent_at && <details className="np-disclosure"><summary>آخر عرض مسجل كمرسل · {formatDate(record.quote_sent_at)}</summary><p className="np-note">{quoteText(record.sent_quote_json)}</p></details>}
              {detail.payment && <div className="np-payment"><Check size={20} /><div><strong>تم تأكيد {money(detail.payment.amount)}</strong><p>المرجع: {detail.payment.reference}</p><p className="np-muted">بواسطة {detail.payment.recorded_by} · {formatDate(record.paid_at, true)}</p></div></div>}
              <h3 className="np-more-title"><Clock3 size={16} />سجل الإجراءات</h3>
              <ol className="np-timeline">{detail.events.map((entry: any, i: number) => <li key={i}><span className="np-timeline-dot" /><div><strong>{actions[entry.action] || entry.action}</strong><p>{entry.staff_name} · {formatDate(entry.created_at, true)}</p>{entry.details?.notes && <p className="np-note">{entry.details.notes}</p>}{entry.details?.reason && <p className="np-note">{entry.details.reason}</p>}</div></li>)}<li><span className="np-timeline-dot" /><div><strong>استلام طلب الجمعية</strong><p>{formatDate(record.created_at, true)}</p></div></li></ol>
            </details>
          </div>
          <aside className="np-preview-column"><section className="np-card"><div className="np-card-title"><h2>{snapshot ? 'التصميم المقدم مع الطلب' : 'أحدث تصميم محفوظ'}</h2></div><button className="np-text-button" onClick={() => setSnapshot(value => !value)}>{snapshot ? 'عرض أحدث تصميم' : 'عرض النسخة الأصلية للطلب'}</button><div className="np-page-preview"><PageView data={mergeWithDefaults(snapshot ? record.page_json : detail.pageData)} variant="preview" /></div><p className="np-muted">تعديل المحتوى يحفظ الصفحة الحالية، وتبقى نسخة الطلب الأصلية محفوظة.</p></section>{record.activated_at && <NonprofitSummaryAssets walletRequest={adminWallet} username={record.fixed_username} published={record.page_status === 'published'} />}</aside>
        </div>
      </> : null}
    </> : <>
      <header className="np-heading"><div><p className="np-eyebrow">إدارة العلاقات والتفعيل</p><h1>الجمعيات</h1><p className="np-muted">من أول تواصل إلى صفحة جاهزة للمشاركة.</p></div><span className="np-heading-icon"><Users size={26} /></span></header>
      <div className="np-stats">{[{ label: 'طلبات جديدة', states: ['pending'] }, { label: 'قيد المتابعة', states: ['contacted', 'agreed', 'quoted'] }, { label: 'جاهزة للتفعيل', states: ['paid'] }, { label: 'مفعّلة', states: ['active'] }].map(stat => <div key={stat.label}><span>{stat.label}</span><strong>{list.stats.filter((item: any) => stat.states.includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.count), 0)}</strong></div>)}</div>
      <form className="np-filters" onSubmit={e => { e.preventDefault(); navigate({ q: search || null, page: '1' }); }}><label className="np-search"><Search size={18} /><input aria-label="البحث في الجمعيات" placeholder="ابحث بالجمعية، المسؤول، الجوال أو رقم الطلب" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="حالة طلبات الجمعيات" value={filter} onChange={e => navigate({ status: e.target.value, page: '1' })}><option value="all">جميع الحالات</option>{Object.entries(quoteStatus).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="np-button np-primary" type="submit">بحث</button></form>
      {toast}
      {loading ? <Loading /> : error ? null : <section className="np-card np-list"><div className="np-card-title"><h2>طلبات الجمعيات</h2><span className="np-muted">{list.total} طلب</span></div>{list.requests.length ? <><div className="np-table-wrap"><table><thead><tr><th>الجمعية</th><th>المتابعة</th><th>حالة الطلب</th><th>الصفحة</th><th>العرض</th><th>آخر تحديث</th><th><span className="sr-only">فتح الملف</span></th></tr></thead><tbody>{list.requests.map((row: any) => <tr key={row.id}><td><strong>{row.organization_name}</strong><small>#{row.request_number} · {row.contact_name}</small><small dir="ltr">{row.phone}</small></td><td>{row.assigned_staff_name || 'غير مسند'}</td><td><Status stage={row.status} /></td><td><Badge tone={row.page_status === 'published' ? 'green' : 'gray'}>{PAGE_STATUS[row.page_status]}</Badge></td><td>{row.sent_quote_json || row.quote_json ? money((row.sent_quote_json || row.quote_json).amount) : '—'}</td><td>{formatDate(row.updated_at)}</td><td><button className="np-button np-small" onClick={() => navigate({ nonprofit: row.id })}>فتح الملف<ChevronLeft size={14} /></button></td></tr>)}</tbody></table></div><div className="np-mobile-list">{list.requests.map((row: any) => <button key={row.id} onClick={() => navigate({ nonprofit: row.id })}><span><strong>{row.organization_name}</strong><small>#{row.request_number} · {row.contact_name}</small><small>{row.assigned_staff_name || 'غير مسند'} · {formatDate(row.updated_at)}</small></span><Status stage={row.status} /></button>)}</div></> : <div className="np-empty"><FileText size={32} /><h3>{query || filter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات بعد'}</h3><p>ستظهر هنا طلبات الجمعيات عند إرسال طلب عرض السعر.</p></div>}<div className="np-pagination"><span>صفحة {page} من {Math.max(1, Math.ceil(list.total / 25))}</span><div><button aria-label="الصفحة السابقة" className="np-button np-small" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })}><ChevronRight size={16} /></button><button aria-label="الصفحة التالية" className="np-button np-small" disabled={page * 25 >= list.total} onClick={() => navigate({ page: String(page + 1) })}><ChevronLeft size={16} /></button></div></div></section>}
    </>}
    {confirm && record && <div className="np-modal-backdrop"><section ref={modal} tabIndex={-1} className="np-modal" role="dialog" aria-modal="true" aria-labelledby="np-confirm-title"><h2 id="np-confirm-title">{confirm === 'cancelled' ? 'إلغاء الطلب' : 'إيقاف الصفحة'}</h2>
      {confirm === 'cancelled' && <label className="np-field">سبب الإلغاء<textarea autoFocus rows={3} maxLength={8000} value={notes} onChange={e => setNotes(e.target.value)} /></label>}
      {confirm === 'suspend' && <><label className="np-field">سبب داخلي<textarea autoFocus rows={2} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><label className="np-field">رسالة للزائر<textarea rows={2} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} /></label></>}
      {error && <p role="alert" className="np-alert np-alert-error">{error}</p>}
      <div className="np-toolbar"><button className="np-button np-primary" disabled={busy} onClick={() => confirm === 'cancelled' ? run('update', { status: 'cancelled', adminNotes: notes }) : run('suspend', { reason, message })}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}تأكيد</button><button className="np-button" disabled={busy} onClick={() => setConfirm(null)}>رجوع</button></div>
    </section></div>}
  </div>;
}
function Loading() { return <div className="np-loading" role="status"><Loader2 size={22} className="animate-spin" />جارٍ تحميل بيانات الجمعيات…</div>; }
