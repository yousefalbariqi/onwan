import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Flag, MessageCircle, Share2, UserPlus, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { PageData, mergeWithDefaults, usePageContext } from '../context/PageContext';
import { PageView } from '../components/PageView';
import { fetchPublicPage, reportPage } from '../lib/api';
import PartnerStorefront from '../partner/PartnerStorefront';
import { ROOT_DOMAIN, getCustomHost, getSubdomainUsername, pageUrl } from '../lib/site';
import { downloadVCard } from '../lib/vcard';

type Lang = 'ar' | 'en';

// Visitor-facing interface text (PUB-04). Page content itself comes from the
// entity's own Arabic text and its optional English version.
const TEXT = {
  ar: {
    saveContact: 'حفظ جهة الاتصال',
    share: 'مشاركة',
    whatsapp: 'واتساب',
    copy: 'نسخ الرابط',
    copied: 'تم النسخ',
    report: 'الإبلاغ عن الصفحة',
    reportPlaceholder: 'اكتب سبب البلاغ...',
    send: 'إرسال البلاغ',
    sending: 'جاري الإرسال...',
    close: 'إغلاق',
    switchTo: 'English',
  },
  en: {
    saveContact: 'Save contact',
    share: 'Share',
    whatsapp: 'WhatsApp',
    copy: 'Copy link',
    copied: 'Copied',
    report: 'Report this page',
    reportPlaceholder: 'Why are you reporting this page?',
    send: 'Send report',
    sending: 'Sending...',
    close: 'Close',
    switchTo: 'العربية',
  },
};

type RemoteState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'suspended'; message: string }
  | { status: 'partner'; partnerId: string }
  | { status: 'ready'; pageData: PageData };

// SEO-01: title and description are generated from the entity's name and
// description. (Set client-side; see the SSR note in CLAUDE.md.)
function usePageMeta(page: PageData | null) {
  useEffect(() => {
    if (!page) return;

    const previousTitle = document.title;
    document.title = page.name || page.username;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }

    const previousDescription = meta.content;
    meta.content = page.bio || page.name;

    return () => {
      document.title = previousTitle;
      meta.content = previousDescription;
    };
  }, [page]);
}

