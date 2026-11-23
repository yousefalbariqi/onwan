import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, X } from 'lucide-react';
import { Segmented, Toggle } from './ios';
import { pageHost } from '../lib/site';
import { FONT_OPTIONS, PageData, usePageContext } from '../context/PageContext';
import { customFontActive, customFontFamily, loadCustomFont, loadFont } from '../lib/fonts';
import { uploadFont } from '../lib/fontUpload';
import { PhonePreview } from './PhonePreview';
import { colorIssues, pageColors, type ColorIssueId } from '../lib/readableColors';

// «الأسلوب»: buttons, text and colours (the profile photo is in «الهوية», note 24). Laid out like
// Apple's Lock Screen / photo editor: the real page large on top, and below it
// a tray that shows the tools of one tab at a time — no scrolling.

const SIZES = [
  { id: 'small', label: 'صغير' },
  { id: 'medium', label: 'متوسط' },
  { id: 'large', label: 'كبير' },
] as const;

// Page-wide looks shared by every video, picture and item (templates, step 1).
const MEDIA_RADIUS_OPTIONS = [
  { id: 'none', label: 'بدون' },
  { id: 'small', label: 'خفيفة' },
  { id: 'medium', label: 'متوسطة' },
  { id: 'large', label: 'كبيرة' },
] as const;
const SPACING_OPTIONS = [
  { id: 'compact', label: 'متقاربة' },
  { id: 'normal', label: 'عادية' },
  { id: 'relaxed', label: 'واسعة' },
] as const;

const BUTTON_SHAPES = [
  { id: 'rounded', label: 'دائري' },
  { id: 'square', label: 'مربع' },
  { id: 'pill', label: 'بيضاوي' },
] as const;

const TOOL_TABS = [
  { id: 'buttons', label: 'الأزرار' },
  { id: 'text', label: 'النص والألوان' },
] as const;
type ToolTab = (typeof TOOL_TABS)[number]['id'];

