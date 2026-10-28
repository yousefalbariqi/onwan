import { useEffect, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { BUTTON_LIMITS, buttonMetrics } from '../lib/buttonSizes';
import { Segmented, Toggle } from './ios';
import { pageHost } from '../lib/site';
import { FONT_OPTIONS, PageData, usePageContext } from '../context/PageContext';
import { customFontActive, customFontFamily, loadCustomFont, loadFont } from '../lib/fonts';
import { uploadFont } from '../lib/fontUpload';
import { PhonePreview } from './PhonePreview';

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
  { id: 'text', label: 'النص' },
  { id: 'colors', label: 'الألوان' },
] as const;
type ToolTab = (typeof TOOL_TABS)[number]['id'];

const WEIGHTS = [
  { id: 'normal', label: 'عادي' },
  { id: 'medium', label: 'متوسط' },
  { id: 'bold', label: 'عريض' },
] as const;

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

// − value + in pixels, within the bounds that keep the button intact.
function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 text-sm text-[#1d1d1f]">{label}</span>
      <div className="flex shrink-0 items-center rounded-[10px] bg-white p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]" dir="ltr">
        <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`تصغير ${label}`} className="h-9 w-9 rounded-[8px] text-lg leading-none text-[#1d1d1f] active:bg-[#f2f2f7] disabled:text-[#c7c7cc]">−</button>
        <span className="w-14 text-center text-xs font-bold text-[#0a84ff]">{value} px</span>
        <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`تكبير ${label}`} className="h-9 w-9 rounded-[8px] text-lg leading-none text-[#1d1d1f] active:bg-[#f2f2f7] disabled:text-[#c7c7cc]">+</button>
      </div>
    </div>
  );
}

// The ready colours of the picker (note 49): neutrals, then the system hues.
const PALETTE = ['#000000', '#3a3a3c', '#8e8e93', '#ffffff', '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#5856d6', '#af52de', '#ff2d55', '#a2845e', '#1e3a8a', '#065f46', '#7c2d12'];

type ColorRowId = 'name' | 'bio' | 'link' | 'headings' | 'paragraphs' | 'button' | 'buttonText' | 'icons';

function ToolLabel({ children }: { children: string }) {
  return <p className="mb-2 text-[13px] font-bold text-[#6e6e73]" style={{ fontFamily: 'Cairo, sans-serif' }}>{children}</p>;
}

