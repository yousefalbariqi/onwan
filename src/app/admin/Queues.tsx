import { useCallback, useState } from 'react';
import { ROOT_DOMAIN } from '../lib/site';
import { adminCall } from './adminApi';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  REQUEST_STATUS,
  REQUEST_TYPES,
  REVIEW_STATUS,
  Tabs,
  formatDate,
  inputClass,
  useAction,
  useLoad,
} from './ui';

type OpenCustomer = (userId: string) => void;

function CustomerLink({ userId, username, onOpen }: { userId: string | null; username: string | null; onOpen: OpenCustomer }) {
  const text = username ? `${username}.${ROOT_DOMAIN}` : 'عميل محذوف';

  return userId ? (
    <button onClick={() => onOpen(userId)} className="font-semibold text-emerald-700 hover:underline" dir="ltr">
      {text}
    </button>
  ) : (
    <span className="font-semibold text-gray-500" dir="ltr">{text}</span>
  );
}

// MOD-01..04: every save lands here; accept, or reject with a reason.
export function Reviews({ onOpen }: { onOpen: OpenCustomer }) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const load = useCallback(() => adminCall<{ reviews: any[] }>('reviews.list', { status }), [status]);
  const { data, error, reload } = useLoad(load);
  const action = useAction(reload);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  return (
    <Card
      title="مراجعة المحتوى"
      actions={
        <Tabs
          value={status}
          onChange={setStatus}
          options={(['pending', 'accepted', 'rejected'] as const).map((id) => ({ id, label: REVIEW_STATUS[id] }))}
        />
      }
    >
      <ErrorNote message={error || action.error} />
      {data?.reviews.length === 0 && <Empty>لا يوجد محتوى بهذه الحالة.</Empty>}

      <ul className="space-y-3">
        {data?.reviews.map((review) => {
          const snapshot = review.snapshot_json ?? {};

          return (
            <li key={review.id} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <CustomerLink userId={review.user_id} username={review.username} onOpen={onOpen} />
                <span className="text-xs text-gray-500">{formatDate(review.created_at, true)}</span>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <div><span className="text-gray-500">الاسم:</span> {snapshot.name || '—'}</div>
                <div><span className="text-gray-500">الوصف:</span> {snapshot.bio || '—'}</div>
                {(snapshot.contactPhone || snapshot.contactEmail) && (
                  <div dir="ltr" className="text-right">{[snapshot.contactPhone, snapshot.contactEmail].filter(Boolean).join(' · ')}</div>
                )}
                <ul className="mt-2 space-y-1">
                  {(snapshot.links ?? []).map((link: any, index: number) => (
                    <li key={index} className="flex gap-2 text-xs">
                      <span className="font-semibold">{link.title}</span>
                      <span className="min-w-0 truncate text-gray-500" dir="ltr">
                        {link.linkType === 'file' ? link.fileName || link.url : link.url}
                      </span>
                      {link.hidden && <Badge>مخفي</Badge>}
                    </li>
                  ))}
                </ul>
              </div>

              {status === 'pending' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button tone="good" disabled={action.busy} onClick={() => action.run(() => adminCall('reviews.decide', { id: review.id, decision: 'accepted' }))}>
                    مقبول
                  </Button>
                  <input
                    value={reasons[review.id] ?? ''}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [review.id]: e.target.value }))}
                    placeholder="سبب الرفض (يُرسل للعميل)"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <Button
                    tone="danger"
                    disabled={action.busy || (reasons[review.id] ?? '').trim().length < 3}
                    onClick={() => action.run(() => adminCall('reviews.decide', { id: review.id, decision: 'rejected', reason: reasons[review.id] }))}
                  >
                    مرفوض
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500">
                  {review.reviewed_by} · {formatDate(review.reviewed_at, true)}
                  {review.reason && <span className="mr-2 text-red-700">السبب: {review.reason}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {status === 'pending' && (
        <p className="mt-4 text-xs text-gray-500">
          الرفض يسجّل القرار ويبلّغ العميل بالسبب بالبريد ولا يحذف شيئًا. لإزالة المحتوى المخالف افتح صفحة العميل واحذفه يدويًا.
        </p>
      )}
    </Card>
  );
}

// PUB-03: visitor reports about a whole page.
export function Reports({ onOpen }: { onOpen: OpenCustomer }) {
  const [includeHandled, setIncludeHandled] = useState(false);
  const load = useCallback(() => adminCall<{ reports: any[] }>('reports.list', { includeHandled }), [includeHandled]);
  const { data, error, reload } = useLoad(load);
  const action = useAction(reload);

  return (
    <Card
      title="بلاغات الجمهور"
      actions={
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={includeHandled} onChange={(e) => setIncludeHandled(e.target.checked)} />
          عرض المعالَجة
        </label>
      }
    >
      <ErrorNote message={error || action.error} />
      {data?.reports.length === 0 && <Empty>لا توجد بلاغات.</Empty>}

      <ul className="divide-y divide-gray-100">
        {data?.reports.map((report) => (
          <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 text-sm">
              <CustomerLink userId={report.user_id} username={report.username} onOpen={onOpen} />
              <p className="mt-1 whitespace-pre-line text-gray-700">{report.message}</p>
              <div className="mt-1 text-xs text-gray-500">
                {formatDate(report.created_at, true)}
                {report.handled_at && ` · عالجه ${report.handled_by}`}
              </div>
            </div>
            {!report.handled_at && (
              <Button disabled={action.busy} onClick={() => action.run(() => adminCall('reports.handle', { id: report.id }))}>
                تمت المعالجة
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RequestRow({ request, onOpen, onSaved }: { request: any; onOpen: OpenCustomer; onSaved: () => void }) {
  const [status, setStatus] = useState<string>(request.status);
  const [dueAt, setDueAt] = useState<string>(request.due_at ? request.due_at.slice(0, 10) : '');
  const [notes, setNotes] = useState<string>(request.internal_notes ?? '');
  const action = useAction(onSaved);

  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={request.status === 'completed' ? 'green' : request.status === 'stalled' ? 'red' : 'amber'}>
            {REQUEST_STATUS[request.status]}
          </Badge>
          <span className="font-bold">{REQUEST_TYPES[request.type] ?? request.type}</span>
          <CustomerLink userId={request.user_id} username={request.username} onOpen={onOpen} />
        </div>
        <span className="text-xs text-gray-500">{formatDate(request.created_at, true)}</span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{request.message}</p>
      <div className="mt-1 text-xs text-gray-500" dir="ltr">
        {[request.email, request.phone].filter(Boolean).join(' · ')}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_160px_minmax(0,1fr)_auto]">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          {Object.entries(REQUEST_STATUS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} title="الموعد المستهدف" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات داخلية" className={inputClass} />
        <Button
          tone="primary"
          disabled={action.busy}
          onClick={() => action.run(() => adminCall('requests.update', { id: request.id, status, dueAt: dueAt || null, internalNotes: notes }))}
        >
          حفظ
        </Button>
      </div>
      <ErrorNote message={action.error} />
      {request.handled_by && <div className="mt-2 text-xs text-gray-500">آخر تحديث: {request.handled_by}</div>}
    </li>
  );
}

// REQ-01..03: statuses, target date and notes are internal — never shown to the customer.
export function Requests({ onOpen }: { onOpen: OpenCustomer }) {
  const [status, setStatus] = useState<'open' | 'in_progress' | 'stalled' | 'completed'>('open');
  const load = useCallback(
    () => adminCall<{ requests: any[] }>('requests.list', { status: status === 'open' ? null : status }),
    [status],
  );
  const { data, error, reload } = useLoad(load);
  const requests = data?.requests.filter((request) => status !== 'open' || request.status !== 'completed') ?? [];

  return (
    <Card
      title="طلبات ورسائل العملاء"
      actions={
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { id: 'open', label: 'المفتوحة' },
            { id: 'in_progress', label: 'قيد المعالجة' },
            { id: 'stalled', label: 'متعثر' },
            { id: 'completed', label: 'مكتمل' },
          ]}
        />
      }
    >
      <ErrorNote message={error} />
      {data && requests.length === 0 && <Empty>لا توجد طلبات.</Empty>}
      <ul className="space-y-3">
        {requests.map((request) => (
          <RequestRow key={`${request.id}-${request.status}`} request={request} onOpen={onOpen} onSaved={reload} />
        ))}
      </ul>
    </Card>
  );
}
