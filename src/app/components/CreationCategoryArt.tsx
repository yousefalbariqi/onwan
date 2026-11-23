import type { CreationCategory } from '../lib/creationStart';

// Note 3: an original small scene for each kind of page, in Onwan's palette.
const INK = '#17181a';
const ORANGE = '#ff6b2c';
const CREAM = '#fff8f1';

function Personal() {
  return <>
    <rect width="200" height="120" fill="#ffd9c2" />
    <circle cx="170" cy="18" r="34" fill="#ffb78f" />
    <circle cx="20" cy="112" r="30" fill={ORANGE} />
    <g transform="rotate(-4 100 62)">
      <rect x="62" y="10" width="76" height="108" rx="14" fill={CREAM} />
      <circle cx="100" cy="35" r="14" fill={ORANGE} />
      <circle cx="100" cy="31" r="5" fill={CREAM} />
      <path d="M90 44c2-7 18-7 20 0a14 14 0 0 1-20 0z" fill={CREAM} />
      <rect x="84" y="54" width="32" height="4" rx="2" fill={INK} />
      <rect x="72" y="65" width="56" height="12" rx="6" fill={INK} />
      <rect x="72" y="81" width="56" height="12" rx="6" fill="#ffd9c2" />
      <rect x="72" y="97" width="56" height="12" rx="6" fill="#ffd9c2" />
    </g>
  </>;
}

function Creator() {
  return <>
    <rect width="200" height="120" fill="#c9d9f5" />
    <circle cx="28" cy="20" r="32" fill="#a9c2ee" />
    <rect x="44" y="24" width="112" height="72" rx="14" fill={INK} />
    <rect x="51" y="31" width="98" height="58" rx="9" fill="#4f74c9" />
    <circle cx="100" cy="60" r="18" fill={CREAM} />
    <path d="M94 50.5v19l16-9.500z" fill={ORANGE} />
    <rect x="58" y="80" width="84" height="3" rx="1.500" fill="#a9c2ee" />
    <rect x="58" y="80" width="36" height="3" rx="1.500" fill={ORANGE} />
    <path d="M169 34c-5-7-15-1-9 8l9 8 9-8c6-9-4-15-9-8z" fill={ORANGE} />
    <path d="M28 76l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={CREAM} />
    <circle cx="176" cy="88" r="6" fill={CREAM} />
  </>;
}

function Business() {
  const stripes = [46, 68, 90, 112, 134];
  return <>
    <rect width="200" height="120" fill="#e8dcc6" />
    <circle cx="172" cy="24" r="30" fill="#d9c7a6" />
    <rect y="104" width="200" height="16" fill="#cdb78f" />
    <rect x="50" y="42" width="100" height="62" fill={CREAM} />
    <path d="M52 16h96l10 28H42z" fill={ORANGE} />
    {stripes.map((x, index) => <path key={x} d={`M${x + 11 - index * 1.500} 16h10.500l${index * 4 - 4} 28h-21z`} fill={CREAM} />)}
    {[42, 65, 88, 111, 134].map(x => <path key={x} d={`M${x} 44h24a12 10 0 0 1-24 0z`} fill={x === 42 || x === 88 || x === 134 ? ORANGE : CREAM} />)}
    <rect x="60" y="64" width="34" height="40" rx="4" fill={INK} />
    <circle cx="87" cy="85" r="2" fill={ORANGE} />
    <rect x="104" y="64" width="36" height="24" rx="4" fill="#d9c7a6" />
    <path d="M26 104V82" stroke="#5f7a52" strokeWidth="3" />
    <circle cx="26" cy="76" r="11" fill="#6f8f60" />
  </>;
}

function Nonprofit() {
  return <>
    <rect width="200" height="120" fill="#bfe0cc" />
    <circle cx="30" cy="22" r="32" fill="#9fd0b3" />
    <circle cx="176" cy="100" r="30" fill="#9fd0b3" />
    <path d="M100 88C74 68 62 53 62 39c0-17 25-23 38-6 13-17 38-11 38 6 0 14-12 29-38 49z" fill={ORANGE} />
    <path d="M48 84c12 30 92 30 104 0" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    <path d="M70 108h60" stroke="#2f6b4f" strokeWidth="7" strokeLinecap="round" />
    <path d="M160 26l2.500 6.500 6.500 2.500-6.500 2.500-2.500 6.500-2.500-6.500-6.500-2.500 6.500-2.500z" fill={CREAM} />
  </>;
}

const SCENES = { personal: Personal, creator: Creator, business: Business, nonprofit: Nonprofit };

export function CreationCategoryArt({ category }: { category: CreationCategory }) {
  const Scene = SCENES[category];
  return <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><Scene /></svg>;
}
