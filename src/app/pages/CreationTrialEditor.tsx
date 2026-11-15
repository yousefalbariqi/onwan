import { creationSession } from '../lib/creationCloud';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageProvider, usePageContext } from '../context/PageContext';
import { InlinePageEditor } from '../components/InlinePageEditor';
import { createGuestPageSource } from '../lib/creationDraftSource';
import Builder from './Builder';
import { customerEditorConfig } from './JourneyBuilder';

function TrialWorkspace() {
  const navigate = useNavigate();
  const [advanced, setAdvanced] = useState(false);
  const { pageData, loadingPage, isAuthenticated, saveDraft } = usePageContext();
  const [error, setError] = useState('');
  useEffect(() => {
    if (loadingPage || !isAuthenticated) return;
    const timer = window.setTimeout(() => { void saveDraft().catch(() => undefined); }, 650);
    return () => window.clearTimeout(timer);
  }, [pageData, loadingPage, isAuthenticated, saveDraft]);
  if (!loadingPage && !isAuthenticated) return <main dir="rtl" className="grid min-h-screen content-center justify-items-center gap-4 bg-[#f8f8f6] p-6"><h1>تعذر فتح مسودة الصفحة</h1><p>اختر تصميمًا لبدء التجربة أو أعد المحاولة.</p><Link to="/signup?step=templates">العودة للتصاميم</Link></main>;
  return <>
    {advanced ? <><div className="bg-[#fffefa] p-2 text-center"><button type="button" onClick={async () => { try { await saveDraft(); setAdvanced(false); setError(''); } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); } }} className="rounded-full border border-[#e5dfd1] px-5 py-2 text-sm">العودة للتحرير المباشر</button><button type="button" onClick={async () => { try { await saveDraft(); navigate('/signup?step=complete'); } catch (problem) { setError(problem instanceof Error ? problem.message : 'تعذر حفظ المسودة.'); } }} className="mx-2 rounded-full bg-[#ff6b2c] px-5 py-2 text-sm text-white">حفظ صفحتي</button>{error && <p role="alert" className="p-2 text-sm text-red-700">{error}</p>}</div><Builder editor={customerEditorConfig} staffEdit={{ title: 'تجربة تصميم صفحتك', onExit: () => setAdvanced(false) }} /></>
      : <InlinePageEditor localOnly savedLabel={creationSession() ? 'المسودة محفوظة ببريدك' : undefined} onContinue={() => navigate('/signup?step=complete')} continueLabel="حفظ صفحتي" onAdvanced={() => setAdvanced(true)} onBack={() => navigate('/signup?step=templates')} />}
  </>;
}
export default function CreationTrialEditor() {
  const source = useMemo(createGuestPageSource, []);
  return <PageProvider source={source}><TrialWorkspace /></PageProvider>;
}
