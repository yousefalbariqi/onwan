import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { usePageContext } from '../context/PageContext';

// Reserve the same space in every state so confirmation never shifts the tools.
export function AutoSaveStatus() {
  const { draftState, conflict, saveDraft } = usePageContext();
  const [confirmed, setConfirmed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (draftState !== 'saved' || conflict) { setConfirmed(false); return; }
    setConfirmed(true);
    const timer = window.setTimeout(() => setConfirmed(false), 2000);
    return () => window.clearTimeout(timer);
  }, [draftState, conflict]);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try { await saveDraft(); }
    catch { /* PageContext retains the draft and exposes the error state. */ }
    finally { setRetrying(false); }
  };

  return (
    <div className="flex h-10 w-44 shrink-0 items-center justify-center text-xs" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <span role="status" aria-live="polite" className="flex items-center justify-center gap-1.5 text-[#8e8e93]">
        {conflict ? <span className="text-amber-700">تعارض في النسخ</span>
          : draftState === 'limit' ? <span className="text-amber-700">وصلت للحد اليومي للحفظ</span>
          : draftState === 'error' ? <>
            <span className="text-amber-700">تعذّر الحفظ</span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => void retry()} disabled={retrying} className="font-semibold text-amber-700 underline underline-offset-4 disabled:opacity-50">إعادة المحاولة</button>
          </>
          : draftState === 'saved' && confirmed ? <>محفوظ <Check className="h-3.5 w-3.5" aria-hidden="true" /></> : null}
      </span>
    </div>
  );
}
