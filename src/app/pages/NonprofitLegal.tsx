import { Link } from 'react-router';
import { useEffect } from 'react';
import { nonprofitPath } from '../lib/nonprofit';
import { OnwanLogo } from '../components/OnwanLogo';
import { COMPANY_EMAIL, COMPANY_PHONE, NonprofitFooter } from '../components/NonprofitFooter';

// The footer's pages (privacy, terms, reports, contact): plain text in the
// «عنوان» brand colours. General wording until the owner supplies final text.
export type LegalPage = 'privacy' | 'terms' | 'reports' | 'contact';

const contactLine = (
  <>الجوال: <a href={`tel:${COMPANY_PHONE}`} dir="ltr" className="font-bold text-[#111111] underline underline-offset-4">{COMPANY_PHONE}</a> · البريد: <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className="font-bold text-[#111111] underline underline-offset-4">{COMPANY_EMAIL}</a></>
);

const PAGES: Record<LegalPage, { title: string; sections: { heading?: string; body: React.ReactNode }[] }> = {
  privacy: {
    title: 'سياسة الخصوصية',
    sections: [
      { body: 'نحترم خصوصيتكم، ونجمع أقل قدر من البيانات اللازم لتقديم خدمة «عنوان».' },
      { heading: 'البيانات التي نجمعها', body: 'بيانات الحساب مثل الاسم والبريد الإلكتروني ورقم الجوال، والمحتوى الذي تضيفونه إلى صفحة الجمعية، وعدد زيارات الصفحة.' },
      { heading: 'كيف نستخدمها', body: 'لتشغيل الحساب ونشر الصفحة، والتواصل معكم بشأن الخدمة، وحماية المنصة من إساءة الاستخدام. لا نبيع بياناتكم لأي طرف.' },
      { heading: 'حقوقكم', body: 'يمكنكم طلب تعديل بياناتكم أو حذف حسابكم في أي وقت بالتواصل معنا.' },
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    sections: [
      { body: 'باستخدامكم «عنوان» توافقون على هذه الشروط.' },
      { heading: 'الحساب', body: 'الجمعية مسؤولة عن صحة بياناتها وعن الحفاظ على سرية بيانات الدخول.' },
      { heading: 'المحتوى', body: 'المحتوى المنشور في صفحة الجمعية مسؤولية الجمعية، ويجب أن يكون نظاميًا وصحيحًا. يحق لنا إيقاف أي صفحة تخالف الأنظمة أو هذه الشروط.' },
      { heading: 'النشر والتفعيل', body: 'التصميم والمعاينة مجانيان، ويتم النشر بعد الاتفاق والتفعيل.' },
      { heading: 'التعديلات', body: 'قد نحدّث هذه الشروط عند الحاجة، ونبلغكم بأي تغيير جوهري.' },
    ],
  },
  reports: {
    title: 'البلاغات والشكاوى',
    sections: [
      { body: 'إذا لاحظتم محتوى مخالفًا في إحدى الصفحات، أو كانت لديكم شكوى على الخدمة، فراسلونا وسنراجعها في أقرب وقت.' },
      { heading: 'ما نحتاجه منكم', body: 'رابط الصفحة المعنية، ووصفًا مختصرًا للمشكلة، ووسيلة للتواصل معكم.' },
      { heading: 'وسائل التواصل', body: contactLine },
    ],
  },
  contact: {
    title: 'تواصل معنا',
    sections: [
      { body: 'يسعدنا تواصلكم لأي استفسار عن «عنوان» أو صفحة جمعيتكم.' },
      { body: contactLine },
    ],
  },
};

export default function NonprofitLegal({ page }: { page: LegalPage }) {
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
        <Link to={nonprofitPath()} aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
        <Link to={nonprofitPath()} className="inline-flex min-h-11 items-center rounded-full border border-[#E7E7E7] bg-white px-4 text-sm transition hover:border-[#111111]">الرئيسية</Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-4 sm:px-6">
        <h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{content.title}</h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-[#737373]">
          {content.sections.map((section, index) => (
            <section key={index}>
              {section.heading && <h2 className="mb-1 text-lg font-bold text-[#111111]">{section.heading}</h2>}
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <NonprofitFooter />
    </div>
  );
}
