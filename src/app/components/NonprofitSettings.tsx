import { useEffect, useState } from 'react';
import { BarChart3, ChevronRight, KeyRound, Link2, LogOut, Mail, MessageCircle, Palette, Smartphone, WalletCards } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { accountCall, fetchOwnWalletPass, nonprofitCall, sendSupportRequest } from '../lib/api';
import { pageHost } from '../lib/site';
import { quoteStatus } from '../lib/nonprofit';
import { AccountSecurity, CHANGE_LABELS, VisitsPage, useOverview, type Change } from './AccountServices';
import { EmailVerifyChip } from './EmailVerifyChip';
import { QRCodeDisplay } from './QRCodeDisplay';
import { ConfirmSheet, Group, Notice, PrimaryButton, SettingsRow } from './ios';

// Note 48: «الإعدادات» of the association's editor — its page and link, sharing
// (after activation), sign-in details, visits, contact with the administration
// and the design reset. The screens are the general editor's own, reused; plans,
// «صمّم لي» and NFC are left out on purpose (activation goes through the quote).

type Page = 'root' | 'visits' | 'support' | `change-${Change}`;

const PAGE_STATUS: Record<string, string> = { draft: 'مسودة — بانتظار التفعيل', published: 'منشورة', suspended: 'موقوفة من الإدارة' };

