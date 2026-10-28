import { useCallback, useState } from 'react';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { adminLink } from '../lib/site';
import { mergeWithDefaults } from '../context/PageContext';
import { PageView } from '../components/PageView';
import { ROOT_DOMAIN } from '../lib/site';
import { StaffMember, adminCall } from './adminApi';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  PAGE_STATUS,
  PLAN_NAMES,
  REQUEST_STATUS,
  REQUEST_TYPES,
  formatDate,
  inputClass,
  useAction,
  useLoad,
} from './ui';

const ACTION_LABELS: Record<string, string> = {
  'page.suspend': 'إيقاف الصفحة',
  'page.reactivate': 'إعادة تفعيل الصفحة',
  'user.ban': 'حظر الحساب',
  'user.unban': 'فك الحظر',
  'subscription.activate': 'تفعيل/تجديد اشتراك',
  'subdomain.change': 'تغيير الرابط',
  'content.removeLink': 'حذف زر',
  'content.clear': 'إزالة محتوى',
  'review.accepted': 'قبول محتوى',
  'review.rejected': 'رفض محتوى',
  'request.update': 'تحديث طلب',
  'partnerOrder.confirmPayment': 'تأكيد دفع طلب شريك',
  'content.save': 'تعديل الصفحة',
  'content.restoreLink': 'استعادة محتوى محذوف',
  'design.confirmPayment': 'تأكيد دفع «صمّم لي»',
  'design.approve': 'اعتماد تصميم «صمّم لي»',
  'cart.confirmPayment': 'تأكيد دفع سلة التسجيل',
};

// NEW-04: the registration cart is confirmed once, for everything in it.
function CartCard({ cart, onDone }: { cart: any; onDone: () => void }) {
  const [reference, setReference] = useState('');
  const action = useAction(onDone);

  return (
    <Card title={`سلة التسجيل #${cart.cart_number} — بانتظار الدفع`}>
      <Info label={`اشتراك ${PLAN_NAMES[cart.plan]}`}>
        {cart.plan_price} ريال
        {(cart.general_discount > 0 || cart.code_discount > 0) && (
          <span className="mr-2 text-xs font-normal text-gray-500">
            (السعر {cart.plan_list_price}
            {cart.general_discount > 0 && ` − خصم عام ${cart.general_discount}`}
            {cart.code_discount > 0 && ` − كود ${cart.discount_code} ${cart.code_discount}`})
          </span>
        )}
      </Info>
      {cart.design_price !== null && <Info label="«صمّم لي»">{cart.design_price} ريال</Info>}
      {cart.nfc_quantity > 0 && (
        <>
          <Info label={`قطع NFC × ${cart.nfc_quantity}`}>{cart.nfc_quantity * cart.nfc_unit_price} ريال + شحن {cart.nfc_shipping_price} ريال</Info>
          <Info label="الشحن إلى">
            {cart.nfc_recipient_name} · <span dir="ltr">{cart.nfc_recipient_phone}</span> · {cart.nfc_city} — {cart.nfc_address}
          </Info>
        </>
      )}
      {cart.custom_domain && (
        <Info label="دومين خاص">
          <span dir="ltr">{cart.custom_domain}</span> · {cart.domain_price} ريال
        </Info>
      )}
      <Info label="الإجمالي">{cart.total} ريال</Info>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مرجع الدفع أو ملاحظة السداد" className={`${inputClass} min-w-0 flex-1`} />
        <Button tone="good" disabled={action.busy || reference.trim().length < 3} onClick={() => action.run(() => adminCall('carts.confirmPayment', { id: cart.id, reference }))}>
          تأكيد دفع السلة كاملة
        </Button>
      </div>
      <ErrorNote message={action.error} />
      <p className="mt-2 text-xs text-gray-500">التأكيد يثبّت اسم الرابط وينشر الصفحة، ويفتح «صمّم لي» ويُدخل طلب NFC والدومين الخاص كمدفوعة إن كانت في السلة.</p>
    </Card>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-left font-semibold text-gray-900">{children}</span>
    </div>
  );
}

