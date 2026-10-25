import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Circle, Plus, Check, ChevronLeft, Loader2, ZoomIn } from 'lucide-react';

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

// `large`: the main tabs of a panel; the default fits inside a row.
export function Segmented<T extends string>({ options, value, onChange, large = false }: { options: readonly { id: T; label: string; icon?: typeof Circle }[]; value: T; onChange: (id: T) => void; large?: boolean }) {
  return (
    <div className={`flex rounded-[10px] bg-[#e9e9ee] p-0.5 ${large ? 'min-h-[40px]' : 'min-h-[34px]'}`} role="group">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-1 font-bold leading-none transition-all ${large ? 'text-[14px]' : 'text-[13px]'} ${active ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[#6e6e73]'}`}
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

// A slider standing upright beside the photo. `topIsMin`: the top end is the
// minimum (position: 0 = top); otherwise the top end is the maximum (zoom in).
export function VerticalSlider({ label, min, max, step, value, onChange, topIsMin = false, icon }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void; topIsMin?: boolean; icon?: 'zoom' }) {
  const LENGTH = 150;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 text-[10px] text-[#6e6e73]">
      {icon === 'zoom' ? <ZoomIn className="h-3.5 w-3.5" /> : <span>{topIsMin ? 'أعلى' : ''}</span>}
      <div className="relative w-7" style={{ height: LENGTH }}>
        <input
          aria-label={label}
          type="range"
          dir="ltr"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute left-1/2 top-1/2 accent-[#0a84ff]"
          style={{ width: LENGTH, transform: `translate(-50%, -50%) rotate(${topIsMin ? 90 : -90}deg)` }}
        />
      </div>
      <span>{icon === 'zoom' ? 'تكبير' : topIsMin ? 'أسفل' : ''}</span>
    </div>
  );
}

// A horizontal slider with its two ends named (e.g. يمين / يسار).
export function EndsSlider({ label, start, end, min, max, step = 1, value, onChange }: { label: string; start: string; end: string; min: number; max: number; step?: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex w-full items-center gap-3 px-1 text-xs text-[#6e6e73]">
      <span className="shrink-0">{start}</span>
      <input aria-label={label} type="range" dir="rtl" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 accent-[#0a84ff]" />
      <span className="shrink-0">{end}</span>
    </label>
  );
}

// A small two-choice sheet (note 23's style), for leaving a changed form and
// for deleting a group.
export function ConfirmSheet({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, tone = 'danger' }: { title: string; message: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void; tone?: 'danger' | 'default' }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-[340px] overflow-hidden rounded-[22px] bg-white text-center shadow-2xl" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}>
        <p className="px-6 pb-1 pt-5 text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{title}</p>
        <p className="px-6 pb-4 text-sm leading-6 text-[#6e6e73]">{message}</p>
        <div className="space-y-2 px-4 pb-4">
          <button type="button" onClick={onConfirm} className={`block w-full rounded-xl py-3 text-[15px] font-bold text-white ${tone === 'danger' ? 'bg-[#ff3b30]' : 'bg-[#0a84ff]'}`}>{confirmLabel}</button>
          <button type="button" onClick={onCancel} className="block w-full rounded-xl bg-[#f2f2f7] py-3 text-[15px] font-bold text-[#1d1d1f]">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

// The one main action of a screen: filled, wide, 52 pt.
export function PrimaryButton({ children, onClick, disabled, busy, tone = 'blue', type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; tone?: 'blue' | 'green' | 'red'; type?: 'button' | 'submit' }) {
  const color = tone === 'green' ? 'bg-emerald-600 shadow-[0_6px_16px_rgba(5,150,105,0.28)]' : tone === 'red' ? 'bg-[#ff3b30] shadow-[0_6px_16px_rgba(255,59,48,0.25)]' : 'bg-[#0a84ff] shadow-[0_6px_16px_rgba(10,132,255,0.28)]';
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white transition-transform active:scale-[0.98] disabled:bg-[#c7c7cc] disabled:shadow-none ${color}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}

// A Settings row: coloured icon tile, label, value, and a chevron when it leads on.
export function SettingsRow({ icon: Icon, tone, label, value, badge, onClick, danger = false }: { icon: LucideIcon; tone: string; label: string; value?: ReactNode; badge?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-right active:bg-[#f2f2f7]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white ${tone}`}><Icon className="h-[18px] w-[18px]" /></span>
      <span className={`min-w-0 flex-1 truncate text-[15px] ${danger ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>{label}</span>
      {badge && <span className="shrink-0 rounded-full bg-[#ff3b30] px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
      {value !== undefined && <span className="max-w-[45%] shrink-0 truncate text-[15px] text-[#8e8e93]">{value}</span>}
      {!danger && <ChevronLeft className="h-4 w-4 shrink-0 text-[#c7c7cc]" />}
    </button>
  );
}

// A calm status line: one colour per meaning (info / good / warning / problem).
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'good' | 'warn' | 'bad'; children: ReactNode }) {
  const color = tone === 'good' ? 'bg-[#34c759]/10 text-[#1f7a35]' : tone === 'warn' ? 'bg-[#ff9500]/12 text-[#9a5b00]' : tone === 'bad' ? 'bg-[#ff3b30]/10 text-[#c4251c]' : 'bg-[#f2f2f7] text-[#3a3a3c]';
  return <p role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-6 ${color}`}>{children}</p>;
}