function Scroller({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>;
}

export function StyleEditor() {
  const { pageData, updateButtonStyle, updateTypography, updatePageData } = usePageContext();
  const [tab, setTab] = useState<ToolTab>('buttons');
  const currentFont = pageData.typography?.font ?? 'cairo';

  // The fonts load only once the «النص» tab is opened.
  useEffect(() => {
    if (tab === 'text') FONT_OPTIONS.forEach((font) => loadFont(font.id));
  }, [tab]);
  const { buttonStyle } = pageData;
  const colors = pageData.customColors ?? {};
  const [fineOpen, setFineOpen] = useState(false);
  const customFont = pageData.typography?.customFont;
  const customOn = customFontActive(pageData.typography);
  const [fontBusy, setFontBusy] = useState(false);
  const [fontError, setFontError] = useState('');
  useEffect(() => loadCustomFont(customFont?.url), [customFont?.url]);
  const metrics = buttonMetrics(buttonStyle);
  const exactSizes = buttonStyle.heightPx !== undefined || buttonStyle.fontPx !== undefined || buttonStyle.iconPx !== undefined;
  const buttonFill = buttonStyle.useCustomColor && buttonStyle.customColor ? buttonStyle.customColor : pageData.theme.buttonColor;
  const lowContrast = !!buttonStyle.textColor && !buttonStyle.border && contrast(buttonStyle.textColor, buttonFill) < 3;
  const hasHeadings = pageData.links.some((link) => link.display?.kind === 'heading');
  const hasParagraphs = pageData.links.some((link) => link.display?.kind === 'text');
  const [picking, setPicking] = useState<ColorRowId | null>(null);
  const textDefault = pageData.theme.textColor;
  const colorRows: { id: ColorRowId; label: string; sample: string; ltr?: boolean; value?: string; swatch: string; auto: boolean; set: (color: string | undefined) => void }[] = [
    { id: 'name' as const, label: 'الاسم', sample: pageData.name || 'اسم صفحتك', value: colors.nameColor, set: (color: string | undefined) => setColors({ nameColor: color }) },
    { id: 'bio' as const, label: 'الوصف', sample: pageData.bio || 'النص التعريفي', value: colors.bioColor, set: (color: string | undefined) => setColors({ bioColor: color }) },
    { id: 'link' as const, label: 'رابط الصفحة', sample: pageData.username ? pageHost(pageData.username) : 'name.onwan.link', ltr: true, value: colors.usernameColor, set: (color: string | undefined) => setColors({ usernameColor: color }) },
    ...(hasHeadings ? [{ id: 'headings' as const, label: 'عناوين المجموعات', sample: 'العناوين داخل الصفحة', value: colors.headingColor, set: (color: string | undefined) => setColors({ headingColor: color }) }] : []),
    ...(hasParagraphs ? [{ id: 'paragraphs' as const, label: 'النبذات', sample: 'النصوص بين العناصر', value: colors.paragraphColor, set: (color: string | undefined) => setColors({ paragraphColor: color }) }] : []),
  ].map((row) => ({ ...row, swatch: row.value || textDefault, auto: !row.value }));
  colorRows.push(
    { id: 'button', label: 'لون الزر', sample: 'خلفية الأزرار', value: buttonStyle.useCustomColor ? buttonStyle.customColor : undefined, swatch: buttonFill, auto: !buttonStyle.useCustomColor, set: (color) => updateButtonStyle(color ? { useCustomColor: true, customColor: color } : { useCustomColor: false }) },
    { id: 'buttonText', label: 'نص الزر', sample: 'نصوص الأزرار', value: buttonStyle.textColor, swatch: buttonStyle.textColor || (buttonStyle.border ? buttonFill : pageData.theme.buttonTextColor), auto: !buttonStyle.textColor, set: (textColor) => updateButtonStyle({ textColor }) },
    {
      id: 'icons',
      label: 'الشعارات',
      sample: buttonStyle.iconColor === 'text' ? 'بلون نص الزر' : buttonStyle.iconColor === 'custom' ? 'لون مختار' : 'ألوانها الأصلية',
      value: buttonStyle.iconCustomColor,
      swatch: buttonStyle.iconColor === 'custom' && buttonStyle.iconCustomColor ? buttonStyle.iconCustomColor : buttonStyle.iconColor === 'text' ? buttonStyle.textColor || pageData.theme.buttonTextColor : 'conic-gradient(#ff0069, #ffd60a, #34c759, #0a84ff, #ff0069)',
      auto: buttonStyle.iconColor !== 'custom',
      set: (iconCustomColor) => updateButtonStyle({ iconColor: 'custom', iconCustomColor }),
    },
  );
  const current = colorRows.find((row) => row.id === picking);
  const setColors = (next: Partial<NonNullable<PageData['customColors']>>) => updatePageData({ customColors: { ...colors, ...next } });

  return (
    <div className="flex h-full min-h-[560px] flex-col bg-[#f2f2f7]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      {/* On desktop the big preview already sits beside the panel. */}
      {/* The free height decides the phone's size (its width follows from the
          aspect ratio), so the preview can never grow over the tool tray. */}
      <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-hidden px-4 py-3 lg:hidden">
        <div className="aspect-[390/862] h-full max-h-[480px] max-w-full"><PhonePreview /></div>
      </div>

      {/* Note 25: the tray keeps one height on every tab, so the preview above
          never jumps or slides under the controls; long tabs scroll inside. */}
      <div className="flex shrink-0 flex-col rounded-t-[24px] bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.06)] lg:rounded-none lg:shadow-none">
        <div className="px-4 pb-3 pt-3.5">
          <Segmented large options={TOOL_TABS} value={tab} onChange={(id) => setTab(id as ToolTab)} />
        </div>

        <div className="h-[280px] space-y-4 overflow-y-auto overscroll-contain px-4 pb-6 pt-1 lg:h-auto lg:overflow-visible">
          {tab === 'buttons' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><ToolLabel>الشكل</ToolLabel><Segmented options={BUTTON_SHAPES} value={buttonStyle.shape as (typeof BUTTON_SHAPES)[number]['id']} onChange={(shape) => updateButtonStyle({ shape: shape as (typeof BUTTON_SHAPES)[number]['id'] })} /></div>
                {/* A preset size replaces any exact size set below. */}
                <div><ToolLabel>الحجم</ToolLabel><Segmented options={SIZES} value={exactSizes ? ('' as never) : buttonStyle.size ?? 'medium'} onChange={(size) => updateButtonStyle({ size: size as (typeof SIZES)[number]['id'], heightPx: undefined, fontPx: undefined, iconPx: undefined })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><ToolLabel>استدارة الصور والفيديو</ToolLabel><Segmented options={MEDIA_RADIUS_OPTIONS} value={buttonStyle.mediaRadius ?? 'medium'} onChange={(mediaRadius) => updateButtonStyle({ mediaRadius })} /></div>
                <div><ToolLabel>المسافات بين العناصر</ToolLabel><Segmented options={SPACING_OPTIONS} value={buttonStyle.spacing ?? 'normal'} onChange={(spacing) => updateButtonStyle({ spacing })} /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex flex-1 items-center justify-between rounded-xl bg-[#f2f2f7] px-3 py-2 text-sm text-[#1d1d1f]">حواف فقط<Toggle label="حواف فقط" on={!!buttonStyle.border} onChange={() => updateButtonStyle({ border: !buttonStyle.border })} /></label>
                <label className="flex flex-1 items-center justify-between rounded-xl bg-[#f2f2f7] px-3 py-2 text-sm text-[#1d1d1f]">الظل<Toggle label="الظل" on={!!buttonStyle.shadow} onChange={() => updateButtonStyle({ shadow: !buttonStyle.shadow })} /></label>
              </div>
              {!buttonStyle.border && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#1d1d1f]">الشفافية</span>
                  <input type="range" min="30" max="100" step="5" value={buttonStyle.opacity ?? 100} onChange={(e) => updateButtonStyle({ opacity: Number(e.target.value) })} className="flex-1 accent-[#0a84ff]" />
                  <span className="w-10 text-left text-sm text-[#8e8e93]" dir="ltr">{buttonStyle.opacity ?? 100}%</span>
                </div>
              )}

              {/* Note 34: exact sizes wait behind one row until asked for. */}
              <div className="rounded-2xl bg-[#f2f2f7]">
                <button type="button" aria-expanded={fineOpen} onClick={() => setFineOpen(!fineOpen)} className="flex min-h-11 w-full items-center justify-between px-3 text-sm font-bold text-[#1d1d1f]">
                  تحكم دقيق بالحجم
                  <ChevronDown className={`h-4 w-4 text-[#8e8e93] transition-transform ${fineOpen ? 'rotate-180' : ''}`} />
                </button>
                {fineOpen && (
                  <div className="space-y-2.5 px-3 pb-3">
                    <Stepper label="ارتفاع الزر" value={metrics.height} min={BUTTON_LIMITS.height.min} max={BUTTON_LIMITS.height.max} step={2} onChange={(heightPx) => updateButtonStyle({ heightPx })} />
                    <Stepper label="حجم النص" value={metrics.font} min={BUTTON_LIMITS.font.min} max={Math.min(BUTTON_LIMITS.font.max, Math.floor(metrics.height * 0.5))} onChange={(fontPx) => updateButtonStyle({ fontPx })} />
                    <Stepper label="حجم الشعار" value={metrics.icon} min={BUTTON_LIMITS.icon.min} max={Math.min(BUTTON_LIMITS.icon.max, metrics.height - 12)} step={2} onChange={(iconPx) => updateButtonStyle({ iconPx })} />
                    <div className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-sm text-[#1d1d1f]">سماكة النص</span>
                      <div className="min-w-0 flex-1"><Segmented options={WEIGHTS} value={buttonStyle.fontWeight ?? ('' as never)} onChange={(fontWeight) => updateButtonStyle({ fontWeight })} /></div>
                    </div>
                    {(exactSizes || buttonStyle.fontWeight) && (
                      <button type="button" onClick={() => updateButtonStyle({ heightPx: undefined, fontPx: undefined, iconPx: undefined, fontWeight: undefined })} className="text-xs text-[#0a84ff]">العودة إلى الحجم الجاهز</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'text' && (
            <>
              <div>
                <ToolLabel>الخط</ToolLabel>
                <div>
                  <Scroller>
                    {/* Note (9): the page's own font, uploaded — first in the row. */}
                    {customFont && (
                      <button type="button" aria-pressed={customOn} onClick={() => updateTypography({ useCustomFont: true })} className={`w-[104px] shrink-0 rounded-2xl border-2 px-2 py-2.5 text-center transition-all ${customOn ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}>
                        <span className="block truncate text-lg font-bold text-[#1d1d1f]" style={{ fontFamily: customFontFamily(customFont.url) }}>{pageData.name.trim() || 'اسم الجهة'}</span>
                        <span className="block truncate text-[10px] text-[#8e8e93]">{customFont.name}</span>
                      </button>
                    )}
                    <label className={`flex w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-2 py-2.5 text-center ${fontBusy ? 'border-[#c7c7cc] text-[#8e8e93]' : 'border-[#0a84ff]/40 text-[#0a84ff]'}`}>
                      <span className="text-lg font-bold">{fontBusy ? '…' : '+'}</span>
                      <span className="text-[11px] font-bold">{fontBusy ? 'جارٍ الرفع' : 'رفع خط مخصص'}</span>
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
                    {FONT_OPTIONS.map((font) => {
                      const active = !customOn && currentFont === font.id;
                      return (
                        <button key={font.id} onClick={() => updateTypography({ font: font.id, useCustomFont: false })} className={`w-[104px] shrink-0 rounded-2xl border-2 px-2 py-2.5 text-center transition-all ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}>
                          {/* the entity's own name, so they see their name in each font */}
                          <span className="block truncate text-lg font-bold text-[#1d1d1f]" style={{ fontFamily: font.family }}>{pageData.name.trim() || 'اسم الجهة'}</span>
                          <span className="block text-[10px] text-[#8e8e93]" dir="ltr">{font.name}</span>
                        </button>
                      );
                    })}
                  </Scroller>
                </div>
                {fontError && <p role="alert" className="mt-2 text-xs text-[#ff3b30]">{fontError}</p>}
                {customFont && <button type="button" onClick={() => updateTypography({ customFont: undefined, useCustomFont: undefined })} className="mt-2 text-xs text-[#ff3b30]">حذف الخط المخصص</button>}
              </div>
              <div>
                <ToolLabel>الحجم</ToolLabel>
                <div className="space-y-2">
                  {([
                    { key: 'nameSize', px: 'namePx', label: 'الاسم', min: 16, max: 56, presets: { small: 24, medium: 30, large: 36 } },
                    { key: 'bioSize', px: 'bioPx', label: 'الوصف', min: 11, max: 24, presets: { small: 14, medium: 16, large: 18 } },
                  ] as const).map((text) => {
                    const preset = pageData.typography?.[text.key] ?? pageData.typography?.size ?? 'medium';
                    const exact = pageData.typography?.[text.px];
                    // The public page's pixel size for the chosen preset, so − / + start from what is shown.
                    const current = exact ?? text.presets[preset];
                    const step = (delta: number) => updateTypography({ [text.px]: Math.min(text.max, Math.max(text.min, current + delta)) });
                    return (
                      <div key={text.key} className="flex items-center gap-2">
                        <span className="w-11 shrink-0 text-sm text-[#1d1d1f]">{text.label}</span>
                        <div className="min-w-0 flex-1">
                          <Segmented
                            options={SIZES}
                            value={exact ? ('' as never) : preset}
                            onChange={(size) => updateTypography({ [text.key]: size as (typeof SIZES)[number]['id'], [text.px]: undefined })}
                          />
                        </div>
                        <div className="flex shrink-0 items-center rounded-[10px] bg-[#e9e9ee] p-0.5" dir="ltr">
                          <button onClick={() => step(-1)} disabled={current <= text.min} aria-label={`تصغير ${text.label}`} className="h-7 w-7 rounded-[8px] text-lg leading-none text-[#1d1d1f] active:bg-white disabled:text-[#c7c7cc]">−</button>
                          <span className={`w-9 text-center text-xs font-bold ${exact ? 'text-[#0a84ff]' : 'text-[#6e6e73]'}`}>{current}</span>
                          <button onClick={() => step(1)} disabled={current >= text.max} aria-label={`تكبير ${text.label}`} className="h-7 w-7 rounded-[8px] text-lg leading-none text-[#1d1d1f] active:bg-white disabled:text-[#c7c7cc]">+</button>
                        </div>
                      </div>
                    );
                  })}
                  {([{ key: 'headingSize', label: 'العناوين' }, { key: 'paragraphSize', label: 'النصوص' }] as const).map((text) => (
                    <div key={text.key} className="flex items-center gap-2">
                      <span className="w-11 shrink-0 text-sm text-[#1d1d1f]">{text.label}</span>
                      <div className="min-w-0 flex-1"><Segmented options={SIZES} value={pageData.typography?.[text.key] ?? 'medium'} onChange={(size) => updateTypography({ [text.key]: size as (typeof SIZES)[number]['id'] })} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'colors' && (
            <>
              {/* Note 49: one short list — each part with its current colour;
                  the palette opens only for the row that is tapped. */}
              <div className="-mx-1 divide-y divide-[#e5e5ea] overflow-hidden rounded-2xl bg-[#f2f2f7]">
                {colorRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => setPicking(row.id)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-right active:bg-[#e5e5ea]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-[#1d1d1f]">{row.label}</span>
                      <span className="block truncate text-xs text-[#8e8e93]" dir={row.ltr ? 'ltr' : undefined} style={row.ltr ? { textAlign: 'right' } : undefined}>{row.sample}</span>
                    </span>
                    {row.auto && <span className="shrink-0 text-xs text-[#8e8e93]">تلقائي</span>}
                    <span className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: row.swatch }} aria-label={`اللون الحالي ${row.swatch}`} />
                  </button>
                ))}
              </div>
              {lowContrast && <p role="status" className="rounded-lg bg-[#ff9500]/12 px-3 py-2 text-xs text-[#9a5b00]">لون نص الزر قريب من لون الزر، وقد يصعب على زوارك قراءته.</p>}
            </>
          )}
        </div>
      </div>

      {current && (
        // Light backdrop: the preview stays visible and changes as colours are tapped.
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/10 sm:items-center" onClick={() => setPicking(null)} dir="rtl">
          <section role="dialog" aria-modal="true" aria-label={`لون ${current.label}`} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-[26px] bg-white px-5 pb-7 pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] sm:rounded-[26px]" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ background: current.swatch }} />
                <span className="text-[17px] font-black text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>{current.label}</span>
              </span>
              <button type="button" onClick={() => setPicking(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f7] text-[#55555b]" aria-label="إغلاق"><X className="h-5 w-5" /></button>
            </div>
            {current.id === 'icons' && (
              <div className="mb-4">
                <Segmented options={[{ id: 'brand', label: 'ألوانها الأصلية' }, { id: 'text', label: 'بلون النص' }, { id: 'custom', label: 'لون آخر' }] as const} value={buttonStyle.iconColor ?? 'brand'} onChange={(iconColor) => updateButtonStyle({ iconColor, ...(iconColor === 'custom' && !buttonStyle.iconCustomColor ? { iconCustomColor: '#000000' } : {}) })} />
              </div>
            )}
            {(current.id !== 'icons' || buttonStyle.iconColor === 'custom') && (
              <>
                <div className="grid grid-cols-6 gap-3" role="radiogroup" aria-label="الألوان الجاهزة">
                  {current.id !== 'icons' && (
                    <button type="button" role="radio" aria-checked={current.auto} onClick={() => current.set(undefined)} className={`flex aspect-square items-center justify-center rounded-full bg-[#f2f2f7] text-[10px] font-bold text-[#3a3a3c] ${current.auto ? 'ring-2 ring-[#0a84ff] ring-offset-2' : ''}`}>تلقائي</button>
                  )}
                  {PALETTE.map((color) => {
                    const active = !current.auto && current.value?.toLowerCase() === color;
                    return (
                      <button key={color} type="button" role="radio" aria-checked={active} aria-label={color} onClick={() => current.set(color)} className={`relative aspect-square rounded-full ring-1 ring-black/10 ${active ? 'ring-2 ring-[#0a84ff] ring-offset-2' : ''}`} style={{ backgroundColor: color }}>
                        {active && <Check className={`absolute inset-0 m-auto h-4 w-4 ${['#ffffff', '#f2f2f7', '#ffd60a', '#fffc00'].includes(color) ? 'text-black' : 'text-white'}`} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
                {/* «كل الألوان»: the system's full picker for any colour. */}
                <label className="mt-5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#f2f2f7] text-[15px] font-bold text-[#0a84ff]">
                  <span className="h-5 w-5 rounded-full" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                  كل الألوان
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(current.swatch) ? current.swatch : '#000000'} onChange={(event) => current.set(event.target.value)} className="sr-only" />
                </label>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
