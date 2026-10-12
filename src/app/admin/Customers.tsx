import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { ROOT_DOMAIN } from '../lib/site';
import { adminCall } from './adminApi';
import { Badge, Card, Empty, ErrorNote, PAGE_STATUS, PLAN_NAMES, Tabs, formatDate, inputClass, useLoad } from './ui';

type Filter = 'all' | 'overdue' | 'suspended' | 'banned' | 'draft';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'overdue', label: 'اشتراك منتهٍ' },
  { id: 'suspended', label: 'موقوفة' },
  { id: 'banned', label: 'محظور' },
  { id: 'draft', label: 'لم تُنشر' },
];

export function Customers({ onOpen }: { onOpen: (userId: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => adminCall<{ customers: any[] }>('customers.list', { q: query, filter }), [query, filter]);
  const { data, error, loading } = useLoad(load);

  return (
    <Card title="العملاء" actions={<Tabs value={filter} onChange={setFilter} options={FILTERS} />}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الرابط أو البريد أو الجوال"
          className={`${inputClass} pr-9`}
        />
      </div>

      <ErrorNote message={error} />

      {data && data.customers.length === 0 && <Empty>لا يوجد عملاء مطابقون.</Empty>}

      {data && data.customers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th className="py-2 font-semibold">الجهة</th>
                <th className="py-2 font-semibold">التواصل</th>
                <th className="py-2 font-semibold">الصفحة</th>
                <th className="py-2 font-semibold">الاشتراك</th>
                <th className="py-2 font-semibold">الانتهاء</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => onOpen(customer.id)}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3">
                    <div className="font-semibold text-gray-900">{customer.display_name || '—'}</div>
                    <div className="text-xs text-gray-500" dir="ltr">
                      {customer.username ? `${customer.username}.${ROOT_DOMAIN}` : '—'}
                    </div>
                  </td>
                  <td className="py-3 text-xs text-gray-600" dir="ltr">
                    <div>{customer.email || '—'}</div>
                    <div>{customer.phone}</div>
                  </td>
                  <td className="py-3">
                    {customer.account_status === 'banned' ? (
                      <Badge tone="red">محظور</Badge>
                    ) : (
                      <Badge tone={customer.page_status === 'published' ? 'green' : customer.page_status === 'suspended' ? 'amber' : 'gray'}>
                        {PAGE_STATUS[customer.page_status] ?? '—'}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 text-gray-700">
                    {customer.plan ? PLAN_NAMES[customer.plan] : '—'}
                    {customer.subscription_status === 'pending_payment' && <span className="mr-1 text-xs text-amber-700">(بانتظار الدفع)</span>}
                  </td>
                  <td className="py-3">
                    <div className="text-gray-700">{formatDate(customer.expires_at)}</div>
                    {customer.overdue_days !== null && (
                      <div className="text-xs font-semibold text-red-600">متأخر {customer.overdue_days} يومًا</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && !data && <Empty>جاري التحميل...</Empty>}
    </Card>
  );
}
