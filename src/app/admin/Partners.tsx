import { useCallback, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ROOT_DOMAIN } from '../lib/site';
import { StaffMember, adminCall } from './adminApi';
import { Badge, Button, Card, Empty, ErrorNote, Field, PLAN_NAMES, formatDate, inputClass, useAction, useLoad } from './ui';

const PARTNER_STATUS: Record<string, { label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = {
  pending: { label: 'بانتظار الموافقة', tone: 'amber' },
  active: { label: 'مفعّل', tone: 'green' },
  suspended: { label: 'موقوف', tone: 'gray' },
  violation: { label: 'موقوف لمخالفة', tone: 'red' },
  rejected: { label: 'مرفوض', tone: 'gray' },
};

const ORDER_STATUS: Record<string, string> = { awaiting_payment: 'بانتظار الدفع', completed: 'مكتمل', cancelled: 'ملغى' };

const money = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('en', { maximumFractionDigits: 2 })} ريال`);

function StatusBadge({ status }: { status: string }) {
  const info = PARTNER_STATUS[status] ?? { label: status, tone: 'gray' as const };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

// PERM-07: confirm a partner customer's payment. The result carries the
// customer's one-time set-password link, shown once.
function ConfirmPayment({ order, onDone }: { order: any; onDone: () => void }) {
  const [reference, setReference] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const action = useAction();

  if (setupLink) {
    return (
      <div className="mt-2 space-y-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
        <div className="font-bold">تم تأكيد الدفع ونُشرت الصفحة. رابط إنشاء كلمة المرور للعميل (يُعرض مرة واحدة):</div>
        <div className="break-all rounded bg-white p-2" dir="ltr">{setupLink}</div>
        <div className="flex gap-2">
          <Button className="!px-2 !py-1 !text-xs" onClick={() => navigator.clipboard.writeText(setupLink)}>نسخ</Button>
          <Button className="!px-2 !py-1 !text-xs" onClick={onDone}>تم</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مرجع الدفع" className={`${inputClass} min-w-0 flex-1`} />
      <Button
        tone="good"
        disabled={action.busy || reference.trim().length < 3}
        onClick={() =>
          action.run(async () => {
            const response = await adminCall('partnerOrders.confirmPayment', { id: order.id, reference });
            setSetupLink(response.setupLink);
          })
        }
      >
        تأكيد الدفع
      </Button>
      <Button
        disabled={action.busy}
        onClick={() => window.confirm(`إلغاء الطلب #${order.order_number}؟`) && action.run(async () => {
          await adminCall('partnerOrders.cancel', { id: order.id });
          onDone();
        })}
      >
        إلغاء
      </Button>
      <div className="w-full"><ErrorNote message={action.error} /></div>
    </div>
  );
}

