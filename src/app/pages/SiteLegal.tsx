import { useEffect } from 'react';
import { Link } from 'react-router';
import { OnwanLogo } from '../components/OnwanLogo';
import { COMPANY_EMAIL, COMPANY_PHONE } from '../components/NonprofitFooter';
import { SiteFooter } from '../components/SiteFooter';
import { PUBLIC_PLAN_PRICES } from '../../../shared/planPrices';

// The general site's policy pages. DRAFT wording: the refund terms below are
// a proposal awaiting the owner's approval before they are relied on.
export type SitePage = 'terms' | 'privacy' | 'refund' | 'contact';

const contact = <>الجوال: <a href={`tel:${COMPANY_PHONE}`} dir="ltr" className="font-bold text-[#111111] underline underline-offset-4">{COMPANY_PHONE}</a> · البريد: <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className="font-bold text-[#111111] underline underline-offset-4">{COMPANY_EMAIL}</a></>;

const PAGES: Record<SitePage, { title: string; sections: { heading?: string; body: React.ReactNode }[] }> = {
  terms: {
    title: 'الشروط والأحكام',
    sections: [
      { body: 'باستخدامك «عنوان» توافق على هذه الشروط.' },
      { heading: 'الخدمة', body: '«عنوان» يتيح لك صفحة رابط موحّد على اسم تختاره، تضع فيها تعريفك وشعارك وروابطك وملفاتك وبيانات التواصل، وتشاركها برابط ورمز QR.' },
      { heading: 'الاشتراك والدفع', body: `تُنشر الصفحة باشتراك مدفوع مقدمًا: شهري بسعر ${PUBLIC_PLAN_PRICES.monthly} ريال، أو سنوي بسعر ${PUBLIC_PLAN_PRICES.annual} ريال. يتم الدفع إلكترونيًا عبر بوابة دفع آمنة، ويظهر المبلغ النهائي قبل تأكيد الدفع.` },
      { heading: 'الحساب', body: 'أنت مسؤول عن صحة بياناتك وعن سرية بيانات الدخول.' },
      { heading: 'المحتوى', body: 'المحتوى المنشور مسؤولية صاحب الصفحة، ويجب أن يكون نظاميًا. يحق لنا إيقاف أي صفحة تخالف الأنظمة أو هذه الشروط.' },
      { heading: 'التعديلات', body: 'قد نحدّث هذه الشروط عند الحاجة، ونبلغك بأي تغيير جوهري.' },
    ],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    sections: [
      { body: 'نجمع أقل قدر من البيانات اللازم لتقديم الخدمة.' },
      { heading: 'البيانات التي نجمعها', body: 'الاسم والبريد الإلكتروني ورقم الجوال، والمحتوى الذي تضيفه إلى صفحتك، وعدد زيارات الصفحة. بيانات البطاقة تُعالج لدى بوابة الدفع ولا نحتفظ بها.' },
      { heading: 'كيف نستخدمها', body: 'لتشغيل الحساب ونشر الصفحة والتواصل معك بشأن الخدمة وحماية المنصة. لا نبيع بياناتك لأي طرف.' },
      { heading: 'حقوقك', body: 'يمكنك طلب تعديل بياناتك أو حذف حسابك في أي وقت بالتواصل معنا.' },
    ],
  },
  refund: {
    title: 'سياسة الإلغاء والاسترجاع',
    sections: [
      { heading: 'الإلغاء', body: 'يمكنك إلغاء التجديد في أي وقت، وتبقى صفحتك منشورة حتى نهاية المدة المدفوعة.' },
      { heading: 'الاسترجاع', body: 'يمكنك طلب استرجاع كامل المبلغ خلال 7 أيام من الدفع إذا لم تُنشر صفحتك بعد. بعد النشر أو بعد مرور 7 أيام لا يُسترجع مبلغ المدة الجارية.' },
      { heading: 'طريقة الطلب', body: <>راسلنا من بريد حسابك مع رقم العملية. نرد خلال 3 أيام عمل، ويُعاد المبلغ إلى وسيلة الدفع نفسها خلال المدة التي يحددها البنك. {contact}</> },
    ],
  },
  contact: {
    title: 'تواصل معنا',
    sections: [{ body: 'يسعدنا تواصلك لأي استفسار عن «عنوان» أو اشتراكك.' }, { body: contact }],
  },
};

export default function SiteLegal({ page }: { page: SitePage }) {
  const content = PAGES[page];
  useEffect(() => {
    const previous = document.title;
    document.title = `${content.title} — عنوان`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [content.title]);
  return (
    <div dir="rtl" className="flex min-h-[100svh] flex-col bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
        <Link to="/" className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm hover:border-[#111111]">الرئيسية</Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-4 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{content.title}</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-[#737373]">
          {content.sections.map((section, index) => (
            <section key={index}>
              {section.heading && <h2 className="mb-1 text-lg font-bold text-[#111111]">{section.heading}</h2>}
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
