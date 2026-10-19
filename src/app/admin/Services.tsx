import { useCallback, useState } from 'react';
import { ROOT_DOMAIN } from '../lib/site';
import { adminCall } from './adminApi';
import { Badge, Button, Card, Empty, ErrorNote, formatDate, inputClass, useAction, useLoad } from './ui';

type OpenCustomer = (userId: string) => void;

const money = (value: number | null) => (value === null ? '—' : `${value} ريال`);

function packageState(pkg: any): { label: string; tone: 'gray' | 'green' | 'amber' | 'red' } {
  if (pkg.status === 'pending_payment') return { label: 'بانتظار الدفع', tone: 'amber' };
  if (!pkg.design_approved_at) return { label: 'مدفوع — التصميم قيد التنفيذ', tone: 'red' };
  return { label: 'اكتملت باعتماد التصميم', tone: 'green' };
}

function DesignRow({ pkg, onOpen, onChanged }: { pkg: any; onOpen: OpenCustomer; onChanged: () => void }) {
  const [reference, setReference] = useState('');
  const action = useAction(onChanged);
  const state = packageState(pkg);
  const call = (name: string, params: Record<string, unknown> = {}) => action.run(() => adminCall(name, { id: pkg.id, ...params }));

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button onClick={() => onOpen(pkg.user_id)} className="font-semibold text-emerald-700 hover:underline" dir="ltr">
            {pkg.username ? `${pkg.username}.${ROOT_DOMAIN}` : pkg.email}
          </button>{' '}
          <Badge tone={state.tone}>{state.label}</Badge>
          <span className="mr-2 text-xs text-gray-500" dir="ltr">{pkg.phone}</span>
        </div>
        <span className="text-xs text-gray-500">
          طُلبت {formatDate(pkg.requested_at)}
          {pkg.design_approved_at && ` · اعتُمد التصميم ${formatDate(pkg.design_approved_at)}`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {pkg.status === 'pending_payment' && (
          <>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مرجع الدفع" className={`${inputClass} min-w-0 flex-1`} />
            <Button tone="good" disabled={action.busy || reference.trim().length < 3} onClick={() => call('design.confirmPayment', { reference })}>
              تأكيد الدفع
            </Button>
            <Button disabled={action.busy} onClick={() => window.confirm('إلغاء الطلب؟') && call('design.cancel')}>إلغاء</Button>
          </>
        )}
        {pkg.status === 'active' && !pkg.design_approved_at && (
          <Button tone="good" disabled={action.busy} onClick={() => window.confirm('تسجيل اعتماد العميل للتصميم؟ تنتهي الخدمة بهذا الاعتماد.') && call('design.approve')}>
            تسجيل اعتماد التصميم
          </Button>
        )}
      </div>
      <ErrorNote message={action.error} />
    </li>
  );
}

// DES-02 / NEW-06: the request is registered here; the design and its approval
// happen over WhatsApp, and recording the approval ends the service.
export function DesignService({ onOpen }: { onOpen: OpenCustomer }) {
  const load = useCallback(() => adminCall('design.list'), []);
  const { data, error, reload } = useLoad<any>(load);

  return (
    <Card title="خدمة «صمّم لي»">
      <ErrorNote message={error} />
      {data && <p className="mb-3 text-xs text-gray-500">سعر الخدمة: {money(data.designPriceSar)} (ثابت في إعداد النظام). خدمة لمرة واحدة تنتهي باعتماد التصميم.</p>}
      {data?.packages.length === 0 && <Empty>لا توجد طلبات.</Empty>}
      <ul className="divide-y divide-gray-100">
        {data?.packages.map((pkg: any) => (
          <DesignRow key={pkg.id} pkg={pkg} onOpen={onOpen} onChanged={reload} />
        ))}
      </ul>
    </Card>
  );
}

