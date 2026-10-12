import { useCallback, useState } from 'react';
import { StaffMember, adminCall } from './adminApi';
import { Badge, Button, Card, Empty, ErrorNote, Field, PLAN_NAMES, formatDate, inputClass, useAction, useLoad } from './ui';

const PERMISSION_LABELS: Record<string, string> = {
  change_subdomain: 'الموافقة على تغيير رابط الصفحة وتنفيذه',
};

// PAY-01: only the manager changes prices; they apply to new subscriptions
// and future renewals.
export function Prices({ isManager }: { isManager: boolean }) {
  const load = useCallback(() => adminCall<{ plans: { plan: string; priceSar: number | null }[] }>('plans.list'), []);
  const { data, error, reload } = useLoad(load);
  const action = useAction(reload);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Card title="أسعار الاشتراك">
      <ErrorNote message={error || action.error} />
      <ul className="divide-y divide-gray-100">
        {data?.plans.map(({ plan, priceSar }) => (
          <li key={plan} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="font-semibold">{PLAN_NAMES[plan]}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">{priceSar === null ? 'لم يُحدد بعد' : `${priceSar} ريال`}</span>
              {isManager && (
                <>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={drafts[plan] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [plan]: e.target.value }))}
                    placeholder="سعر جديد"
                    className={`${inputClass} w-28`}
                    dir="ltr"
                  />
                  <Button
                    tone="primary"
                    disabled={action.busy || !(Number(drafts[plan]) > 0)}
                    onClick={async () => {
                      if (await action.run(() => adminCall('plans.set', { plan, priceSar: Number(drafts[plan]) }))) {
                        setDrafts((prev) => ({ ...prev, [plan]: '' }));
                      }
                    }}
                  >
                    حفظ
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!isManager && <p className="mt-2 text-xs text-gray-500">تعديل الأسعار للمدير فقط.</p>}
    </Card>
  );
}

// PERM-18: manager only.
export function StaffAdmin({ me }: { me: StaffMember }) {
  const load = useCallback(() => adminCall<{ staff: StaffMember[]; grantable: string[] }>('staff.list'), []);
  const { data, error, reload } = useLoad(load);
  const action = useAction(reload);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const update = (id: string, changes: Record<string, unknown>) =>
    action.run(() => adminCall('staff.update', { id, ...changes }));

  return (
    <Card title="الموظفون والصلاحيات">
      <ErrorNote message={error || action.error} />

      <ul className="divide-y divide-gray-100">
        {data?.staff.map((member) => (
          <li key={member.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{member.name}</span>{' '}
                <Badge tone={member.role === 'manager' ? 'green' : 'gray'}>{member.role === 'manager' ? 'مدير' : 'موظف'}</Badge>{' '}
                {!member.isActive && <Badge tone="red">موقوف</Badge>}
                <div className="text-xs text-gray-500" dir="ltr">{member.email}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={action.busy}
                  onClick={() => {
                    const password = window.prompt(`كلمة مرور جديدة لـ ${member.name} (8 أحرف على الأقل):`);
                    if (password) update(member.id, { password });
                  }}
                >
                  كلمة مرور جديدة
                </Button>
                {member.id !== me.id && (
                  <Button disabled={action.busy} onClick={() => update(member.id, { isActive: !member.isActive })}>
                    {member.isActive ? 'إيقاف' : 'تفعيل'}
                  </Button>
                )}
              </div>
            </div>

            {member.role === 'staff' &&
              data.grantable.map((permission) => (
                <label key={permission} className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    disabled={action.busy}
                    checked={member.permissions.includes(permission)}
                    onChange={(e) =>
                      update(member.id, {
                        permissions: e.target.checked
                          ? [...member.permissions, permission]
                          : member.permissions.filter((item) => item !== permission),
                      })
                    }
                  />
                  مخوّل: {PERMISSION_LABELS[permission] ?? permission}
                </label>
              ))}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl bg-gray-50 p-4">
        <div className="mb-3 text-sm font-bold">إضافة موظف</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="الاسم">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="البريد">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} className={inputClass} dir="ltr" />
          </Field>
          <Field label="كلمة المرور (8+)">
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} dir="ltr" />
          </Field>
        </div>
        <Button
          tone="primary"
          className="mt-3"
          disabled={action.busy || !form.name || !form.email || form.password.length < 8}
          onClick={async () => {
            if (await action.run(() => adminCall('staff.create', form))) setForm({ name: '', email: '', password: '' });
          }}
        >
          إضافة
        </Button>
        <p className="mt-2 text-xs text-gray-500">
          أي موظف مفعّل يدير المحتوى والعملاء والاشتراكات والطلبات والبلاغات والحظر. فك الحظر والحذف النهائي والأسعار والموظفون وسجل العمليات للمدير فقط.
        </p>
      </div>
    </Card>
  );
}

// PERM-15: manager only.
export function AuditLog() {
  const load = useCallback(() => adminCall<{ entries: any[] }>('audit.list'), []);
  const { data, error } = useLoad(load);

  return (
    <Card title="سجل عمليات النظام">
      <ErrorNote message={error} />
      {data?.entries.length === 0 && <Empty>لا توجد عمليات.</Empty>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right text-sm">
          <tbody>
            {data?.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100 align-top">
                <td className="whitespace-nowrap py-2 text-xs text-gray-500">{formatDate(entry.created_at, true)}</td>
                <td className="py-2 font-semibold">{entry.staff_name}</td>
                <td className="py-2" dir="ltr">{entry.action}</td>
                <td className="py-2" dir="ltr">{entry.target_label ?? ''}</td>
                <td className="max-w-[280px] truncate py-2 text-xs text-gray-500" dir="ltr" title={JSON.stringify(entry.details)}>
                  {Object.keys(entry.details ?? {}).length ? JSON.stringify(entry.details) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
