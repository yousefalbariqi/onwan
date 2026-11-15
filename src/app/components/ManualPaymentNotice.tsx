import { useEffect, useState } from 'react';
import { accountCall } from '../lib/api';
export function ManualPaymentNotice() {
  const [info, setInfo] = useState<{ state: string; manualPaymentUrl?: string; manualInvoiceUrl?: string } | null>(null);
  useEffect(() => { let live=true; accountCall<any>('checkout.status').then(value=>{if(live)setInfo(value);}).catch(()=>undefined);return()=>{live=false;}; }, []);
  if (info?.state !== 'published_pending_payment') return null;
  return <section className="rounded-2xl bg-white p-4 text-sm leading-7"><h3 className="font-bold">صفحتك منشورة — بانتظار السداد</h3><p className="text-gray-600">بنتواصل معك لإرسال فاتورة الاشتراك ورابط الدفع.</p><div className="flex flex-wrap gap-4 text-orange-700">{info.manualInvoiceUrl && <a href={info.manualInvoiceUrl} target="_blank" rel="noopener noreferrer">عرض الفاتورة</a>}{info.manualPaymentUrl && <a href={info.manualPaymentUrl} target="_blank" rel="noopener noreferrer">إكمال الدفع</a>}</div></section>;
}