export function NonprofitSettings({ onLogout }: { onLogout: () => void }) {
  const { account, setAccount, pageData, updatePageData, resetDesign } = usePageContext();
  const { overview } = useOverview();
  const [page, setPage] = useState<Page>('root');
  const [toast, setToast] = useState('');
  const [quote, setQuote] = useState<{ request_number: number; status: string } | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  useEffect(() => { nonprofitCall().then((r) => setQuote(r.request ?? null)).catch(() => undefined); }, []);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(t); }, [toast]);
  if (!account) return null;
  const published = account.pageStatus === 'published';

  const back = (
    <button type="button" onClick={() => setPage('root')} className="flex h-10 items-center gap-1 text-[15px] text-[#0a84ff]"><ChevronRight className="h-5 w-5" />الإعدادات</button>
  );

  if (page.startsWith('change-')) {
    const change = page.slice(7) as Change;
    return <div className="space-y-4 p-5">{back}<AccountSecurity key={page} change={change} onAccount={setAccount} onDone={(text) => { setToast(text || `تم حفظ ${CHANGE_LABELS[change]}`); setPage('root'); }} /></div>;
  }
  if (page === 'visits') return <div className="space-y-4 p-5">{back}{overview && <VisitsPage overview={overview} />}</div>;
  if (page === 'support') {
    return (
      <div className="space-y-4 p-5">
        {back}
        <Group title="رسالتك للإدارة" footer="نرد عليك على بريد حسابك وجواله.">
          <div className="px-4 py-3"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} aria-label="رسالتك للإدارة" placeholder="اكتب استفسارك أو طلبك…" className="w-full resize-none bg-transparent text-[16px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" /></div>
        </Group>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <PrimaryButton busy={sending} disabled={!message.trim()} onClick={async () => {
          setSending(true);
          try { const r = await sendSupportRequest('message', message); setNotice({ tone: 'good', text: r.message }); setMessage(''); }
          catch (e) { setNotice({ tone: 'bad', text: e instanceof Error ? e.message : 'تعذر إرسال الرسالة.' }); }
          finally { setSending(false); }
        }}>إرسال</PrimaryButton>
      </div>
    );
  }

  // The owner's own Apple Wallet card, built and signed on the server even
  // before activation, so it can be added and tested now (iPhone opens it).
  const addToWallet = async () => {
    setWalletBusy(true);
    try {
      const blob = await fetchOwnWalletPass();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onwan-${pageData.username || 'card'}.pkpass`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'تعذّر إنشاء البطاقة.');
    } finally {
      setWalletBusy(false);
    }
  };

  const changeLink = async () => {
    setLinkBusy(true); setLinkMsg('');
    try { const r = await accountCall('name.change', { username: linkName }); setAccount(r.account); updatePageData({ username: r.username }); setLinkName(''); setLinkMsg('تم تغيير الرابط.'); }
    catch (e) { setLinkMsg(e instanceof Error ? e.message : 'تعذر تغيير الرابط.'); }
    finally { setLinkBusy(false); }
  };

  return (
    <div className="space-y-6 p-5" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {toast && <p role="status" className="rounded-xl bg-[#34c759]/10 px-4 py-2 text-sm font-bold text-[#1f8a3b]">{toast}</p>}

      <Group title="صفحتك">
        <SettingsRow icon={Link2} tone="bg-[#0a84ff]" label="الرابط" value={<span dir="ltr">{pageData.username ? pageHost(pageData.username) : '—'}</span>} />
        <SettingsRow icon={Link2} tone="bg-[#34c759]" label="الحالة" value={PAGE_STATUS[account.pageStatus] ?? account.pageStatus} />
        {quote && <SettingsRow icon={MessageCircle} tone="bg-[#ff9500]" label={`طلب عرض السعر #${quote.request_number}`} value={quoteStatus[quote.status] ?? quote.status} />}
        {!account.nameFixed && (
          <div className="space-y-2 px-4 py-3">
            <p className="text-xs text-[#6e6e73]">يمكن تغيير الرابط قبل اعتماده عند التفعيل.</p>
            <div className="flex items-center gap-2" dir="ltr">
              <input value={linkName} onChange={(e) => setLinkName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={30} placeholder="new-link" aria-label="الرابط الجديد" className="min-w-0 flex-1 rounded-xl bg-[#f2f2f7] px-3 py-2.5 text-[15px] focus:outline-none" />
              <button type="button" disabled={!linkName || linkBusy} onClick={changeLink} className="shrink-0 rounded-xl bg-[#0a84ff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{linkBusy ? '…' : 'تغيير'}</button>
            </div>
            {linkMsg && <p role="status" className="text-xs text-[#3a3a3c]">{linkMsg}</p>}
          </div>
        )}
      </Group>

      {/* QR follows activation; the Wallet card can be added any time. */}
      <Group title="المشاركة" footer={published ? undefined : 'رمز QR للصفحة يعمل بعد تفعيلها.'}>
        {published && <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]"><span>رمز QR للصفحة</span><QRCodeDisplay username={pageData.username} /></div>}
        <div className="space-y-2 px-4 py-3">
          <button type="button" disabled={!pageData.username || walletBusy} onClick={addToWallet} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#111111] text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50">
            <WalletCards className="h-5 w-5" />{walletBusy ? 'جارٍ التجهيز…' : 'إضافة إلى Apple Wallet'}
          </button>
          <p className="text-xs text-[#6e6e73]">بطاقة تعريف فيها اسم الجهة وشعار «عنوان» ورمز QR لصفحتها. افتحها من آيفون لإضافتها إلى المحفظة.</p>
        </div>
      </Group>

      <Group title="الحساب" footer="أي تغيير يحتاج رمزًا نرسله إلى بريدك المسجل.">
        <SettingsRow icon={Mail} tone="bg-[#0a84ff]" label="البريد الإلكتروني" value={<span dir="ltr">{account.email || '—'}</span>} onClick={() => setPage('change-email')} />
        {!account.emailVerified && <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-[#b45309]"><span>غير مؤكَّد — مطلوب لنشر الصفحة</span><EmailVerifyChip /></div>}
        <SettingsRow icon={Smartphone} tone="bg-[#34c759]" label="رقم الجوال" value={<span dir="ltr">{account.phone}</span>} onClick={() => setPage('change-phone')} />
        <SettingsRow icon={KeyRound} tone="bg-[#8e8e93]" label="كلمة المرور" value="••••••••" onClick={() => setPage('change-password')} />
      </Group>

      <Group title="الإحصاءات">
        <SettingsRow icon={BarChart3} tone="bg-[#ff9500]" label="زيارات الصفحة" value={overview ? `${overview.stats.last30.toLocaleString('ar-u-nu-latn')} هذا الشهر` : undefined} onClick={() => setPage('visits')} />
      </Group>

      <Group title="المساعدة">
        <SettingsRow icon={MessageCircle} tone="bg-[#34c759]" label="التواصل مع الإدارة" onClick={() => setPage('support')} />
      </Group>

      <Group title="التصميم" footer="يعيد الثيم والخلفية والأزرار والخط إلى الشكل الافتراضي، ولا يمس الاسم أو الوصف أو الشعار أو المحتوى.">
        <SettingsRow icon={Palette} tone="bg-[#ff2d55]" label="استعادة التصميم الافتراضي" onClick={() => setConfirmReset(true)} />
      </Group>

      <button type="button" onClick={onLogout} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-[#ff3b30] active:bg-[#f2f2f7]">
        <LogOut className="h-5 w-5" />تسجيل الخروج
      </button>

      {confirmReset && (
        <ConfirmSheet title="استعادة التصميم الافتراضي؟" message="يعود الشكل إلى الافتراضي، ويبقى المحتوى كما هو. يمكنك التراجع قبل الحفظ." confirmLabel="استعادة" cancelLabel="إلغاء" onConfirm={() => { resetDesign(); setConfirmReset(false); setToast('تمت استعادة التصميم الافتراضي'); }} onCancel={() => setConfirmReset(false)} />
      )}
    </div>
  );
}
