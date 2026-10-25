import { useState } from 'react';
import { Check, MessageCircle, Palette, Sparkles, X } from 'lucide-react';
import { accountCall } from '../lib/api';
import { BRAND_NAME } from '../lib/site';
import { Notice, PrimaryButton } from './ios';

// Note 40: «صمّم لي» explains itself before anything is ordered — what the
// team does, the price, then one button. A page not yet published goes on to
// the registration cart (paid there with the plan); a subscribed page sends
// the request straight from the account. The server refuses a second open
// request, and the button cannot be pressed twice.
export function DesignServiceSheet({ priceSar, published, onClose, onToCart }: { priceSar: number | null; published: boolean; onClose: () => void; onToCart: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const request = async () => {
    if (!published) { onToCart(); return; }
    try {
      setBusy(true);
      setError('');
      setDone((await accountCall<{ message: string }>('design.request')).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الطلب. حاول مجددًا.');
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { Icon: MessageCircle, text: 'نتواصل معك عبر واتساب لنفهم جهتك وما تريد.' },
    { Icon: Palette, text: `يصمم فريق ${BRAND_NAME} صفحتك كاملة: الهوية والألوان والمحتوى.` },
    { Icon: Check, text: 'تعتمد التصميم، وتبقى صفحتك بين يديك تعدّلها متى شئت.' },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose} dir="rtl">
      <section role="dialog" aria-modal="true" aria-label="خدمة صمّم لي" onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#f2f2f7] pb-6 sm:rounded-[28px]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="flex justify-start px-5 pt-4">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3e3e8] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 px-5">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-l from-violet-600 via-fuchsia-500 to-orange-400 text-white shadow-[0_8px_20px_rgba(168,85,247,0.35)]"><Sparkles className="h-7 w-7" /></span>
            <h2 className="mt-3 text-2xl font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>صمّم لي</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">دع فريقنا يصمم صفحتك عنك، مرة واحدة.</p>
          </div>

          {done ? (
            <>
              <Notice tone="good">{done}</Notice>
              <PrimaryButton onClick={onClose}>تم</PrimaryButton>
            </>
          ) : (
            <>
              <ol className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">
                {steps.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#af52de]/12 text-[#8e3bb8]"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="pt-1 text-[15px] leading-6 text-[#1d1d1f]">{text}</span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5">
                <span className="text-[15px] text-[#1d1d1f]">التكلفة</span>
                <span className="text-lg font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{priceSar !== null ? `${priceSar} ريال` : 'تُعلن قريبًا'}</span>
              </div>
              {!published && <p className="px-1 text-xs leading-5 text-[#8e8e93]">تُضاف الخدمة إلى سلة التسجيل وتُدفع مع الاشتراك، ثم يبدأ الفريق.</p>}
              {error && <Notice tone="bad">{error}</Notice>}
              <PrimaryButton busy={busy} onClick={request}>اطلب التصميم</PrimaryButton>
              <button onClick={onClose} className="block w-full py-1 text-center text-[15px] text-[#0a84ff]">رجوع</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
