import { Link } from 'react-router';
import { OnwanLogo } from './OnwanLogo';
import AuthModal from './AuthModal';
import { journeyPath, type JourneyKind } from '../lib/journey';

export function AccountBackdrop({ kind = 'standard', children }: { kind?: JourneyKind; children: React.ReactNode }) {
  return <><div dir="rtl" className="min-h-screen bg-[#F8F8F6] text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}><header className="mx-auto max-w-4xl p-6"><Link to={journeyPath(kind)} aria-label="عنوان — الرئيسية"><OnwanLogo /></Link></header><main className="mx-auto max-w-4xl p-6"><h1>{kind === 'nonprofit' ? 'حساب الجمعية' : 'حسابك في عنوان'}</h1></main></div>{children}</>;
}

export function AccountEntry({ mode, kind = 'standard', username }: { mode: 'signup' | 'login'; kind?: JourneyKind; username?: string }) {
  return <AccountBackdrop kind={kind}><AuthModal mode={mode} nonprofit={kind === 'nonprofit'} username={username} /></AccountBackdrop>;
}
