import { Link } from 'react-router';
import { nonprofitPath } from '../lib/nonprofit';

// Company footer of the nonprofit site: one quiet line under a hairline.
// The commercial registration number and the company website are added
// here once the owner provides them — never a placeholder value.
export const COMPANY_PHONE = '0557752723';
export const COMPANY_EMAIL = 'yousefalbariqi2@gmail.com';

// «بوارق التقنية» logo idea (two stacked colour blocks), in its own greens.
export function BawariqLogo() {
  return (
    <span className="inline-flex flex-col items-start text-[11px] font-bold leading-none" aria-label="بوارق التقنية" role="img">
      <span aria-hidden="true" className="bg-[#62CC90] px-1.5 pb-1 pt-0.5 text-[#0B1A12]">بوارق</span>
      <span aria-hidden="true" className="bg-[#B6E7C8] px-1.5 pb-1 pt-0.5 text-[#0B1A12]">التقنية</span>
    </span>
  );
}

const LINKS = [
  { path: 'privacy', label: 'الخصوصية' },
  { path: 'terms', label: 'الشروط والأحكام' },
  { path: 'reports', label: 'البلاغات والشكاوى' },
  { path: 'contact', label: 'تواصل معنا' },
];

const linkClass = 'inline-flex min-h-8 items-center hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B2C]';

export function NonprofitFooter() {
  return (
    <footer dir="rtl" className="mx-auto w-full max-w-6xl border-t border-[#E7E7E7] px-4 py-3 text-xs text-[#737373] sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-2.5">
          <BawariqLogo />
          <span>عنوان · منتج تابع لبوارق التقنية</span>
        </div>
        <nav aria-label="روابط الشركة" className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {LINKS.map((item) => <Link key={item.path} to={nonprofitPath(item.path)} className={linkClass}>{item.label}</Link>)}
          <a href={`tel:${COMPANY_PHONE}`} dir="ltr" className={linkClass}>{COMPANY_PHONE}</a>
          <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className={linkClass}>{COMPANY_EMAIL}</a>
        </nav>
      </div>
    </footer>
  );
}
