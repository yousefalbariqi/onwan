import { useLocation } from 'react-router';
import { isNonprofitHost, SUPPORT_WHATSAPP } from '../lib/site';
import { COMPANY_PHONE } from './NonprofitFooter';
import { SocialIcon } from './SocialIcons';

export function FloatingWhatsApp() {
  const { pathname } = useLocation();
  if (!isNonprofitHost() && !/^\/nonprofit(?:\/|$)/.test(pathname)) return null;
  const phone = SUPPORT_WHATSAPP || COMPANY_PHONE.replace(/^0/, '966');
  return <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" aria-label={`تواصل معنا عبر واتساب ${phone}`} title={`واتساب ${phone}`} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-40 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]">
    <span aria-hidden="true" className="absolute h-8 w-8 rounded-full bg-[#25D366]/15 motion-safe:animate-pulse" />
    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md transition-transform hover:scale-105"><SocialIcon platform="whatsapp" iconStyle="color" color="#ffffff" size={19} /></span>
  </a>;
}
