import { ReactNode } from 'react';
import { Circle, Plus, Check, ChevronLeft } from 'lucide-react';

// Shared Apple-style (iOS Settings) controls for the editor panels: grouped
// lists, rows, segmented controls, switches and a single row of colour dots.
// Every panel uses these so the editor reads as one system.

export const COLOR_DOTS = ['#000000', '#ffffff', '#6b7280', '#0066cc', '#059669', '#dc2626', '#ff6b35', '#e91e63', '#9c27b0', '#d97706'];

export function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  return (
    <section>
      <h3 className="mb-1.5 px-4 text-[13px] font-bold text-[#6e6e73]" style={{ fontFamily: 'Cairo, sans-serif' }}>{title}</h3>
      <div className="divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-white">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-xs leading-5 text-[#8e8e93]">{footer}</p>}
    </section>
  );
}

export function Row({ label, children, stacked = false }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={stacked ? 'space-y-2.5 px-4 py-3' : 'flex min-h-[48px] items-center justify-between gap-3 px-4 py-2'}>
      <span className="text-[15px] text-[#1d1d1f]">{label}</span>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string; icon?: typeof Circle }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex rounded-[10px] bg-[#e9e9ee] p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.id === value;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[13px] font-bold transition-all ${active ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[#6e6e73]'}`}
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? 'bg-[#34c759]' : 'bg-[#e9e9ee]'}`}>
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all ${on ? 'left-[2px]' : 'left-[22px]'}`} />
    </button>
  );
}

// One row of colour dots; the first is «تلقائي» (follow the theme), the last opens the system picker.
export function ColorDots({ value, onChange }: { value?: string; onChange: (color: string | undefined) => void }) {
  const isCustom = !!value && !COLOR_DOTS.includes(value.toLowerCase());
  return (
    <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button onClick={() => onChange(undefined)} className={`flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-bold ${!value ? 'bg-[#1d1d1f] text-white' : 'bg-[#f2f2f7] text-[#3a3a3c]'}`}>تلقائي</button>
      {COLOR_DOTS.map((color) => {
        const active = value?.toLowerCase() === color;
        return (
          <button key={color} onClick={() => onChange(color)} aria-label={color} className={`relative h-9 w-9 shrink-0 rounded-full ring-1 ring-black/10 ${active ? 'outline outline-2 outline-offset-2 outline-[#0a84ff]' : ''}`} style={{ backgroundColor: color }}>
            {active && <Check className={`absolute inset-0 m-auto h-4 w-4 ${color === '#ffffff' ? 'text-black' : 'text-white'}`} />}
          </button>
        );
      })}
      <label className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ${isCustom ? 'outline outline-2 outline-offset-2 outline-[#0a84ff]' : ''}`} style={{ background: isCustom ? value : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} aria-label="لون مخصص">
        {!isCustom && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><Plus className="h-4 w-4 text-[#1d1d1f]" /></span>}
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

// Outer wrapper of every panel: the grey grouped background.
export function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-6 bg-[#f2f2f7] px-4 py-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>{children}</div>;
}

// A text field laid out as a grouped-list row.
export function FieldRow({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-[48px] items-center gap-3 px-4">
      <span className="w-20 shrink-0 text-[15px] text-[#1d1d1f]">{label}</span>
      <input {...input} className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none" />
    </label>
  );
}

// A tappable row that leads somewhere (chevron on the left in RTL).
export function NavRow({ label, value, onClick, tone = 'default' }: { label: string; value?: ReactNode; onClick: () => void; tone?: 'default' | 'blue' | 'red' }) {
  const color = tone === 'blue' ? 'text-[#0a84ff]' : tone === 'red' ? 'text-[#ff3b30]' : 'text-[#1d1d1f]';
  return (
    <button onClick={onClick} className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-right">
      <span className={`text-[15px] ${color}`}>{label}</span>
      <span className="flex items-center gap-1 text-[15px] text-[#8e8e93]">
        {value}
        {tone === 'default' && <ChevronLeft className="h-4 w-4 text-[#c7c7cc]" />}
      </span>
    </button>
  );
}
