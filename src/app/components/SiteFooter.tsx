import { Link } from 'react-router';
import { OnwanLogo } from './OnwanLogo';
import { COMPANY_EMAIL, COMPANY_PHONE } from './NonprofitFooter';

// The general site's footer: who we are, how to reach us, and the policies a
// customer (and a payment provider) expects to find on every page.
// COMPANY_CR stays empty until the owner supplies the commercial registration.
export const COMPANY_CR = '';

export function SiteFooter() {
  const link = 'underline-offset-4 hover:text-[#111111] hover:underline';
  return (
    <footer className="border-t border-[#E7E7E7] bg-white" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm text-[#737373] sm:grid-cols-3 sm:px-6">
        <div className="space-y-3">
          <OnwanLogo />
          <p className="leading-7">صفحة رابط موحّد للأفراد والجهات، باشتراك شهري أو سنوي.</p>
          {COMPANY_CR && <p>السجل التجاري: <span dir="ltr">{COMPANY_CR}</span></p>}
        </div>
        <nav aria-label="السياسات" className="flex flex-col gap-2">
          <p className="font-bold text-[#111111]">السياسات</p>
          <Link to="/terms" className={link}>الشروط والأحكام</Link>
          <Link to="/privacy" className={link}>سياسة الخصوصية</Link>
          <Link to="/refund" className={link}>سياسة الإلغاء والاسترجاع</Link>
        </nav>
        <div className="flex flex-col gap-2">
          <p className="font-bold text-[#111111]">تواصل معنا</p>
          <a href={`tel:${COMPANY_PHONE}`} dir="ltr" className={`text-right ${link}`}>{COMPANY_PHONE}</a>
          <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className={`text-right ${link}`}>{COMPANY_EMAIL}</a>
          <Link to="/contact" className={link}>صفحة التواصل</Link>
        </div>
      </div>
      <p className="border-t border-[#E7E7E7] py-4 text-center text-xs text-[#737373]">© {new Date().getFullYear()} عنوان. جميع الحقوق محفوظة.</p>
    </footer>
  );
}