export function CustomerDetail({
  userId,
  staff,
  onBack,
}: {
  userId: string;
  staff: StaffMember;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const load = useCallback(() => adminCall('customers.get', { userId }), [userId]);
  // PERM-19: deleted content is the manager's to see and restore.
  const loadDeleted = useCallback(
    () => (staff.role === 'manager' ? adminCall('content.listDeleted', { userId }) : Promise.resolve({ deleted: [] })),
    [userId, staff.role],
  );
  const deleted = useLoad<any>(loadDeleted);
  const { data, error, reload } = useLoad<any>(load);
  const action = useAction(() => {
    reload();
    deleted.reload();
  });
  // Deleting leaves nothing to reload.
  const removal = useAction();
  const isManager = staff.role === 'manager';
  const canChangeSubdomain = isManager || staff.permissions.includes('change_subdomain');

  const [suspendMessage, setSuspendMessage] = useState('');
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState('annual');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [feePaid, setFeePaid] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  // Note 72: sign-in help; a temporary password is shown once and never stored here.
  const [identityChecked, setIdentityChecked] = useState(false);
  const [access, setAccess] = useState<{ kind: 'link'; emailed: boolean } | { kind: 'temp'; password: string } | null>(null);
  const accessAction = useAction();

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Empty>جاري التحميل...</Empty>;

  const { customer, pageData } = data;
  const call = (name: string, params: Record<string, unknown> = {}) =>
    action.run(() => adminCall(name, { userId, ...params }));
  const label = customer.username || customer.email || customer.phone;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        كل العملاء
      </button>

      <ErrorNote message={action.error || removal.error} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card title={pageData?.name || label}>
            <Info label="الرابط">
              <span dir="ltr">{customer.username ? `${customer.username}.${ROOT_DOMAIN}` : '—'}</span>{' '}
              {customer.username && !customer.name_fixed && (
                <Badge tone="amber">محجوز{customer.hold_expires_at ? ` حتى ${formatDate(customer.hold_expires_at)}` : ''} — يُثبَّت بالدفع</Badge>
              )}
            </Info>
            <Info label="البريد">
              <span dir="ltr">{customer.email || '—'}</span> {customer.email && !customer.email_verified_at && <Badge tone="amber">غير مؤكد</Badge>}
            </Info>
            <Info label="الجوال">
              <span dir="ltr">{customer.phone}</span>
            </Info>
            <Info label="تاريخ التسجيل">{formatDate(customer.created_at)}</Info>
            <Info label="حالة الصفحة">
              <Badge tone={customer.page_status === 'published' ? 'green' : customer.page_status === 'suspended' ? 'amber' : 'gray'}>
                {PAGE_STATUS[customer.page_status] ?? '—'}
              </Badge>
              {customer.page_status === 'suspended' && (
                <span className="mr-2 text-xs font-normal text-gray-500">منذ {customer.suspended_days} يومًا</span>
              )}
            </Info>
            {customer.page_status === 'suspended' && (
              <>
                <Info label="رسالة الزوار">{customer.suspension_message}</Info>
                <Info label="سبب الإيقاف (داخلي)">{customer.suspension_reason || '—'}</Info>
              </>
            )}
            {customer.account_status === 'banned' && (
              <Info label="الحساب">
                <Badge tone="red">محظور</Badge>
                <span className="mr-2 text-xs font-normal text-gray-600">{customer.ban_reason}</span>
              </Info>
            )}
          </Card>

          {data.cart && <CartCard cart={data.cart} onDone={reload} />}

          <Card title="الاشتراك">
            <Info label="النوع">{customer.plan ? PLAN_NAMES[customer.plan] : 'لا يوجد'}</Info>
            <Info label="تاريخ الانتهاء">
              {formatDate(customer.expires_at)}
              {customer.overdue_days !== null && (
                <span className="mr-2 text-xs text-red-600">متأخر {customer.overdue_days} يومًا</span>
              )}
            </Info>
            <Info label="مرجع آخر دفع">{customer.payment_reference || '—'}</Info>
            {customer.partner_shop && <Info label="سُجّل عبر الشريك">{customer.partner_shop}</Info>}
            {customer.custom_price && <Info label="سعر العميل المحفوظ للتجديد">{Number(customer.custom_price)} ريال</Info>}

            <div className="mt-4 grid gap-2 sm:grid-cols-[110px_120px_minmax(0,1fr)_auto]">
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
                <option value="annual">سنوي</option>
                <option value="monthly">شهري</option>
              </select>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="المبلغ المحصّل"
                className={inputClass}
                dir="ltr"
              />
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="مرجع الدفع أو ملاحظة السداد"
                className={inputClass}
              />
              <Button
                tone="good"
                disabled={action.busy || reference.trim().length < 3 || amount === ''}
                onClick={async () => {
                  if (await call('subscription.activate', { plan, reference, amount: Number(amount) })) {
                    setReference('');
                    setAmount('');
                  }
                }}
              >
                تفعيل / تجديد
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              يُستخدم بعد استلام المبلغ. ينشر الصفحة إن لم تُنشر من قبل، والصفحة الموقوفة تحتاج «إعادة تفعيل» مستقلة.
            </p>
          </Card>

          <Card title="إدارة الدخول">
            <p className="mb-3 text-sm text-gray-600">لمساعدة العميل على استعادة حسابه. لا يمكن عرض كلمة المرور الحالية، ولا تتغير ملكية الصفحة أو الاشتراك.</p>
            <label className="mb-3 flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={identityChecked} onChange={(e) => setIdentityChecked(e.target.checked)} />
              تحققت من هوية العميل (مثلًا بالتواصل من جواله المسجّل)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={accessAction.busy || !identityChecked} onClick={() => accessAction.run(async () => { const r = await adminCall('user.sendAccessLink', { userId, identityChecked: true }); setAccess({ kind: 'link', emailed: r.emailed }); })}>
                إرسال رابط تعيين كلمة المرور إلى بريده
              </Button>
              {isManager && (
                <Button tone="danger" disabled={accessAction.busy || !identityChecked} onClick={() => window.confirm('إنشاء كلمة مرور مؤقتة؟ تُعرض مرة واحدة، ويُلزم العميل بتغييرها عند الدخول.') && accessAction.run(async () => { const r = await adminCall('user.tempPassword', { userId, identityChecked: true }); setAccess({ kind: 'temp', password: r.password }); })}>
                  كلمة مرور مؤقتة (للمدير)
                </Button>
              )}
            </div>
            <ErrorNote message={accessAction.error} />
            {access?.kind === 'link' && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{access.emailed ? 'أُرسل الرابط إلى بريد العميل.' : 'تعذر إرسال البريد. حاول مجددًا لاحقًا.'}</p>}
            {access?.kind === 'temp' && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                كلمة المرور المؤقتة (تُعرض الآن فقط): <b dir="ltr" className="select-all font-mono">{access.password}</b>
                <p className="mt-1 text-xs">أبلغها للعميل بوسيلة آمنة. سيُطلب منه تغييرها فور دخوله.</p>
              </div>
            )}
          </Card>

          <Card title="الإيقاف والحظر">
            {customer.page_status === 'published' && (
              <div className="space-y-2">
                <Field label="الرسالة التي تظهر لزوار الصفحة">
                  <input value={suspendMessage} onChange={(e) => setSuspendMessage(e.target.value)} className={inputClass} placeholder="مثال: هذه الصفحة متوقفة مؤقتًا." />
                </Field>
                <Field label="السبب (داخلي، يُستخدم للإيقاف أو الحظر)">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
                </Field>
              </div>
            )}
            {customer.page_status !== 'published' && customer.account_status === 'active' && (
              <Field label="سبب الحظر">
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
              </Field>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {customer.page_status === 'published' && (
                <Button
                  disabled={action.busy || suspendMessage.trim().length < 3 || reason.trim().length < 3}
                  onClick={() => call('page.suspend', { message: suspendMessage, reason })}
                >
                  إيقاف الصفحة
                </Button>
              )}
              {customer.page_status === 'suspended' && (
                <Button tone="good" disabled={action.busy} onClick={() => call('page.reactivate')}>
                  إعادة تفعيل الصفحة
                </Button>
              )}
              {customer.account_status === 'active' ? (
                <Button
                  tone="danger"
                  disabled={action.busy || reason.trim().length < 3}
                  onClick={() => window.confirm('حظر الحساب بسبب مخالفة؟ يُمنع من الدخول وتختفي صفحته.') && call('user.ban', { reason })}
                >
                  حظر لمخالفة
                </Button>
              ) : (
                <Button disabled={action.busy || !isManager} onClick={() => call('user.unban')} title={isManager ? '' : 'للمدير فقط'}>
                  فك الحظر {isManager ? '' : '(للمدير فقط)'}
                </Button>
              )}
            </div>
          </Card>

          <Card title="تغيير رابط الصفحة">
            {!customer.name_fixed ? (
              <p className="text-sm text-gray-500">الاسم محجوز ولم يُثبَّت بعد؛ يغيّره العميل نفسه مجانًا قبل الدفع.</p>
            ) : canChangeSubdomain ? (
              <>
                <div className="flex items-center gap-2" dir="ltr">
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="new-name"
                    className={inputClass}
                  />
                  <span className="text-sm text-gray-500">.{ROOT_DOMAIN}</span>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={feePaid} onChange={(e) => setFeePaid(e.target.checked)} />
                  تم سداد رسوم تغيير الرابط
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  الرابط القديم يُحوَّل إلى الجديد 30 يومًا ثم يصبح متاحًا لغيره. نبّه العميل أن رموز QR المطبوعة بالرابط القديم ستتوقف.
                </p>
                <Button
                  className="mt-3"
                  disabled={action.busy || !newUsername || !feePaid}
                  onClick={async () => {
                    if (await call('subdomain.change', { username: newUsername, paymentConfirmed: feePaid })) {
                      setNewUsername('');
                      setFeePaid(false);
                    }
                  }}
                >
                  تنفيذ التغيير
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500">يحتاج هذا الإجراء تخويلًا من المدير.</p>
            )}
          </Card>

          <Card
            title="المحتوى"
            actions={
              <Button onClick={() => navigate(adminLink(`/edit/${userId}`))}>
                <Pencil className="ml-1 inline h-4 w-4" />
                تعديل الصفحة كاملة
              </Button>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {[
                ['name', 'إزالة الاسم'],
                ['bio', 'إزالة الوصف'],
                ['profileImage', 'إزالة الشعار'],
                ['wallpaper', 'إزالة صورة الخلفية'],
              ].map(([field, text]) => (
                <Button key={field} disabled={action.busy} onClick={() => window.confirm(`${text}؟`) && call('content.clear', { field })}>
                  {text}
                </Button>
              ))}
            </div>

            {pageData?.links?.length ? (
              <ul className="divide-y divide-gray-100">
                {pageData.links.map((link: any) => (
                  <li key={link.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {link.title} {link.hidden && <Badge>مخفي</Badge>}
                      </div>
                      {link.linkType === 'file' ? (
                        <a href={link.url} download={link.fileName || true} className="text-xs text-emerald-700 hover:underline">
                          ملف: {link.fileName || link.fileMimeType}
                        </a>
                      ) : (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-emerald-700 hover:underline" dir="ltr">
                          {link.url}
                        </a>
                      )}
                    </div>
                    <button
                      disabled={action.busy}
                      onClick={() => window.confirm(`حذف الزر «${link.title}» من صفحة العميل؟`) && call('content.removeLink', { linkId: link.id })}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="حذف الزر"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>لا توجد أزرار.</Empty>
            )}
          </Card>

          {isManager && deleted.data?.deleted.length > 0 && (
            <Card title="محتوى محذوف (للمدير)">
              <ul className="divide-y divide-gray-100 text-sm">
                {deleted.data.deleted.map((item: any) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{item.title}</div>
                      <div className="truncate text-xs text-gray-500" dir="ltr">{item.link_type === 'file' ? item.file_name || 'file' : item.url}</div>
                      <div className="text-xs text-gray-500">حذفه: {item.deleted_by} · {formatDate(item.deleted_at, true)}</div>
                    </div>
                    <Button disabled={action.busy} onClick={() => call('content.restoreLink', { id: item.id })}>
                      استعادة
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">العنصر المستعاد يعود مخفيًا في آخر القائمة حتى يُظهره العميل أو موظف.</p>
            </Card>
          )}

          {data.requests.length > 0 && (
            <Card title="طلبات العميل">
              <ul className="divide-y divide-gray-100 text-sm">
                {data.requests.map((request: any) => (
                  <li key={request.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{REQUEST_TYPES[request.type] ?? request.type}</span>
                      <span className="text-xs text-gray-500">
                        {REQUEST_STATUS[request.status]} · {formatDate(request.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-gray-600">{request.message}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="سجل الإجراءات على هذا العميل">
            {data.history.length ? (
              <ul className="divide-y divide-gray-100 text-sm">
                {data.history.map((entry: any, index: number) => (
                  <li key={index} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <span className="font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      {(entry.details?.reason || entry.details?.reference) && (
                        <span className="mr-2 text-gray-600">— {entry.details.reason || entry.details.reference}</span>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-gray-500">
                      {entry.staff_name} · {formatDate(entry.created_at, true)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>لا توجد إجراءات مسجلة.</Empty>
            )}
          </Card>

          {isManager && (
            <Card title="حذف نهائي">
              <p className="text-sm text-gray-600">
                يحذف الحساب والصفحة والملفات نهائيًا ويصبح الرابط متاحًا لغيره. لا يمكن التراجع.
                {customer.page_status === 'suspended' && customer.suspended_days < 20 && (
                  <span className="mt-1 block font-semibold text-amber-700">
                    الصفحة موقوفة منذ {customer.suspended_days} يومًا فقط؛ مهلة الحذف بعد الإيقاف لعدم التجديد 20 يومًا.
                  </span>
                )}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الحذف" className={inputClass} />
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={`اكتب ${label} للتأكيد`}
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <Button
                tone="danger"
                className="mt-3"
                disabled={removal.busy || deleteConfirm !== label || reason.trim().length < 3}
                onClick={async () => {
                  const done = await removal.run(() => adminCall('user.delete', { userId, reason, confirm: deleteConfirm }));
                  if (done) onBack();
                }}
              >
                حذف الحساب نهائيًا
              </Button>
            </Card>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-gray-500">الصفحة كما حفظها العميل</div>
          {pageData ? <PageView data={mergeWithDefaults(pageData)} variant="preview" /> : <Empty>لا توجد صفحة.</Empty>}
        </div>
      </div>
    </div>
  );
}
