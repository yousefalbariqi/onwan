import { LegalLayout } from '../components/LegalLayout';
import { COMPANY_EMAIL, COMPANY_PHONE } from '../components/NonprofitFooter';

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
  return <LegalLayout {...PAGES[page]} kind="nonprofit" />;
}
