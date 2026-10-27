import { useNavigate } from 'react-router';
import Builder, { EditorConfig } from './Builder';
import { nonprofitPath } from '../lib/nonprofit';

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
  // Note 27: «الوثائق الرسمية» in «المحتوى» (never asked at signup).
  officialDocuments: true,
};

export function NonprofitBuilderPage({ gate: Gate }: { gate: React.ComponentType<{ children: React.ReactNode }> }) {
  const navigate = useNavigate();
  return (
    <Gate>
      <Builder
        editor={nonprofitEditorConfig}
        staffEdit={{ title: 'تصميم الجمعية — معاينة خاصة', onExit: () => navigate(nonprofitPath()), onContinue: () => navigate(nonprofitPath('quote')), continueLabel: 'التالي · طلب عرض سعر', exitLabel: 'العودة إلى صفحة الجمعيات' }}
      />
    </Gate>
  );
}
