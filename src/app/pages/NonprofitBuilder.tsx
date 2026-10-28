import { Navigate, useNavigate } from 'react-router';
import Builder, { EditorConfig } from './Builder';
import { nonprofitPath } from '../lib/nonprofit';
import { onboardingPending } from '../lib/nonprofitOnboarding';
import { usePageContext } from '../context/PageContext';

// Nonprofit editor (note 14): its own sections and tools on top of the shared
// editor core (saving, preview, drafts). Changing this config never touches the
// general editor. The section list is still under study — it mirrors the
// current sections until the nonprofit sections are approved.
export const nonprofitEditorConfig: EditorConfig = {
  sections: ['header', 'links', 'style', 'wallpaper'],
  labels: {},
  // Note 10: wide logos can shrink below the frame and stay whole.
  logoZoomOut: true,
  // Note 21: «شعار عادي» / «شعار مع بنر».
  logoBanner: true,
};

export function NonprofitBuilderPage({ gate: Gate }: { gate: React.ComponentType<{ children: React.ReactNode }> }) {
  const navigate = useNavigate();
  const { logout } = usePageContext();
  // Note 15: sign out, then the association's sign-in page. Saved work and an
  // unfinished setup stay with the account.
  const signOut = () => { logout(); navigate(nonprofitPath('login'), { replace: true }); };
  // Note 14: the editor opens once the first-time setup is finished.
  if (onboardingPending()) return <Navigate to={nonprofitPath('onboarding')} replace />;
  return (
    <Gate>
      <Builder
        editor={nonprofitEditorConfig}
        staffEdit={{ title: 'تصميم الجمعية — معاينة خاصة', onExit: () => navigate(nonprofitPath()), onContinue: () => navigate(nonprofitPath('quote')), continueLabel: 'التالي · مراجعة طلب العرض', exitLabel: 'العودة إلى صفحة الجمعيات', exitAsLogout: signOut }}
      />
    </Gate>
  );
}
