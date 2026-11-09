import { useEffect, useState } from 'react';
import { QuoteReceivedNotice } from '../components/QuoteReceivedNotice';
import { Navigate, useNavigate, useLocation } from 'react-router';
import Builder, { EditorConfig } from './Builder';
import { nonprofitPath } from '../lib/nonprofit';
import { onboardingPending } from '../lib/nonprofitOnboarding';
import { usePageContext } from '../context/PageContext';

// Nonprofit editor (note 14): its own sections and tools on top of the shared
// editor core (saving, preview, drafts). Changing this config never touches the
// general editor. The section list is still under study — it mirrors the
// current sections until the nonprofit sections are approved.
export const nonprofitEditorConfig: EditorConfig = {
  sections: ['header', 'links', 'style', 'wallpaper', 'sharing'],
  labels: {},
  // Note 10: wide logos can shrink below the frame and stay whole.
  logoZoomOut: true,
  // Note 21: «شعار عادي» / «شعار مع بنر».
  logoBanner: true,
};

export function NonprofitBuilderPage({ gate: Gate }: { gate: React.ComponentType<{ children: React.ReactNode }> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [receipt, setReceipt] = useState<{ requestNumber?: number } | null>(() => location.state?.quoteReceived ?? null);
  useEffect(() => {
    if (!location.state?.quoteReceived) return;
    // Consume navigation feedback once; refreshing must not announce a new request.
    const { quoteReceived, ...state } = location.state;
    setReceipt(quoteReceived);
    navigate(location.pathname + location.search + location.hash, { replace: true, state });
  }, [location, navigate]);
  const { logout, account } = usePageContext();
  // Note 15: sign out, then the association's sign-in page. Saved work and an
  // unfinished setup stay with the account.
  const signOut = () => { logout(); navigate(nonprofitPath('login'), { replace: true }); };
  // Note 14: the editor opens once the first-time setup is finished.
  if (onboardingPending()) return <Navigate to={nonprofitPath('onboarding')} replace />;
  return (
    <Gate>
      <Builder
        editor={nonprofitEditorConfig}
        staffEdit={{ title: account?.pageStatus === 'published' ? 'محرر صفحة الجمعية' : 'تصميم الجمعية — مسودة خاصة', onExit: () => navigate(nonprofitPath()), onContinue: () => { if (!account?.pageStatus || account.pageStatus === 'draft') navigate(nonprofitPath('quote')); }, continueLabel: account?.pageStatus === 'draft' ? 'التالي: طلب عرض السعر' : account?.pageStatus === 'suspended' ? 'حفظ التعديلات — الصفحة موقوفة' : 'نشر التعديلات', exitLabel: 'العودة إلى صفحة الجمعيات', exitAsLogout: signOut }}
      />
      {receipt && <QuoteReceivedNotice requestNumber={receipt.requestNumber} onDismiss={() => setReceipt(null)} />}
    </Gate>
  );
}
