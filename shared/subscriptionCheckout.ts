// Checkout presentation policy. Pricing and entitlement logic remain in the
// existing plans/account/cart services. No provider is configured yet.
export function subscriptionCheckoutPolicy(plans: { plan: string; priceSar: number | null; discountPercent: number | null }[]) {
  const annual = plans.find(item => item.plan === 'annual');
  const listPrice = annual?.priceSar ?? null;
  const total = listPrice !== null && Number.isFinite(listPrice) && listPrice >= 0
    ? Math.round(Math.max(0, listPrice - Math.round(listPrice * (annual?.discountPercent ?? 0)) / 100) * 100) / 100 : null;
  return {
    plan: 'annual' as const, currency: 'SAR' as const, months: 12,
    listPrice, total, monthlyEquivalent: total === null ? null : Math.round(total / 12 * 100) / 100,
    taxIncluded: true, renewal: 'automatic' as const, renewalEnabled: false,
    manualPublication: true, paymentConfigured: false, methods: [] as { id: string; label: string }[],
    features: [
      'إنشاء صفحة عنوان وتخصيصها بالكامل', 'تعديل محتوى الصفحة في أي وقت',
      'إضافة الروابط والصور والملفات ومقاطع الفيديو', 'استخدام القوالب والتصاميم المتاحة',
      'تخصيص الألوان والخطوط والخلفيات والأزرار', 'مشاركة الصفحة باستخدام رابطها الخاص',
      'معاينة الصفحة قبل النشر', 'اشتراك لمدة سنة كاملة',
    ],
  };
}
