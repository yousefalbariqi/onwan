import { useState } from 'react';
import { accountCall } from '../lib/api';
import { usePageContext } from '../context/PageContext';
import { PasswordInput } from './PasswordInput';

// Note 72: after a temporary password from the administration, the customer
// sets their own before anything else. It cannot be closed.
export function TemporaryPasswordGate() {
  const { account, setAccount } = usePageContext();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!account?.mustChangePassword) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/30 backdrop-blur-[2px]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <form
          className="w-full max-w-[380px] space-y-4 rounded-[28px] bg-[#f2f2f7] px-5 pb-7 pt-6 shadow-2xl"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try { setAccount((await accountCall('password.replaceTemporary', { password })).account); }
            catch (err) { setError(err instanceof Error ? err.message : 'تعذر حفظ كلمة المرور.'); }
            finally { setBusy(false); }
          }}
        >
          <div className="text-center">
            <h1 className="text-[24px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختر كلمة مرور جديدة</h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">دخلت بكلمة مرور مؤقتة من إدارة عنوان. اختر كلمتك الخاصة للمتابعة.</p>
          </div>
          <div className="rounded-2xl bg-white px-4">
            <PasswordInput value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="8 أحرف على الأقل" autoComplete="new-password" autoFocus aria-label="كلمة المرور الجديدة" className="w-full bg-transparent py-3.5 text-[17px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" dir="ltr" />
          </div>
          {error && <p role="alert" className="px-1 text-[13px] text-[#ff3b30]">{error}</p>}
          <button type="submit" disabled={busy || password.length < 8} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#0a84ff] text-[17px] font-bold text-white disabled:bg-[#c7c7cc]" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {busy ? 'لحظات…' : 'حفظ والمتابعة'}
          </button>
        </form>
      </div>
    </div>
  );
}
