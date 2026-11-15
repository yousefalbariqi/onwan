import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { journeyPath } from '../lib/journey';

// Both journeys leave preview only after the current design is safely saved.
export function PreviewContinue() {
  const { account, save, saving, hasPendingChanges } = usePageContext();
  const navigate = useNavigate();
  const continuing = useRef(false);
  const [error, setError] = useState('');
  if (account?.pageStatus !== 'draft') return null;
  const nonprofit = account.kind === 'nonprofit';
  const next = async () => {
    if (continuing.current || saving) return;
    continuing.current = true;
    try {
      setError('');
      await save();
      if (hasPendingChanges()) throw new Error('لديك تعديلات أحدث؛ احفظها قبل المتابعة.');
      navigate(nonprofit ? journeyPath('nonprofit', 'quote') : '/plan-selection');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'تعذر حفظ الصفحة. حاول مجددًا.');
    } finally { continuing.current = false; }
  };
  return <div dir="rtl" className="fixed inset-x-0 bottom-0 z-40 bg-[#F8F8F6]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur" style={{ fontFamily: 'Cairo, sans-serif' }}>
    {error && <p role="alert" className="mb-2 text-center text-sm text-red-700">{error}</p>}
    <button type="button" disabled={saving} onClick={next} className="mx-auto block min-h-12 w-full max-w-md rounded-full bg-[#FF6B2C] px-6 py-3 font-bold text-white disabled:opacity-60">{saving ? 'جارٍ الحفظ…' : nonprofit ? 'التالي: طلب عرض السعر' : 'التالي: اختيار الباقة والدفع'}</button>
  </div>;
}
