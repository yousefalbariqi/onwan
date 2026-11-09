import { Check, X } from 'lucide-react';

export function QuoteReceivedNotice({ requestNumber, onDismiss }: { requestNumber?: number; onDismiss: () => void }) {
  return <aside dir="rtl" role="status" aria-live="polite" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] mx-auto max-w-md rounded-3xl border border-[#E7E7E7] bg-white p-5 shadow-[0_12px_48px_rgba(17,17,17,0.16)]" style={{ fontFamily: 'Cairo, sans-serif' }}>
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E8] text-[#FF6B2C]"><Check size={23} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-[#111111]">شكرًا لكم، وصل طلبكم</h2><p className="mt-1 text-sm leading-7 text-[#737373]">سنتواصل معكم قريبًا لاستكمال التفعيل.</p>{requestNumber != null && <p className="mt-1 text-xs text-[#737373]">رقم الطلب: {requestNumber}</p>}</div>
      <button type="button" onClick={onDismiss} aria-label="إغلاق رسالة الشكر" className="-ml-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#737373] hover:bg-[#F8F8F6]"><X size={18} /></button>
    </div>
    <button type="button" onClick={onDismiss} className="mt-4 min-h-11 w-full rounded-full bg-[#FF6B2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#F25A18]">متابعة تعديل الصفحة</button>
  </aside>;
}