function PartnerDetail({ id, staff, onBack, onOpenCustomer }: { id: string; staff: StaffMember; onBack: () => void; onOpenCustomer: (userId: string) => void }) {
  const load = useCallback(() => adminCall('partners.get', { id }), [id]);
  const { data, error, reload } = useLoad<any>(load);
  const action = useAction(reload);
  const isManager = staff.role === 'manager';
  const [reason, setReason] = useState('');
  const [prices, setPrices] = useState<{ monthly: string; annual: string } | null>(null);
  const [rate, setRate] = useState('');
  const [payout, setPayout] = useState({ amount: '', renewalsCount: '', note: '' });
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Empty>جاري التحميل...</Empty>;

  const { partner, totals } = data;
  const call = (name: string, params: Record<string, unknown> = {}) => action.run(() => adminCall(name, { id, ...params }));
  const priceForm = prices ?? { monthly: partner.price_monthly?.toString() ?? '', annual: partner.price_annual?.toString() ?? '' };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        كل الشركاء
      </button>
      <ErrorNote message={action.error} />

      <Card title={partner.shop_name} actions={<StatusBadge status={partner.status} />}>
        <div className="grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
          <div>المسؤول: {partner.contact_name}</div>
          <div>المدينة: {partner.city || '—'}</div>
          <div dir="ltr" className="text-right">{partner.email}</div>
          <div dir="ltr" className="text-right">{partner.phone}</div>
          <div>تاريخ الطلب: {formatDate(partner.created_at)}</div>
          {partner.status_reason && <div>السبب: {partner.status_reason}</div>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {partner.status === 'pending' && (
            <>
              <Button tone="good" disabled={action.busy} onClick={() => call('partners.approve')}>موافقة وتفعيل</Button>
              <Button disabled={action.busy} onClick={() => call('partners.reject', { reason })}>رفض</Button>
            </>
          )}
          {partner.status === 'rejected' && <Button tone="good" disabled={action.busy} onClick={() => call('partners.approve')}>موافقة وتفعيل</Button>}
          {['active', 'suspended'].includes(partner.status) && (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الإيقاف" className={`${inputClass} w-56`} />
              {partner.status === 'active' && (
                <Button disabled={action.busy || reason.trim().length < 3} onClick={() => call('partners.suspend', { reason })}>إيقاف عادي</Button>
              )}
              <Button tone="danger" disabled={action.busy || reason.trim().length < 3} onClick={() => call('partners.suspend', { reason, violation: true })}>
                إيقاف لمخالفة
              </Button>
            </>
          )}
          {partner.status === 'suspended' && <Button tone="good" disabled={action.busy} onClick={() => call('partners.reactivate')}>إعادة تفعيل</Button>}
          {partner.status === 'violation' && (
            <Button tone="good" disabled={action.busy || !isManager} onClick={() => call('partners.reactivate')}>
              إعادة تفعيل {isManager ? '' : '(للمدير فقط)'}
            </Button>
          )}
          {isManager && (
            <Button
              tone="danger"
              disabled={action.busy}
              onClick={async () => {
                const why = window.prompt('سبب حذف حساب الشريك؟ تبقى طلباته وبياناته المالية محفوظة.');
                if (why && (await call('partners.delete', { reason: why }))) onBack();
              }}
            >
              حذف الحساب
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">الإيقاف العادي يُبقي عمولة التجديد مستحقة؛ الإيقاف لمخالفة يوقف العمولات المستقبلية.</p>
      </Card>

      <Card title="السعر والعمولة">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="سعر الشريك — شهري (حد البيع الأدنى)">
            <input type="number" value={priceForm.monthly} onChange={(e) => setPrices({ ...priceForm, monthly: e.target.value })} className={inputClass} dir="ltr" disabled={!isManager} />
          </Field>
          <Field label="سعر الشريك — سنوي (حد البيع الأدنى)">
            <input type="number" value={priceForm.annual} onChange={(e) => setPrices({ ...priceForm, annual: e.target.value })} className={inputClass} dir="ltr" disabled={!isManager} />
          </Field>
          <div className="flex items-end">
            <Button tone="primary" disabled={action.busy || !isManager || !prices} onClick={async () => {
              if (await call('partners.setPrices', { priceMonthly: priceForm.monthly, priceAnnual: priceForm.annual })) setPrices(null);
            }}>
              حفظ الأسعار {isManager ? '' : '(للمدير فقط)'}
            </Button>
          </div>
          <Field label={`نسبة عمولة التجديد % (الحالية ${partner.renewal_rate})`}>
            <input type="number" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} dir="ltr" />
          </Field>
          <div className="flex items-end">
            <Button disabled={action.busy || rate === ''} onClick={async () => {
              if (await call('partners.setRate', { renewalRate: Number(rate) })) setRate('');
            }}>
              حفظ النسبة
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">ربح الشريك من الاشتراك الأول = سعر بيعه − سعره المحدد هنا. الشريك لا يستطيع البيع قبل تحديد سعره.</p>
      </Card>

      <Card title="الطلبات">
        {data.orders.length === 0 && <Empty>لا توجد طلبات.</Empty>}
        <ul className="divide-y divide-gray-100">
          {data.orders.map((order: any) => (
            <li key={order.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">#{order.order_number}</span>{' '}
                  {order.user_id ? (
                    <button onClick={() => onOpenCustomer(order.user_id)} className="font-semibold text-emerald-700 hover:underline">{order.customer_name}</button>
                  ) : (
                    order.customer_name
                  )}{' '}
                  <Badge tone={order.status === 'completed' ? 'green' : order.status === 'cancelled' ? 'gray' : 'amber'}>{ORDER_STATUS[order.status]}</Badge>
                </div>
                <span className="text-xs text-gray-500">
                  {PLAN_NAMES[order.plan]} · بيع {money(order.sale_price)} · سعر الشريك {money(order.partner_price)} · {formatDate(order.created_at)}
                </span>
              </div>
              <div className="text-xs text-gray-500" dir="ltr">
                {order.username}.{ROOT_DOMAIN} · {order.customer_email} · {order.customer_phone}
              </div>
              {order.status === 'awaiting_payment' && <ConfirmPayment order={order} onDone={reload} />}
            </li>
          ))}
        </ul>
      </Card>

      {isManager && totals && (
        <Card title="العمولات والصرف">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-gray-500">العملاء</div><div className="font-black">{totals.customers}</div></div>
            <div><div className="text-xs text-gray-500">المستحق</div><div className="font-black">{money(totals.earned)}</div></div>
            <div><div className="text-xs text-gray-500">المصروف</div><div className="font-black">{money(totals.paid)}</div></div>
            <div><div className="text-xs text-gray-500">المتبقي</div><div className="font-black">{money(totals.remaining)}</div></div>
          </div>

          <ul className="divide-y divide-gray-100 text-sm">
            {data.commissions.map((commission: any) => (
              <li key={commission.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {commission.kind === 'first' ? 'اشتراك أول' : `تجديد (${commission.rate}%)`} — #{commission.order_number} {commission.customer_name}
                  <span className="mr-2 text-xs text-gray-500">{formatDate(commission.created_at)}</span>
                </span>
                {commission.amount !== null ? (
                  <span className="font-semibold">{money(commission.amount)}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-amber-700">سعر العميل {money(commission.sale_price)} — أدخل قيمة العمولة</span>
                    <input
                      type="number"
                      value={amounts[commission.id] ?? ''}
                      onChange={(e) => setAmounts({ ...amounts, [commission.id]: e.target.value })}
                      className={`${inputClass} w-24`}
                      dir="ltr"
                    />
                    <Button
                      disabled={action.busy || !(Number(amounts[commission.id]) >= 0) || (amounts[commission.id] ?? '') === ''}
                      onClick={() => action.run(() => adminCall('partners.setCommissionAmount', { commissionId: commission.id, amount: Number(amounts[commission.id]) }))}
                    >
                      حفظ
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl bg-gray-50 p-4">
            <div className="mb-2 text-sm font-bold">تسجيل صرف (التحويل يتم خارج النظام)</div>
            <div className="grid gap-2 sm:grid-cols-[120px_140px_minmax(0,1fr)_auto]">
              <input type="number" placeholder="المبلغ" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} className={inputClass} dir="ltr" />
              <input type="number" placeholder="عدد التجديدات" value={payout.renewalsCount} onChange={(e) => setPayout({ ...payout, renewalsCount: e.target.value })} className={inputClass} dir="ltr" />
              <input placeholder="ملاحظة / مرجع التحويل" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} className={inputClass} />
              <Button tone="primary" disabled={action.busy || !(Number(payout.amount) > 0)} onClick={async () => {
                if (await call('partners.recordPayout', { amount: Number(payout.amount), renewalsCount: Number(payout.renewalsCount) || 0, note: payout.note })) {
                  setPayout({ amount: '', renewalsCount: '', note: '' });
                }
              }}>
                تسجيل
              </Button>
            </div>
            <ul className="mt-3 divide-y divide-gray-200 text-sm">
              {data.payouts.map((item: any) => (
                <li key={item.id} className="flex justify-between py-2">
                  <span>{money(item.amount)}{item.renewals_count > 0 && ` · ${item.renewals_count} تجديد`}{item.note && ` · ${item.note}`}</span>
                  <span className="text-xs text-gray-500">{item.recorded_by} · {formatDate(item.paid_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

export function Partners({ staff, onOpenCustomer }: { staff: StaffMember; onOpenCustomer: (userId: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(() => adminCall<{ partners: any[] }>('partners.list'), []);
  const { data, error, reload } = useLoad(load);
  const action = useAction(reload);
  const [form, setForm] = useState({ shopName: '', contactName: '', email: '', phone: '', city: '', password: '' });
  const [adding, setAdding] = useState(false);

  if (openId) {
    return (
      <PartnerDetail
        key={openId}
        id={openId}
        staff={staff}
        onBack={() => {
          setOpenId(null);
          reload();
        }}
        onOpenCustomer={onOpenCustomer}
      />
    );
  }

  return (
    <Card title="شركاء الطباعة" actions={<Button onClick={() => setAdding(!adding)}>{adding ? 'إغلاق' : 'إضافة شريك مباشرة'}</Button>}>
      <ErrorNote message={error || action.error} />

      {adding && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {([['shopName', 'اسم المحل'], ['contactName', 'اسم المسؤول'], ['city', 'المدينة'], ['phone', 'الجوال'], ['email', 'البريد'], ['password', 'كلمة المرور (8+)']] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type={key === 'password' ? 'password' : 'text'}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputClass}
                  dir={['phone', 'email', 'password'].includes(key) ? 'ltr' : undefined}
                />
              </Field>
            ))}
          </div>
          <Button tone="primary" className="mt-3" disabled={action.busy} onClick={async () => {
            if (await action.run(() => adminCall('partners.create', form))) {
              setForm({ shopName: '', contactName: '', email: '', phone: '', city: '', password: '' });
              setAdding(false);
            }
          }}>
            إضافة وتفعيل
          </Button>
        </div>
      )}

      {data?.partners.length === 0 && <Empty>لا يوجد شركاء بعد. صفحة طلب الشراكة: /partners</Empty>}
      <ul className="divide-y divide-gray-100">
        {data?.partners.map((partner) => (
          <li key={partner.id} onClick={() => setOpenId(partner.id)} className="flex cursor-pointer flex-wrap items-center justify-between gap-2 py-3 text-sm hover:bg-gray-50">
            <div>
              <span className="font-semibold">{partner.shop_name}</span> <StatusBadge status={partner.status} />
              <div className="text-xs text-gray-500">{partner.contact_name} · {partner.city || '—'}</div>
            </div>
            <div className="text-xs text-gray-600">
              {partner.customers} عميل
              {partner.awaiting > 0 && <span className="mr-2 font-semibold text-amber-700">{partner.awaiting} بانتظار الدفع</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
