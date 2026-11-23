import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageProvider, usePageContext } from '../context/PageContext';
import { InlinePageEditor } from '../components/InlinePageEditor';
import { createGuestPageSource } from '../lib/creationDraftSource';
import Builder from './Builder';
import { customerEditorConfig } from './JourneyBuilder';

function TrialWorkspace() {
  const navigate = useNavigate();
  const [advanced, setAdvanced] = useState(false);
  const { pageData, savedDraftData, loadingPage, isAuthenticated } = usePageContext();
  const [error, setError] = useState('');
  if (!loadingPage && !isAuthenticated) return <main dir="rtl" className="grid min-h-screen content-center justify-items-center gap-4 bg-[#f8f8f6] p-6"><h1>تعذر فتح مسودة الصفحة</h1><p>اختر تصميمًا لبدء التجربة أو أعد المحاولة.</p><Link to="/signup?step=templates">العودة للتصاميم</Link></main>;
  return <>
    {advanced ? <><div className="bg-[#FFFFFF] p-2 text-center"><button type="button" onClick={() => { setAdvanced(false); setError(''); }} className="rounded-full border border-[#e5dfd1] px-5 py-2 text-sm">العودة للتحرير المباشر</button><button type="button" onClick={() => { if (pageData.editorForm || !savedDraftData || JSON.stringify(pageData) !== JSON.stringify(savedDraftData)) { setError('ارجع للمحرر واحفظ تعديلاتك أو ألغِها قبل المتابعة.'); return; } navigate('/signup?step=complete'); }} className="mx-2 rounded-full bg-[#ff6b2c] px-5 py-2 text-sm text-white">التالي</button>{error && <p role="alert" className="p-2 text-sm text-red-700">{error}</p>}</div><Builder editor={customerEditorConfig} staffEdit={{ title: 'تجربة تصميم صفحتك', onExit: () => setAdvanced(false) }} /></>
      : <InlinePageEditor localOnly onContinue={() => navigate('/signup?step=complete')} continueLabel="التالي" onAdvanced={() => setAdvanced(true)} onBack={() => navigate('/signup?step=templates')} />}
  </>;
}
export default function CreationTrialEditor() {
  const source = useMemo(createGuestPageSource, []);
  return <PageProvider source={source}><TrialWorkspace /></PageProvider>;
}
