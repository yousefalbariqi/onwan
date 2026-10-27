import { useId } from 'react';

// Note 31: the official «عنوان» logo from onwan-brand.html — two stacked cards
// (the card is the identity, the orange dot is its owner) beside the word.
// Its own colours always: ink #111111, taupe #C9C0B4, orange #FF6B2C.
export function OnwanMark({ className = '' }: { className?: string }) {
  const mask = `onwan-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="30 10 210 170" className={className} aria-hidden="true">
      <mask id={mask}><rect x="0" y="0" width="300" height="220" fill="#fff" /><g transform="rotate(-6 150 112)"><rect x="60" y="45" width="180" height="135" rx="30" fill="#000" /></g></mask>
      <g mask={`url(#${mask})`}><rect x="38" y="22" width="150" height="112" rx="18" fill="#C9C0B4" transform="rotate(-14 113 78)" /></g>
      <g transform="rotate(-6 150 112)">
        <rect x="70" y="55" width="160" height="115" rx="22" fill="#111111" />
        <circle cx="108" cy="118" r="17" fill="#FF6B2C" />
        <rect x="138" y="124" width="72" height="18" rx="9" fill="#F8F8F6" />
      </g>
    </svg>
  );
}

export function OnwanLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[#111111] ${className}`}>
      <OnwanMark className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
      <span className="text-[1.6rem] font-bold leading-none tracking-[-0.01em] sm:text-[2rem]">عنوان</span>
    </span>
  );
}