const NFC_STATUS: Record<string, { label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = {
  pending_payment: { label: 'بانتظار الدفع', tone: 'amber' },
  paid: { label: 'مدفوع — تواصل مع العميل', tone: 'red' },
  contacted: { label: 'تم التواصل — للشحن', tone: 'amber' },
  shipped: { label: 'تم الشحن', tone: 'green' },
  cancelled: { label: 'ملغى', tone: 'gray' },
};

function NfcRow({ order, onOpen, onChanged }: { order: any; onOpen: OpenCustomer; onChanged: () => void }) {
  const [input, setInput] = useState('');
  const action = useAction(onChanged);
  const call = (name: string, params: Record<string, unknown> = {}) => action.run(() => adminCall(name, { id: order.id, ...params }));

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold">#{order.order_number}</span> <Badge tone={NFC_STATUS[order.status].tone}>{NFC_STATUS[order.status].label}</Badge>{' '}
          {order.user_id && (
            <button onClick={() => onOpen(order.user_id)} className="text-xs font-semibold text-emerald-700 hover:underline">
              العميل
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {order.quantity} قطعة × {order.unit_price} + شحن {order.shipping_price} = <b>{order.total} ريال</b> · {formatDate(order.created_at)}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        المستلم: {order.recipient_name} · <span dir="ltr">{order.recipient_phone}</span> · {order.city} — {order.address}
      </div>
      <div className="text-xs text-gray-600">
        الرابط المبرمج على القطع: <span dir="ltr">{order.page_url}</span>
        {order.contact_note && ` · التواصل: ${order.contact_note}`}
        {order.shipping_note && ` · الشحن: ${order.shipping_note}`}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {order.status === 'pending_payment' && (
          <>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="مرجع الدفع" className={`${inputClass} min-w-0 flex-1`} />
            <Button tone="good" disabled={action.busy || input.trim().length < 3} onClick={() => call('nfc.confirmPayment', { reference: input })}>
              تأكيد الدفع
            </Button>
            <Button disabled={action.busy} onClick={() => window.confirm('إلغاء الطلب؟') && call('nfc.cancel')}>إلغاء</Button>
          </>
        )}
        {order.status === 'paid' && (
          <>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ما تم الاتفاق عليه مع العميل (العنوان، الموعد...)" className={`${inputClass} min-w-0 flex-1`} />
            <Button tone="primary" disabled={action.busy || input.trim().length < 3} onClick={async () => {
              if (await call('nfc.markContacted', { note: input })) setInput('');
            }}>
              تم التواصل مع العميل
            </Button>
          </>
        )}
        {order.status === 'contacted' && (
          <>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ملاحظة الشحن / رقم التتبع (اختياري)" className={`${inputClass} min-w-0 flex-1`} />
            <Button tone="primary" disabled={action.busy} onClick={() => call('nfc.ship', { note: input })}>تم التجهيز والشحن</Button>
          </>
        )}
      </div>
      <ErrorNote message={action.error} />
    </li>
  );
}

// NFC-03 / NEW-07: after payment the customer is contacted, then the
// administration prepares, programs and ships.
export function NfcOrders({ onOpen }: { onOpen: OpenCustomer }) {
  const load = useCallback(() => adminCall('nfc.list'), []);
  const { data, error, reload } = useLoad<any>(load);

  return (
    <Card title="طلبات NFC">
      <ErrorNote message={error} />
      {data?.orders.length === 0 && <Empty>لا توجد طلبات.</Empty>}
      <ul className="divide-y divide-gray-100">
        {data?.orders.map((order: any) => (
          <NfcRow key={order.id} order={order} onOpen={onOpen} onChanged={reload} />
        ))}
      </ul>
    </Card>
  );
}

const PAYMENT_KINDS: Record<string, string> = {
  subscription: 'اشتراكات مباشرة',
  partner_subscription: 'اشتراكات عبر الشركاء',
  design: '«صمّم لي»',
  nfc: 'قطع NFC',
  domain: 'دومين خاص',
};

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-black text-gray-900">{value}</div>
    </div>
  );
}

