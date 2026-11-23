import { ArrowLeft, BarChart3, ContactRound, CreditCard, Link2, Loader2, Mail, MessageCircle, QrCode, Share2, UserRound, WalletCards } from 'lucide-react';

const UNLOCKS = [
  { label: 'إدارة رابط صفحتك', Icon: Link2 },
  { label: 'إدارة اشتراكك', Icon: CreditCard },
  { label: 'متابعة زيارات صفحتك', Icon: BarChart3 },
  { label: 'تعديل بياناتك الشخصية', Icon: UserRound },
  { label: 'إدارة البريد وتسجيل الدخول', Icon: Mail },
  { label: 'التواصل مع الإدارة', Icon: MessageCircle },
];

const SHARING = [
  { label: 'نسخ رابط صفحتك ومشاركته', Icon: Share2 },
  { label: 'تحميل رمز QR لصفحتك', Icon: QrCode },
  { label: 'إضافة بطاقتك إلى Apple Wallet', Icon: WalletCards },
  { label: 'إضافة بطاقتك إلى Google Wallet', Icon: WalletCards },
  { label: 'حفظ جهة الاتصال', Icon: ContactRound },
];

export function PrelaunchTools({ kind, needsSave, busy, disabled, onContinue }: { kind: 'sharing' | 'settings'; needsSave: boolean; busy: boolean; disabled: boolean; onContinue: () => void }) {
  return <div className="prelaunch-tools" dir="rtl">
    <div className="prelaunch-tools__intro">
      <p>{kind === 'sharing' ? 'أدوات المشاركة تتفعّل بعد إكمال الحساب وإطلاق الصفحة.' : 'إعدادات حسابك تتفعّل بعد إكمال الحساب وإطلاق الصفحة.'} {needsSave ? 'احفظ تصميمك وتابع لإكمال الإطلاق.' : 'تصميمك جاهز للخطوة التالية.'}</p>
      <button type="button" className="inline-editor__complete-account" disabled={disabled || busy} onClick={onContinue}>{busy ? <><Loader2 size={18} className="animate-spin" />جارٍ الحفظ والمتابعة…</> : <>{needsSave ? 'حفظ والمتابعة' : 'التالي لإكمال الإطلاق'}<ArrowLeft size={18} /></>}</button>
    </div>
    <section className="prelaunch-tools__unlocks" aria-label="ما يتاح بعد الإطلاق">
      <h3>بعد الإطلاق تقدر من هنا</h3>
      <ul>{(kind === 'sharing' ? SHARING : UNLOCKS).map(({ label, Icon }) => <li key={label}><Icon size={19} aria-hidden="true" />{label}</li>)}</ul>
    </section>
  </div>;
}