// WCAG contrast of two #rrggbb colours (1 = same, 21 = black on white).
function contrast(a: string, b: string) {
  const lum = (color: string) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
    if (!hex) return null;
    const [r, g, bl] = [0, 2, 4].map((at) => { const c = parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return x === null || y === null ? 21 : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}


const BUTTON_ROWS: string[] = ['button', 'buttonText', 'icons'];
type TextSize = { key: 'nameSize' | 'bioSize' | 'headingSize' | 'paragraphSize'; px?: 'namePx' | 'bioPx' };
type ColorRowId = 'name' | 'bio' | 'link' | 'headings' | 'paragraphs' | 'button' | 'buttonText' | 'icons';

// Card that previews its own effect; the chosen one gets a dark outline.
function OptionCard({ active, onClick, label, children, compact = false }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-w-0 flex-col items-center justify-center rounded-2xl border-2 bg-white transition-all ${compact ? 'gap-1 px-1 py-2' : 'gap-2 p-2'} ${active ? 'border-[#111111] text-[#111111]' : 'border-[#E7E7E7] text-[#737373]'}`}>
      <span className="flex w-full items-center justify-center">{children}</span>
      <span className={`truncate font-bold ${compact ? 'text-[12px]' : 'text-[14px]'} ${active ? 'text-[#111111]' : 'text-[#262626]'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>{label}</span>
    </button>
  );
}

// One corner drawn at radius r, so the roundness is seen, not read.
function CornerGlyph({ r }: { r: number }) {
  return (
    <svg viewBox="0 0 28 28" className="h-8 w-8" fill="none" aria-hidden>
      <path d={`M6 24 V${6 + r} ${r ? `Q6 6 ${6 + r} 6` : ''} H24`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// A tiny photo (sky, sun, hills) with the chosen corner radius.
function MediaGlyph({ r }: { r: number }) {
  return (
    <svg viewBox="0 0 40 30" className="h-8 w-11" aria-hidden>
      <defs><clipPath id={`media-${r}`}><rect x="1" y="1" width="38" height="28" rx={r} /></clipPath></defs>
      <g clipPath={`url(#media-${r})`}>
        <rect width="40" height="30" fill="#c7dbf5" />
        <circle cx="29" cy="9" r="4" fill="#ffd60a" />
        <path d="M0 30 L13 14 L22 24 L28 18 L40 30 Z" fill="#16A34A" />
      </g>
      <rect x="1" y="1" width="38" height="28" rx={r} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

// The public page's sizes for each preset, so − / + start from what is shown.
const PX_LIMITS = {
  namePx: { min: 16, max: 56, presets: { small: 24, medium: 30, large: 36 } },
  bioPx: { min: 11, max: 24, presets: { small: 14, medium: 16, large: 18 } },
} as const;

const SHAPE_RADIUS = { square: 4, rounded: 10, pill: 999 } as const;

const FEATURED_FONTS: string[] = ['cairo', 'tajawal', 'amiri', 'reemkufi', 'messiri', 'lalezar'];
const FONT_FEEL: Record<string, string> = { cairo: 'واضح وعصري', tajawal: 'بسيط وخفيف', almarai: 'مرتب وسهل القراءة', plex: 'رسمي ونظيف', readex: 'حديث وناعم', amiri: 'كلاسيكي وأنيق', naskh: 'تقليدي ومقروء', markazi: 'صحفي وهادئ', kufi: 'هندسي ومتزن', reemkufi: 'كوفي مميز', changa: 'قوي وشبابي', messiri: 'ناعم وراقٍ', alexandria: 'أنيق وعصري', lalezar: 'عريض ولافت', lemonada: 'مرح وودود', ruqaa: 'خط يد تراثي' };

const COLOR_CHOICES = ['#111111', '#FFFFFF', '#6B7280', '#DC2626', '#FF6B2C', '#F59E0B', '#16A34A', '#2563EB', '#7C3AED', '#DB2777'];
const SHAPE_NAMES = { square: 'حادة', rounded: 'ناعمة', pill: 'دائرية' } as const;

// A small choice bar: every option is visible and one tap applies it.
function Choice<T extends string | boolean>({ label, value, options, onChange }: { label: string; value: T; options: readonly { id: T; label: string }[]; onChange: (id: T) => void }) {
  return <div className="text-sheet__size"><span>{label}</span><div role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    {options.map((option) => <button key={String(option.id)} type="button" role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
  </div></div>;
}

function ToolLabel({ children }: { children: string }) {
  return <p className="mb-2 text-[13px] font-bold text-[#737373]" style={{ fontFamily: 'Cairo, sans-serif' }}>{children}</p>;
}

export function StyleEditor({ initialTab = 'buttons', embedded = false, single = false, onBusyChange }: { onBusyChange?: (busy: boolean) => void; initialTab?: ToolTab | 'colors'; embedded?: boolean; single?: boolean } = {}) {
  const { pageData, updateButtonStyle, updateTypography, updatePageData } = usePageContext();
  const [tab, setTab] = useState<ToolTab>(initialTab === 'colors' ? 'text' : initialTab);
  // Editor phase 3: from the dock, «النص» holds font and sizes, «الألوان» every colour.
  const singleColors = single && initialTab === 'colors';
  const currentFont = pageData.typography?.font ?? 'cairo';

  // The fonts load only once the «النص» tab is opened.
  useEffect(() => {
    if (tab === 'text') FONT_OPTIONS.forEach((font) => loadFont(font.id));
  }, [tab]);
  const { buttonStyle } = pageData;
  const colors = pageData.customColors ?? {};
  const customFont = pageData.typography?.customFont;
  const customOn = customFontActive(pageData.typography);
  const [fontBusy, setFontBusy] = useState(false);
  useEffect(() => { onBusyChange?.(fontBusy); }, [fontBusy, onBusyChange]);
  // The owner's font leads the short list; it does not jump around while they try others.
  const [shortFonts] = useState(() => [currentFont, ...FEATURED_FONTS.filter(id => id !== currentFont)].slice(0, 6));
  const [fontError, setFontError] = useState('');
  useEffect(() => loadCustomFont(customFont?.url), [customFont?.url]);
  const buttonFill = buttonStyle.useCustomColor && buttonStyle.customColor ? buttonStyle.customColor : pageData.theme.buttonColor;
  const lowContrast = !!buttonStyle.textColor && !buttonStyle.border && contrast(buttonStyle.textColor, buttonFill) < 3;
  const hasHeadings = pageData.links.some((link) => link.display?.kind === 'heading');
  const hasParagraphs = pageData.links.some((link) => link.display?.kind === 'text');
  const [picking, setPicking] = useState<ColorRowId | null>(null);
  const [fontsOpen, setFontsOpen] = useState(false);
  const readable = pageColors(pageData);
  const issues = colorIssues(pageData);
  const textDefault = readable.text;
  const colorRows: { id: ColorRowId; label: string; sample: string; ltr?: boolean; size?: TextSize; value?: string; swatch: string; auto: boolean; set: (color: string | undefined) => void }[] = [
    { id: 'name' as const, size: { key: 'nameSize', px: 'namePx' } as TextSize, label: 'الاسم', sample: pageData.name || 'اسم صفحتك', value: colors.nameColor, set: (color: string | undefined) => setColors({ nameColor: color }) },
    { id: 'bio' as const, size: { key: 'bioSize', px: 'bioPx' } as TextSize, label: 'النبذة', sample: pageData.bio || 'النص التعريفي', value: colors.bioColor, set: (color: string | undefined) => setColors({ bioColor: color }) },
    { id: 'link' as const, label: 'رابط الصفحة', sample: pageData.username ? pageHost(pageData.username) : 'name.onwan.link', ltr: true, value: colors.usernameColor, set: (color: string | undefined) => setColors({ usernameColor: color }) },
    ...(hasHeadings ? [{ id: 'headings' as const, size: { key: 'headingSize' } as TextSize, label: 'عناوين المجموعات', sample: 'العناوين داخل الصفحة', value: colors.headingColor, set: (color: string | undefined) => setColors({ headingColor: color }) }] : []),
    ...(hasParagraphs ? [{ id: 'paragraphs' as const, size: { key: 'paragraphSize' } as TextSize, label: 'النصوص داخل الصفحة', sample: 'النصوص بين العناصر', value: colors.paragraphColor, set: (color: string | undefined) => setColors({ paragraphColor: color }) }] : []),
  ].map((row) => ({ ...row, swatch: row.value || textDefault, auto: !row.value }));
  colorRows.push(
    { id: 'button', label: 'لون الزر', sample: 'خلفية الأزرار', value: buttonStyle.useCustomColor ? buttonStyle.customColor : undefined, swatch: buttonFill, auto: !buttonStyle.useCustomColor, set: (color) => updateButtonStyle(color ? { useCustomColor: true, customColor: color } : { useCustomColor: false }) },
    { id: 'buttonText', label: 'كتابة الزر', sample: 'نصوص الأزرار', value: buttonStyle.textColor, swatch: readable.buttonText, auto: !buttonStyle.textColor, set: (textColor) => updateButtonStyle({ textColor }) },
    {
      id: 'icons',
      label: 'أيقونات الأزرار',
      sample: buttonStyle.iconColor === 'text' ? 'بلون نص الزر' : buttonStyle.iconColor === 'custom' ? 'لون مختار' : 'ألوانها الأصلية',
      value: buttonStyle.iconCustomColor,
      swatch: buttonStyle.iconColor === 'custom' && buttonStyle.iconCustomColor ? buttonStyle.iconCustomColor : buttonStyle.iconColor === 'text' ? buttonStyle.textColor || pageData.theme.buttonTextColor : 'conic-gradient(#ff0069, #ffd60a, #34c759, #0a84ff, #ff0069)',
      auto: buttonStyle.iconColor !== 'custom',
      set: (iconCustomColor) => updateButtonStyle({ iconColor: 'custom', iconCustomColor }),
    },
  );
  const current = colorRows.find((row) => row.id === picking);
  const FONT = customOn && customFont ? customFontFamily(customFont.url) : FONT_OPTIONS.find((font) => font.id === currentFont)?.family;
  const sizeLabel = (size: TextSize) => { const px = size.px ? pageData.typography?.[size.px] : undefined; return px ? `${px} px` : SIZES.find((option) => option.id === (pageData.typography?.[size.key] ?? 'medium'))?.label; };
  const setColors = (next: Partial<NonNullable<PageData['customColors']>>) => updatePageData({ customColors: { ...colors, ...next } });

  // Page colours first: the ones drawn from the owner's own photo, then a short clear set.
  const colorChoices = [...new Set([...(pageData.extractedColors ?? []).filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 4).map((color) => color.toUpperCase()), ...COLOR_CHOICES])];
  // Each colour opens in place, so the page stays visible while trying colours.
  const colorList = (rows: typeof colorRows) => <div className="text-sheet__card">
    {rows.map((row) => {
      const open = picking === row.id;
      const isIcons = row.id === 'icons';
      const iconMode = buttonStyle.iconColor ?? 'brand';
      const chosen = !row.auto && (!isIcons || iconMode === 'custom') ? row.swatch.toUpperCase() : '';
      const status = isIcons ? (iconMode === 'brand' ? 'ألوانها الأصلية' : iconMode === 'text' ? 'نفس لون الكتابة' : 'لون مختار') : row.auto ? 'من الثيم' : 'لون مختار';
      return <div className="color-list__row" key={row.id}>
        <button type="button" className="color-list__head" aria-expanded={open} onClick={() => setPicking(open ? null : row.id)}>
          <i style={{ background: row.swatch }} aria-hidden="true" />
          <span><b>{row.label}</b><small>{status}</small></span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        {issues[row.id as ColorIssueId] && <div className="color-list__warning" role="status"><span>قد يصعب على زوارك قراءته</span><button type="button" onClick={() => row.set(issues[row.id as ColorIssueId])}>اجعله مقروءًا</button></div>}
        {open && <div className="color-list__panel">
          {isIcons
            ? <div className="color-list__modes">
                <button type="button" aria-pressed={iconMode === 'brand'} onClick={() => updateButtonStyle({ iconColor: 'brand' })}>ألوانها الأصلية</button>
                <button type="button" aria-pressed={iconMode === 'text'} onClick={() => updateButtonStyle({ iconColor: 'text' })}>نفس لون الكتابة</button>
              </div>
            : <div className="color-list__modes"><button type="button" aria-pressed={row.auto} onClick={() => row.set(undefined)}>لون الثيم</button></div>}
          <div className="color-list__swatches" role="group" aria-label={`اختيار ${row.label}`}>
            <label className={chosen && !colorChoices.includes(chosen) ? 'is-active' : ''} style={chosen && !colorChoices.includes(chosen) ? { background: chosen } : undefined}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(row.swatch) ? row.swatch : '#000000'} onChange={(event) => row.set(event.target.value)} aria-label={`لون آخر لـ ${row.label}`} />
            </label>
            {colorChoices.map((color) => <button key={color} type="button" aria-label={color} aria-pressed={chosen === color} style={{ background: color }} onClick={() => row.set(color)}>{chosen === color && <Check size={16} strokeWidth={3} color={contrast(color, '#FFFFFF') < 3 ? '#111111' : '#FFFFFF'} aria-hidden="true" />}</button>)}
          </div>
        </div>}
      </div>;
    })}
  </div>;

  return (
    <div className={`flex flex-col bg-[#F5F5F3] ${single ? 'style-editor--single' : ''} ${embedded ? '' : 'h-full min-h-[560px]'}`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
      {/* On desktop the big preview already sits beside the panel. */}
      {/* The free height decides the phone's size (its width follows from the
          aspect ratio), so the preview can never grow over the tool tray. */}
      {!embedded && <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-hidden px-4 py-3 lg:hidden">
        <div className="aspect-[390/862] h-full max-h-[480px] max-w-full"><PhonePreview /></div>
      </div>}

      {/* Note 25: the tray keeps one height on every tab, so the preview above
          never jumps or slides under the controls; long tabs scroll inside. */}
      <div className={single ? 'flex flex-col bg-white' : 'flex shrink-0 flex-col rounded-t-[24px] bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.06)] lg:rounded-none lg:shadow-none'}>
        {/* Editor phase 2: a tool opened from the dock is its own sheet, with no inner tabs or card. */}
        {!single && <div className="px-4 pb-3 pt-3.5">
          <Segmented large options={TOOL_TABS} value={tab} onChange={(id) => setTab(id as ToolTab)} />
        </div>}

        <div className={single ? 'space-y-5 px-4 pb-6 pt-2' : 'h-[280px] space-y-4 overflow-y-auto overscroll-contain px-4 pb-6 pt-1 lg:h-auto lg:overflow-visible'}>
          {tab === 'buttons' && single && (
            <div className="text-sheet">
              <section>
                <h3>شكل الزر</h3>
                <div className="button-shapes" role="radiogroup" aria-label="حواف الزر">
                  {BUTTON_SHAPES.map((shape) => <button key={shape.id} type="button" role="radio" aria-checked={buttonStyle.shape === shape.id} onClick={() => updateButtonStyle({ shape: shape.id })}>
                    <i style={{ borderRadius: SHAPE_RADIUS[shape.id], background: buttonStyle.border ? 'transparent' : buttonFill, border: buttonStyle.border ? `2px solid ${buttonFill}` : 0 }} aria-hidden="true" />
                    {SHAPE_NAMES[shape.id]}
                  </button>)}
                </div>
                <div className="text-sheet__card mt-2">
                  <Choice label="التعبئة" value={!!buttonStyle.border} options={[{ id: false, label: 'ممتلئ' }, { id: true, label: 'إطار فقط' }]} onChange={(border) => updateButtonStyle({ border })} />
                  <Choice label="الظل" value={!!buttonStyle.shadow} options={[{ id: false, label: 'بدون' }, { id: true, label: 'مع ظل' }]} onChange={(shadow) => updateButtonStyle({ shadow })} />
                  {!buttonStyle.border && <label className="button-opacity"><span>الشفافية</span><input type="range" min="30" max="100" step="5" value={buttonStyle.opacity ?? 100} onChange={(e) => updateButtonStyle({ opacity: Number(e.target.value) })} aria-label="شفافية الزر" /><small dir="ltr">{buttonStyle.opacity ?? 100}%</small></label>}
                </div>
              </section>
              <section>
                <h3>ألوان الزر</h3>
                {colorList(colorRows.filter((row) => BUTTON_ROWS.includes(row.id)))}
                
              </section>
              <section>
                <h3>باقي الصفحة</h3>
                <div className="text-sheet__card">
                  <Choice label="المسافات" value={buttonStyle.spacing ?? 'normal'} options={SPACING_OPTIONS} onChange={(spacing) => updateButtonStyle({ spacing })} />
                  <Choice label="حواف الصور" value={buttonStyle.mediaRadius ?? 'medium'} options={MEDIA_RADIUS_OPTIONS} onChange={(mediaRadius) => updateButtonStyle({ mediaRadius })} />
                </div>
              </section>
            </div>
          )}

          {tab === 'buttons' && !single && (
            <>
              {/* Visual choices, like a style sheet: each card shows what it does. */}
              <section>
                <ToolLabel>نمط الزر</ToolLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {([[false, 'ممتلئ'], [true, 'حواف فقط']] as const).map(([border, label]) => (
                    <OptionCard key={label} active={!!buttonStyle.border === border} onClick={() => updateButtonStyle({ border })} label={label}>
                      <span className="flex h-14 w-full items-center justify-center rounded-xl bg-[#D4D4D4]">
                        <span className={`h-7 w-[64%] ${border ? 'border-2 border-white' : 'bg-white'}`} style={{ borderRadius: SHAPE_RADIUS[buttonStyle.shape as keyof typeof SHAPE_RADIUS] ?? 10 }} />
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section>
                <ToolLabel>استدارة الزر</ToolLabel>
                <div className="grid grid-cols-3 gap-2.5">
                  {BUTTON_SHAPES.map((shape) => (
                    <OptionCard key={shape.id} active={buttonStyle.shape === shape.id} onClick={() => updateButtonStyle({ shape: shape.id })} label={shape.label}>
                      <CornerGlyph r={{ square: 0, rounded: 6, pill: 14 }[shape.id]} />
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section>
                <ToolLabel>ظل الزر</ToolLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {([[false, 'بدون ظل'], [true, 'مع ظل']] as const).map(([shadow, label]) => (
                    <OptionCard key={label} active={!!buttonStyle.shadow === shadow} onClick={() => updateButtonStyle({ shadow })} label={label}>
                      <span className="flex h-14 w-full items-center justify-center rounded-xl bg-[#ececf0]">
                        <span className="h-7 w-[64%] bg-white" style={{ borderRadius: SHAPE_RADIUS[buttonStyle.shape as keyof typeof SHAPE_RADIUS] ?? 10, boxShadow: shadow ? '0 6px 12px rgba(0,0,0,0.28)' : 'none' }} />
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </section>

              {!buttonStyle.border && (
                <section>
                  <ToolLabel>شفافية لون الزر</ToolLabel>
                  <div className="rounded-2xl bg-[#F5F5F3] p-3">
                    {/* Live sample: the page background shows through the button's colour; its text stays solid. */}
                    <div className="flex h-16 items-center justify-center rounded-xl" style={{ background: `repeating-linear-gradient(45deg, ${pageData.theme.textColor}22 0 8px, transparent 8px 16px), ${pageData.theme.background || '#ffffff'}` }}>
                      <span className="flex h-9 w-[70%] items-center justify-center text-sm font-bold" style={{ borderRadius: SHAPE_RADIUS[buttonStyle.shape as keyof typeof SHAPE_RADIUS] ?? 10, backgroundColor: `color-mix(in srgb, ${buttonFill} ${buttonStyle.opacity ?? 100}%, transparent)`, color: buttonStyle.textColor || pageData.theme.buttonTextColor, fontFamily: 'Cairo, sans-serif' }}>نص الزر</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="shrink-0 text-xs text-[#737373]">شفاف</span>
                      <input type="range" min="30" max="100" step="5" value={buttonStyle.opacity ?? 100} onChange={(e) => updateButtonStyle({ opacity: Number(e.target.value) })} className="min-w-0 flex-1 accent-[#FF6B2C]" aria-label="شفافية لون الزر" />
                      <span className="shrink-0 text-xs text-[#737373]">ممتلئ</span>
                    </div>
                    <p className="mt-2 text-xs text-[#737373]">تُظهر خلفية صفحتك من خلف الزر، والنص يبقى واضحاً.</p>
                  </div>
                </section>
              )}

              {(
              <section>
                <ToolLabel>ألوان الزر</ToolLabel>
                <div className="divide-y divide-[#E7E7E7] overflow-hidden rounded-2xl bg-[#F5F5F3]">
                  {colorRows.filter((row) => BUTTON_ROWS.includes(row.id)).map((row) => (
                    <button key={row.id} type="button" onClick={() => setPicking(row.id)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-right active:bg-[#E7E7E7]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-[#111111]">{row.label}</span>
                        <span className="block truncate text-xs text-[#737373]">{row.auto ? 'تلقائي' : row.sample}</span>
                      </span>
                      <span className="h-7 w-7 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: row.swatch }} aria-label={`اللون الحالي ${row.swatch}`} />
                    </button>
                  ))}
                </div>
                {lowContrast && <p role="status" className="mt-2 rounded-lg bg-[#ff9500]/12 px-3 py-2 text-xs text-[#9a5b00]">لون نص الزر قريب من لون الزر، وقد يصعب على زوارك قراءته.</p>}
              </section>
              )}

              <section>
                <ToolLabel>استدارة الصور والفيديو</ToolLabel>
                <div className="grid grid-cols-4 gap-2">
                  {MEDIA_RADIUS_OPTIONS.map((option) => (
                    <OptionCard key={option.id} compact active={(buttonStyle.mediaRadius ?? 'medium') === option.id} onClick={() => updateButtonStyle({ mediaRadius: option.id })} label={option.label}>
                      <MediaGlyph r={{ none: 0, small: 3, medium: 6, large: 10 }[option.id]} />
                    </OptionCard>
                  ))}
                </div>
              </section>

              <section>
                <ToolLabel>المسافات بين العناصر</ToolLabel>
                <div className="grid grid-cols-3 gap-2">
                  {SPACING_OPTIONS.map((option, index) => (
                    <OptionCard key={option.id} compact active={(buttonStyle.spacing ?? 'normal') === option.id} onClick={() => updateButtonStyle({ spacing: option.id })} label={option.label}>
                      <span className="flex h-8 w-10 flex-col justify-center" style={{ gap: 2 + index * 3 }}>
                        {[0, 1, 2].map((bar) => <span key={bar} className="h-1.5 rounded-full bg-current" />)}
                      </span>
                    </OptionCard>
                  ))}
                </div>
              </section>
            </>
          )}

          {singleColors && (
            <div className="text-sheet">
              <section><h3>النصوص</h3>{colorList(colorRows.filter((row) => !BUTTON_ROWS.includes(row.id)))}</section>
              <section><h3>الأزرار</h3>{colorList(colorRows.filter((row) => BUTTON_ROWS.includes(row.id)))}</section>
            </div>
          )}

          {tab === 'text' && single && !singleColors && (
            <div className="text-sheet">
              <section>
                <h3>حجم الكتابة</h3>
                <div className="text-sheet__card">
                  {colorRows.filter((row) => row.id === 'name' || row.id === 'bio').map((row) => {
                    const size = row.size!;
                    const exact = size.px ? pageData.typography?.[size.px] : undefined;
                    const chosen = exact ? '' : (pageData.typography?.[size.key] ?? 'medium');
                    const title = row.id === 'name' ? 'اسمك' : 'النبذة';
                    return <div className="text-sheet__size" key={row.id}>
                      <span>{title}</span>
                      <div role="radiogroup" aria-label={`حجم ${title}`}>
                        {SIZES.map((option) => <button key={option.id} type="button" role="radio" aria-checked={chosen === option.id} onClick={() => updateTypography({ [size.key]: option.id, ...(size.px ? { [size.px]: undefined } : {}) })}>{option.label}</button>)}
                      </div>
                    </div>;
                  })}
                </div>
              </section>
              <section>
                <h3>شكل الخط</h3>
                <div className="text-sheet__card">
                  {shortFonts.map((id) => {
                    const font = FONT_OPTIONS.find((item) => item.id === id);
                    if (!font) return null;
                    const active = !customOn && currentFont === font.id;
                    return <button key={font.id} type="button" className="text-sheet__font" aria-pressed={active} onClick={() => updateTypography({ font: font.id, useCustomFont: false })}>
                      <span><b style={{ fontFamily: font.family }}>أهلًا بك في صفحتي</b><small>{FONT_FEEL[font.id]}</small></span>
                      {active && <Check size={20} strokeWidth={2.6} aria-hidden="true" />}
                    </button>;
                  })}
                  <button type="button" className="text-sheet__font text-sheet__more" onClick={() => setFontsOpen(true)}><span><b>عرض كل الخطوط</b></span><ChevronLeft size={19} aria-hidden="true" /></button>
                </div>
                {fontError && <p role="alert" className="mt-2 text-xs text-[#DC2626]">{fontError}</p>}
              </section>
            </div>
          )}

          {tab === 'text' && !single && (
            <>
              <section>
                <ToolLabel>الخط</ToolLabel>
                {/* One row with the current font; the full list opens on tap. */}
                <button type="button" onClick={() => setFontsOpen(true)} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-[#F5F5F3] px-4 text-right active:bg-[#E7E7E7]">
                  <span className="min-w-0 flex-1 truncate text-[18px] font-bold text-[#111111]" style={{ fontFamily: FONT }}>{customOn && customFont ? customFont.name : FONT_OPTIONS.find((font) => font.id === currentFont)?.name}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#737373]" />
                </button>
                {fontError && <p role="alert" className="mt-2 text-xs text-[#DC2626]">{fontError}</p>}
              </section>

              <section>
                <ToolLabel>{single ? 'أحجام النص' : 'عناصر الصفحة'}</ToolLabel>
                {/* One row per part: tap it to set its size and colour together. */}
                <div className="divide-y divide-[#E7E7E7] overflow-hidden rounded-2xl bg-[#F5F5F3]">
                  {colorRows.filter((row) => (single ? Boolean(row.size) : !BUTTON_ROWS.includes(row.id))).map((row) => (
                    <button key={row.id} type="button" onClick={() => setPicking(row.id)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-right active:bg-[#E7E7E7]">
                      {!single && <span className="h-7 w-7 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: row.swatch }} aria-label={`اللون الحالي ${row.swatch}`} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-bold text-[#111111]" dir={row.ltr ? 'ltr' : undefined} style={{ fontFamily: FONT, ...(row.ltr ? { textAlign: 'right' } : {}) }}>{row.sample}</span>
                        <span className="block text-xs text-[#737373]">{row.label}{row.size ? ` · ${sizeLabel(row.size)}` : ''}{!single && row.auto ? ' · لون تلقائي' : ''}</span>
                      </span>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-[#D4D4D4]" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {current && !single && createPortal(
        // Light backdrop: the preview stays visible and changes as colours are tapped.
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/10 sm:items-center" onClick={() => setPicking(null)} dir="rtl">
          <section role="dialog" aria-modal="true" aria-label={`لون ${current.label}`} onClick={(event) => event.stopPropagation()} className="max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] bg-white px-5 pb-7 pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:rounded-[26px]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ background: current.swatch }} />
                <span className="text-[17px] font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>{current.label}</span>
              </span>
              <button type="button" onClick={() => setPicking(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F3] text-[#525252]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            {current.size && !singleColors && (() => {
              const size = current.size;
              const chosen = size.px && pageData.typography?.[size.px] ? null : (pageData.typography?.[size.key] ?? 'medium');
              return (
                <div className="mb-5">
                  <ToolLabel>الحجم</ToolLabel>
                  <div className="grid grid-cols-3 gap-2.5">
                    {SIZES.map((option, index) => (
                      <OptionCard key={option.id} active={chosen === option.id} onClick={() => updateTypography({ [size.key]: option.id, ...(size.px ? { [size.px]: undefined } : {}) })} label={option.label}>
                        <span className="flex h-10 items-end font-black leading-none" style={{ fontFamily: FONT, fontSize: 16 + index * 8 }}>أ</span>
                      </OptionCard>
                    ))}
                  </div>
                  {size.px && (() => {
                    const px = size.px;
                    const limits = PX_LIMITS[px];
                    const value = pageData.typography?.[px] ?? limits.presets[pageData.typography?.[size.key] ?? 'medium'];
                    const set = (next: number) => updateTypography({ [px]: Math.min(limits.max, Math.max(limits.min, next)) });
                    return (
                      <div className="mt-3 flex min-h-[52px] items-center gap-3 rounded-2xl bg-[#F5F5F3] px-4">
                        <span className="min-w-0 flex-1 text-[15px] text-[#111111]">حجم دقيق</span>
                        <div className="flex shrink-0 items-center rounded-[10px] bg-white p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]" dir="ltr">
                          <button type="button" onClick={() => set(value - 1)} disabled={value <= limits.min} aria-label="تصغير" className="h-9 w-9 rounded-[8px] text-lg leading-none text-[#111111] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]">−</button>
                          <span className={`w-14 text-center text-xs font-bold ${chosen ? 'text-[#737373]' : 'text-[#C2410C]'}`}>{value} px</span>
                          <button type="button" onClick={() => set(value + 1)} disabled={value >= limits.max} aria-label="تكبير" className="h-9 w-9 rounded-[8px] text-lg leading-none text-[#111111] active:bg-[#F5F5F3] disabled:text-[#D4D4D4]">+</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            {current.size && !single && <ToolLabel>اللون</ToolLabel>}
            {current.id === 'icons' && (
              <div className="mb-4">
                <Segmented options={[{ id: 'brand', label: 'ألوانها الأصلية' }, { id: 'text', label: 'بلون النص' }, { id: 'custom', label: 'لون آخر' }] as const} value={buttonStyle.iconColor ?? 'brand'} onChange={(iconColor) => updateButtonStyle({ iconColor, ...(iconColor === 'custom' && !buttonStyle.iconCustomColor ? { iconCustomColor: '#000000' } : {}) })} />
              </div>
            )}
            {(!single || singleColors) && (current.id !== 'icons' || buttonStyle.iconColor === 'custom') && (
              <>
                {/* Two choices only: follow the theme, or pick any colour. */}
                <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={`لون ${current.label}`}>
                  {current.id !== 'icons' && (
                    <button type="button" role="radio" aria-checked={current.auto} onClick={() => current.set(undefined)} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border-2 bg-white px-3 ${current.auto ? 'border-[#111111]' : 'border-[#E7E7E7]'}`}>
                      <span className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: current.auto ? current.swatch : textDefault }} />
                      <span className="text-[15px] font-bold text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>تلقائي</span>
                    </button>
                  )}
                  <label className={`relative flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-3 ${!current.auto ? 'border-[#111111]' : 'border-[#E7E7E7]'} ${current.id === 'icons' ? 'col-span-2' : ''}`}>
                    <span className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: current.auto ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : current.swatch }} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>{current.auto ? 'اختيار لون' : 'لون مخصص'}</span>
                      {!current.auto && <span className="block text-xs text-[#737373]" dir="ltr" style={{ textAlign: 'right' }}>{current.swatch.toUpperCase()}</span>}
                    </span>
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(current.swatch) ? current.swatch : '#000000'} onChange={(event) => current.set(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="اختيار لون" />
                  </label>
                </div>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
      {fontsOpen && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/10 sm:items-center" onClick={() => setFontsOpen(false)} dir="rtl">
          <section role="dialog" aria-modal="true" aria-label="الخط" onClick={(event) => event.stopPropagation()} className="flex max-h-[55dvh] w-full max-w-md flex-col rounded-t-[26px] bg-white pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:rounded-[26px]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <div className="mb-3 flex items-center justify-between px-5">
              <span className="text-[17px] font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>الخط</span>
              <button type="button" onClick={() => setFontsOpen(false)} className="h-9 rounded-full bg-[#111111] px-5 text-[15px] font-bold text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>تم</button>
            </div>
            {/* Tapping a font applies it to the preview above and keeps the list open, so fonts can be compared. */}
            <div ref={(el) => { if (el && !el.dataset.scrolled) { el.dataset.scrolled = '1'; el.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' }); } }} className="overflow-y-auto overscroll-contain px-5 pb-7">
              <div className="divide-y divide-[#E7E7E7] overflow-hidden rounded-2xl bg-[#F5F5F3]">
                    <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 px-4 ${fontBusy ? 'text-[#737373]' : 'text-[#C2410C]'}`}>
                      <span className="w-6 text-center text-xl font-bold">{fontBusy ? '…' : '+'}</span>
                      <span className="text-[15px] font-bold">{fontBusy ? 'جارٍ الرفع' : 'رفع خط مخصص'}</span>
                      <input type="file" accept=".ttf,.otf,.woff2,.woff" className="sr-only" disabled={fontBusy} aria-label="رفع خط مخصص" onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        setFontBusy(true);
                        setFontError('');
                        uploadFont(file)
                          .then((font) => { loadCustomFont(font.url); updateTypography({ customFont: font, useCustomFont: true }); })
                          .catch((error) => setFontError(error instanceof Error ? error.message : 'تعذّر رفع الخط.'))
                          .finally(() => setFontBusy(false));
                      }} />
                    </label>
                {[...(customFont ? [{ id: 'custom', name: customFont.name, family: customFontFamily(customFont.url) }] : []), ...FONT_OPTIONS].map((font) => {
                  const active = font.id === 'custom' ? customOn : !customOn && currentFont === font.id;
                  return (
                    <button key={font.id} type="button" onClick={() => { updateTypography(font.id === 'custom' ? { useCustomFont: true } : { font: font.id as typeof currentFont, useCustomFont: false }); }} aria-pressed={active} className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-1.5 text-right active:bg-[#E7E7E7] ${active ? 'bg-[#111111]/5' : ''}`}>
                      <span className="min-w-0 flex-1">
                        {/* the entity's own name, so they see their name in each font */}
                        <span className="block truncate text-[18px] font-bold leading-snug text-[#111111]" style={{ fontFamily: font.family }}>{pageData.name.trim() || 'اسم الجهة'}</span>
                        {/* body text too: some fonts suit titles but tire in paragraphs */}
                        <span className="block truncate text-[13px] leading-snug text-[#525252]" style={{ fontFamily: font.family }}>{pageData.bio?.trim() || 'نص تعريفي قصير عن الجهة'}</span>
                        <span className="block text-[11px] text-[#737373]" dir="ltr" style={{ textAlign: 'right' }}>{font.name}</span>
                      </span>
                      {active && <Check className="h-5 w-5 shrink-0 text-[#C2410C]" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
              {customFont && <button type="button" onClick={() => updateTypography({ customFont: undefined, useCustomFont: undefined })} className="mt-3 text-sm text-[#DC2626]">حذف الخط المخصص</button>}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
