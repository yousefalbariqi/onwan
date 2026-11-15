import { InlinePageEditor } from '../components/InlinePageEditor';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import Builder, { type EditorConfig } from './Builder';
import { usePageContext } from '../context/PageContext';
import { journeyPath, type JourneyKind } from '../lib/journey';
import { onboardingPending } from '../lib/journeyOnboarding';
import { QuoteReceivedNotice } from '../components/QuoteReceivedNotice';

export const customerEditorConfig: EditorConfig = {
  sections: ['header', 'links', 'style', 'wallpaper', 'sharing'],
  labels: {}, logoZoomOut: true, logoBanner: true,
};

export function JourneyBuilder({ kind }: { kind: JourneyKind }) {
  const navigate = useNavigate();
  const [advanced, setAdvanced] = useState(false);
  const location = useLocation();
  const { logout, account } = usePageContext();
  const [receipt, setReceipt] = useState<{ requestNumber?: number } | null>(() => location.state?.quoteReceived ?? null);
  useEffect(() => {
    if (!location.state?.quoteReceived) return;
    const { quoteReceived, ...state } = location.state;
    setReceipt(quoteReceived);
    navigate(location.pathname + location.search + location.hash, { replace: true, state });
  }, [location, navigate]);
  const path = (page = '') => journeyPath(kind, page);
  if (onboardingPending(kind)) return <Navigate to={path('onboarding')} replace />;
  const nonprofit = kind === 'nonprofit';
  return <>
    {!advanced ? <InlinePageEditor onAdvanced={() => setAdvanced(true)} onBack={() => navigate(path())} onContinue={() => { if (account?.pageStatus === 'draft') navigate(path('preview')); }} continueLabel={account?.pageStatus === 'draft' ? 'التالي: المعاينة' : account?.pageStatus === 'suspended' ? 'حفظ التعديلات' : 'نشر التعديلات'} /> : <>
    <div className="bg-[#fffefa] p-2 text-center"><button type="button" onClick={() => setAdvanced(false)} className="rounded-full border border-[#e5dfd1] px-5 py-2 text-sm">العودة للتحرير المباشر</button></div>
    <Builder editor={customerEditorConfig} workspace={{
      kind,
      title: account?.pageStatus === 'published' ? (nonprofit ? 'محرر صفحة الجمعية' : 'محرر صفحتك') : (nonprofit ? 'تصميم الجمعية — مسودة خاصة' : 'تصميم صفحتك — مسودة خاصة'),
      onExit: () => navigate(path()),
      onContinue: () => { if (account?.pageStatus === 'draft') navigate(path('preview')); },
      continueLabel: account?.pageStatus === 'draft' ? 'التالي: المعاينة' : account?.pageStatus === 'suspended' ? 'حفظ التعديلات — الصفحة موقوفة' : 'نشر التعديلات',
      exitLabel: 'العودة للرئيسية',
      exitAsLogout: () => { logout(); navigate(path('login'), { replace: true }); },
    }} /></>}
    {receipt && <QuoteReceivedNotice requestNumber={receipt.requestNumber} onDismiss={() => setReceipt(null)} />}
  </>;
}
