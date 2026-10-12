import { ReactNode, useCallback, useEffect, useState } from 'react';

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';

  return new Date(value).toLocaleString('ar-u-ca-gregory-nu-latn', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  });
}

export const PAGE_STATUS: Record<string, string> = { draft: 'غير منشورة', published: 'منشورة', suspended: 'موقوفة' };
export const PLAN_NAMES: Record<string, string> = { monthly: 'شهري', annual: 'سنوي' };
export const REQUEST_STATUS: Record<string, string> = { in_progress: 'قيد المعالجة', completed: 'مكتمل', stalled: 'متعثر' };
export const REVIEW_STATUS: Record<string, string> = { pending: 'بانتظار المراجعة', accepted: 'مقبول', rejected: 'مرفوض' };
export const REQUEST_TYPES: Record<string, string> = {
  message: 'رسالة',
  pause_page: 'إيقاف الصفحة',
  reactivate_page: 'إعادة تفعيل الصفحة',
  delete_account: 'حذف الحساب',
  change_subdomain: 'تغيير الرابط',
  stop_renewal: 'إيقاف التجديد',
  more_storage: 'زيادة المساحة',
  invoice: 'فاتورة',
};

type Tone = 'gray' | 'green' | 'amber' | 'red';

const TONES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const BUTTON_TONES = {
  primary: 'bg-gray-900 text-white hover:bg-gray-800',
  plain: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  good: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

export function Button({
  tone = 'plain',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof BUTTON_TONES }) {
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_TONES[tone]} ${className}`}
    />
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return message ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div> : null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-gray-500">{children}</p>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            value === option.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Loads a list and exposes reload/error state; `load` should be stable or
// change only when the query changes.
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await load());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}

// Runs one admin action, surfacing its error next to the buttons.
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setError('');
      await action();
      onDone?.();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}
