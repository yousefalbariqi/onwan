import { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, LucideIcon } from 'lucide-react';
import { PasswordInput } from './PasswordInput';

interface AuthLayoutProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  backTo?: string;
  children: ReactNode;
}

export function AuthLayout({ icon: Icon, title, subtitle, backTo = '/', children }: AuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(backTo)}
          className="mb-8 text-white/80 hover:text-white flex items-center gap-2 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <ArrowRight className="w-5 h-5" />
          <span>رجوع</span>
        </button>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
            <Icon className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-black text-gray-900 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
            {title}
          </h1>

          {subtitle && (
            <p className="text-gray-600 text-lg mb-8" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {subtitle}
            </p>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function AuthField({ label, hint, ...inputProps }: AuthFieldProps) {
  return (
    <div className="space-y-2 mb-5">
      <label className="block text-sm font-semibold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {label}
      </label>
      {inputProps.type === 'password' ? (
        <PasswordInput
          {...inputProps}
          className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg text-left focus:outline-none focus:border-emerald-500 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
          dir="ltr"
        />
      ) : (
        <input
          {...inputProps}
          className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-lg text-left focus:outline-none focus:border-emerald-500 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
          dir="ltr"
        />
      )}
      {hint && (
        <div className="text-xs text-gray-500 text-right" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      {message}
    </div>
  );
}

export function AuthSubmit({ loading, children, disabled }: { loading: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full bg-gradient-to-r from-lime-500 to-emerald-500 text-white py-4 rounded-xl text-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          لحظات...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