// PERM-14: comprehensive figures and revenue — manager only.
export function Reports() {
  const load = useCallback(() => adminCall('reports.summary'), []);
  const { data, error } = useLoad<any>(load);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Empty>جاري التحميل...</Empty>;

  const { counts, partners } = data;
  const totalRevenue = data.revenueByKind.reduce((sum: number, row: any) => sum + row.total, 0);

  return (
    <div className="space-y-4">
      <Card title="العملاء والصفحات">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="العملاء" value={counts.customers} />
          <Figure label="جدد آخر 30 يومًا" value={counts.new_customers_30d} />
          <Figure label="صفحات منشورة" value={counts.published} />
          <Figure label="لم تُنشر" value={counts.drafts} />
          <Figure label="اشتراك شهري فعّال" value={counts.active_monthly} />
          <Figure label="اشتراك سنوي فعّال" value={counts.active_annual} />
          <Figure label="اشتراك منتهٍ والصفحة ظاهرة" value={counts.overdue} />
          <Figure label="موقوفة / محظور" value={`${counts.suspended} / ${counts.banned}`} />
        </div>
      </Card>

      <Card title="بانتظار الإدارة">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="محتوى بانتظار المراجعة" value={counts.pending_reviews} />
          <Figure label="طلبات مفتوحة" value={counts.open_requests} />
          <Figure label="بلاغات لم تُعالج" value={counts.open_reports} />
          <Figure label="شركاء بانتظار الموافقة" value={partners.pending_partners} />
          <Figure label="سلال تسجيل بانتظار الدفع" value={counts.open_carts} />
        </div>
      </Card>

      <Card title="الإيرادات المسجّلة">
        <p className="mb-3 text-xs text-gray-500">مجموع المدفوعات التي أكّدها الموظفون في النظام، بالمبلغ المُدخل عند التأكيد.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="الإجمالي" value={money(totalRevenue)} />
          {Object.entries(PAYMENT_KINDS).map(([kind, label]) => {
            const row = data.revenueByKind.find((item: any) => item.kind === kind);
            return <Figure key={kind} label={`${label} (${row?.count ?? 0})`} value={money(row?.total ?? 0)} />;
          })}
        </div>
        {data.revenueByMonth.length > 0 && (
          <table className="mt-4 w-full text-right text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr><th className="py-2 font-semibold">الشهر</th><th className="py-2 font-semibold">عدد المدفوعات</th><th className="py-2 font-semibold">المبلغ</th></tr>
            </thead>
            <tbody>
              {data.revenueByMonth.map((row: any) => (
                <tr key={row.month} className="border-b border-gray-100">
                  <td className="py-2" dir="ltr">{row.month}</td>
                  <td className="py-2">{row.count}</td>
                  <td className="py-2 font-semibold">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="الشركاء والخدمات">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="شركاء مفعّلون" value={partners.active_partners} />
          <Figure label="عملاء عبر الشركاء" value={partners.partner_customers} />
          <Figure label="عمولات مستحقة" value={money(partners.commissions_earned)} />
          <Figure label="عمولات مصروفة" value={money(partners.commissions_paid)} />
          <Figure label="تجديدات لم تُحتسب قيمتها" value={partners.renewals_unpriced} />
          <Figure label="طلبات «صمّم لي» مدفوعة" value={counts.design_packages} />
          <Figure label="طلبات NFC مدفوعة" value={counts.nfc_orders} />
          <Figure label="قطع NFC" value={counts.nfc_pieces} />
        </div>
      </Card>
    </div>
  );
}

const SETTING_LABELS: Record<string, string> = {
  nfc_unit_price: 'سعر قطعة NFC (ريال)',
  nfc_shipping_price: 'رسوم شحن طلب NFC (ريال)',
  name_hold_days: 'مدة حجز اسم الرابط قبل الدفع (أيام)',
  custom_domain_price: 'رسوم خدمة الدومين الخاص (ريال)',
};

// Numbers the manager decides; unset until entered.
export function ServiceSettings({ isManager }: { isManager: boolean }) {
  const load = useCallback(() => adminCall('settings.get'), []);
  const { data, error, reload } = useLoad<any>(load);
  const action = useAction(reload);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Card title="إعدادات الخدمات">
      <ErrorNote message={error || action.error} />
      <ul className="divide-y divide-gray-100">
        {data &&
          Object.entries(SETTING_LABELS).map(([key, label]) => (
            <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="font-semibold">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">{data.settings[key] ?? (key === 'name_hold_days' ? 'لم تُحدد — الحجز يبقى حتى الدفع' : 'لم يُحدد بعد')}</span>
                {isManager && (
                  <>
                    <input type="number" min="0" value={drafts[key] ?? ''} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} placeholder="قيمة جديدة" className={`${inputClass} w-28`} dir="ltr" />
                    <Button
                      tone="primary"
                      disabled={action.busy || (drafts[key] ?? '') === ''}
                      onClick={async () => {
                        if (await action.run(() => adminCall('settings.set', { key, value: Number(drafts[key]) }))) setDrafts({ ...drafts, [key]: '' });
                      }}
                    >
                      حفظ
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        {data && (
          <li className="flex items-center justify-between py-3 text-sm">
            <span className="font-semibold">سعر باقة «صمّم لي»</span>
            <span className="text-gray-600">{data.designPriceSar === null ? 'لم يُحدد (DESIGN_SERVICE_PRICE_SAR)' : `${data.designPriceSar} ريال — ثابت في إعداد النظام`}</span>
          </li>
        )}
      </ul>
    </Card>
  );
}

const DOMAIN_STATUS: Record<string, { label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = {
  pending_payment: { label: 'بانتظار الدفع', tone: 'amber' },
  awaiting_dns: { label: 'بانتظار سجل DNS من العميل', tone: 'gray' },
  dns_verified: { label: 'تم التحقق — للتفعيل', tone: 'red' },
  active: { label: 'مفعّل', tone: 'green' },
};

function DomainRow({ item, hostingConfigured, onOpen, onChanged }: { item: any; hostingConfigured: boolean; onOpen: OpenCustomer; onChanged: () => void }) {
  const [reference, setReference] = useState('');
  const action = useAction(onChanged);
  const call = (name: string, params: Record<string, unknown> = {}) => action.run(() => adminCall(name, { id: item.id, ...params }));

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold" dir="ltr">{item.domain}</span> <Badge tone={DOMAIN_STATUS[item.status].tone}>{DOMAIN_STATUS[item.status].label}</Badge>{' '}
          <button onClick={() => onOpen(item.user_id)} className="text-xs font-semibold text-emerald-700 hover:underline" dir="ltr">
            {item.username}.{ROOT_DOMAIN}
          </button>
        </div>
        <span className="text-xs text-gray-500">{item.price} ريال · {formatDate(item.created_at)}</span>
      </div>
      {['awaiting_dns', 'dns_verified'].includes(item.status) && (
        <div className="mt-1 text-xs text-gray-600" dir="ltr" style={{ textAlign: 'right' }}>
          {item.instruction.type} {item.instruction.name} → {item.instruction.value}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {item.status === 'pending_payment' && (
          <>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مرجع الدفع" className={`${inputClass} min-w-0 flex-1`} />
            <Button tone="good" disabled={action.busy || reference.trim().length < 3} onClick={() => call('domains.confirmPayment', { reference })}>تأكيد الدفع</Button>
          </>
        )}
        {item.status === 'awaiting_dns' && <Button disabled={action.busy} onClick={() => call('domains.verify')}>فحص سجل DNS</Button>}
        {item.status === 'dns_verified' && (
          <Button
            tone="good"
            disabled={action.busy}
            onClick={() =>
              hostingConfigured
                ? call('domains.activate')
                : window.confirm(`هل أضفت ${item.domain} إلى الاستضافة وفعّلت شهادة HTTPS له؟ الصفحة لن تعمل على الدومين قبل ذلك.`) && call('domains.activate', { addedManually: true })
            }
          >
            تفعيل
          </Button>
        )}
        <Button
          disabled={action.busy}
          onClick={() => {
            const reason = window.prompt(`سبب إزالة ${item.domain}؟`);
            if (reason) call('domains.remove', { reason });
          }}
        >
          إزالة
        </Button>
      </div>
      <ErrorNote message={action.error} />
    </li>
  );
}

// DOMAIN-03: the entity's own domain — paid, proven by DNS, then activated.
export function CustomDomains({ onOpen }: { onOpen: OpenCustomer }) {
  const load = useCallback(() => adminCall('domains.list'), []);
  const { data, error, reload } = useLoad<any>(load);

  return (
    <Card title="الدومينات الخاصة">
      <ErrorNote message={error} />
      {data && !data.hostingConfigured && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          الربط الآلي بالاستضافة غير مهيأ. أضف الدومين إلى الاستضافة وفعّل شهادة HTTPS له قبل تأكيد التفعيل هنا.
        </p>
      )}
      {data?.domains.length === 0 && <Empty>لا توجد طلبات.</Empty>}
      <ul className="divide-y divide-gray-100">
        {data?.domains.map((item: any) => (
          <DomainRow key={item.id} item={item} hostingConfigured={data.hostingConfigured} onOpen={onOpen} onChanged={reload} />
        ))}
      </ul>
    </Card>
  );
}