function ReportDialog({ username, lang, onClose }: { username: string; lang: Lang; onClose: () => void }) {
  const t = TEXT[lang];
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSend = async () => {
    try {
      setBusy(true);
      const response = await reportPage(username, message);
      setResult({ ok: true, text: response.message });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'تعذر إرسال البلاغ.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-2xl"
        style={{ fontFamily: 'Tajawal, sans-serif' }}
        dir={lang === 'en' ? 'ltr' : 'rtl'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {t.report}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100" aria-label={t.close}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {result?.ok ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{result.text}</p>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t.reportPlaceholder}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-start text-sm focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            {result && <p className="mt-2 text-sm text-red-600">{result.text}</p>}
            <button
              onClick={handleSend}
              disabled={busy || message.trim().length < 5}
              className="mt-4 w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {busy ? t.sending : t.send}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Visitor actions (SHARE-01, SHARE-02, PUB-03). No account, no QR download,
// and no «عنوان» branding on the entity's page (DEF-06, DEF-09).
function VisitorActions({ page, lang, onSwitchLang }: { page: PageData; lang: Lang; onSwitchLang?: () => void }) {
  const t = TEXT[lang];
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  // On the entity's own domain, that is the address visitors share.
  const url = getCustomHost() ? window.location.origin : pageUrl(page.username);
  const textColor = page.theme.textColor;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      // The visitor closing the share sheet rejects the promise; not an error.
      await navigator.share({ title: page.name, url }).catch(() => undefined);
      return;
    }

    await handleCopy();
  };

  const actionClass =
    'flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-all hover:scale-105 active:scale-95';
  const actionStyle = { color: textColor, borderColor: `${textColor}33` };

  return (
    <div className="mt-10 w-full">
      <div className="flex gap-2">
        <button onClick={() => downloadVCard(page)} className={actionClass} style={actionStyle}>
          <UserPlus className="h-5 w-5" />
          {t.saveContact}
        </button>
        <button onClick={handleShare} className={actionClass} style={actionStyle}>
          <Share2 className="h-5 w-5" />
          {t.share}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${page.name} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={actionClass}
          style={actionStyle}
        >
          <MessageCircle className="h-5 w-5" />
          {t.whatsapp}
        </a>
        <button onClick={handleCopy} className={actionClass} style={actionStyle}>
          {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          {copied ? t.copied : t.copy}
        </button>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        {onSwitchLang && (
          <button
            onClick={onSwitchLang}
            className="text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
            style={{ color: textColor }}
          >
            {t.switchTo}
          </button>
        )}
        <button
          onClick={() => setReporting(true)}
          className="inline-flex items-center gap-1 text-xs opacity-50 transition-opacity hover:opacity-100"
          style={{ color: textColor }}
        >
          <Flag className="h-3 w-3" />
          {t.report}
        </button>
        {/* Note 75: the owner's way in — sign-in and the editor live on the main site. */}
        <a href={`https://${ROOT_DOMAIN}/builder`} className="text-xs opacity-50 transition-opacity hover:opacity-100" style={{ color: textColor }}>
          {lang === 'en' ? 'Manage my page' : 'إدارة صفحتي'}
        </a>
      </div>

      {reporting && <ReportDialog username={page.username} lang={lang} onClose={() => setReporting(false)} />}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-3 text-2xl font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
          {title}
        </h1>
        <p className="text-gray-600 whitespace-pre-line" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {text}
        </p>
      </div>
    </div>
  );
}

export default function PublicPage() {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams();
  // name.onwan.link is the real address; /:name on the main domain is kept as
  // a fallback for local development and preview deployments.
  const username = routeUsername || getSubdomainUsername();
  // DOMAIN-03: on the entity's own domain the page is found by host. Only the
  // root path is the page; /preview there is still the editor's draft.
  const customHost = !username && window.location.pathname === '/' ? getCustomHost() : null;
  const { pageData } = usePageContext();
  const [remote, setRemote] = useState<RemoteState>({ status: 'loading' });
  // PAGE-16 / PUB-04: the device language when the page has that version,
  // otherwise Arabic; the visitor can switch by hand.
  const [chosenLang, setChosenLang] = useState<Lang | null>(null);

  useEffect(() => {
    if (!username && !customHost) return;

    let cancelled = false;
    setRemote({ status: 'loading' });

    fetchPublicPage(username ? { username } : { host: customHost as string })
      .then((response) => {
        if (cancelled) return;

        // Note 57: the address is a partner's own link.
        if (response.partnerStorefront) {
          setRemote({ status: 'partner', partnerId: response.partnerStorefront });
          return;
        }

        // DOMAIN-02: the old name forwards to the new one for 30 days.
        if (response.movedTo) {
          if (routeUsername) {
            navigate(`/${response.movedTo}`, { replace: true });
          } else {
            window.location.replace(pageUrl(response.movedTo));
          }
          return;
        }

        setRemote(
          response.suspended
            ? { status: 'suspended', message: response.message || '' }
            : { status: 'ready', pageData: mergeWithDefaults(response.pageData) },
        );
      })
      .catch(() => {
        if (!cancelled) setRemote({ status: 'not_found' });
      });

    return () => {
      cancelled = true;
    };
  }, [username, customHost, routeUsername, navigate]);

  usePageMeta((username || customHost) && remote.status === 'ready' ? remote.pageData : null);

  // /preview: the editor's unsaved draft, never the published page (PAGE-07).
  if (!username && !customHost) {
    return (
      <>
        <button
          onClick={() => navigate('/builder')}
          className="fixed top-4 right-4 z-10 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ArrowRight className="h-4 w-4" />
          العودة للتحرير
        </button>
        <PageView data={pageData} variant="public" />
      </>
    );
  }

  if (remote.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin"></div>
      </div>
    );
  }

  if (remote.status === 'partner') {
    return <PartnerStorefront partnerId={remote.partnerId} />;
  }

  if (remote.status === 'suspended') {
    return <Notice title="الصفحة متوقفة" text={remote.message} />;
  }

  if (remote.status === 'not_found') {
    return <Notice title="الصفحة غير موجودة" text="هذا الرابط غير مرتبط بصفحة منشورة حاليًا." />;
  }

  const english = remote.pageData.translations?.en;
  const hasEnglish = Boolean(english?.name || english?.bio);
  const lang: Lang = hasEnglish ? chosenLang ?? (navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ar') : 'ar';

  return (
    <PageView data={remote.pageData} variant="public" lang={lang}>
      <VisitorActions
        page={remote.pageData}
        lang={lang}
        onSwitchLang={hasEnglish ? () => setChosenLang(lang === 'en' ? 'ar' : 'en') : undefined}
      />
    </PageView>
  );
}
