import { useEffect, useState } from 'react';
import { ColorDots, Segmented, Toggle } from './ios';
import { FONT_OPTIONS, PageData, usePageContext } from '../context/PageContext';
import { loadFont } from '../lib/fonts';
import { PhonePreview } from './PhonePreview';

// «الأسلوب»: buttons, text and colours (the profile photo is in «الهوية», note 24). Laid out like
// Apple's Lock Screen / photo editor: the real page large on top, and below it
// a tray that shows the tools of one tab at a time — no scrolling.

const SIZES = [
  { id: 'small', label: 'صغير' },
  { id: 'medium', label: 'متوسط' },
  { id: 'large', label: 'كبير' },
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
                <div><ToolLabel>الحجم</ToolLabel><Segmented options={SIZES} value={buttonStyle.size ?? 'medium'} onChange={(size) => updateButtonStyle({ size: size as (typeof SIZES)[number]['id'] })} /></div>
              </div>
              <div>
                <ToolLabel>لون الشعارات</ToolLabel>
                <Segmented
                  options={[{ id: 'brand', label: 'ملوّنة' }, { id: 'text', label: 'بلون النص' }] as const}
                  value={buttonStyle.iconColor ?? 'brand'}
                  onChange={(iconColor) => updateButtonStyle({ iconColor: iconColor as 'brand' | 'text' })}
                />
              </div>
              <div>
                <ToolLabel>اللون</ToolLabel>
                <ColorDots value={buttonStyle.useCustomColor ? buttonStyle.customColor : undefined} onChange={(color) => updateButtonStyle(color ? { useCustomColor: true, customColor: color } : { useCustomColor: false })} />
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
            </>
          )}

          {tab === 'text' && (
            <>
              <div>
                <ToolLabel>الخط</ToolLabel>
                <div>
                  <Scroller>
                    {FONT_OPTIONS.map((font) => {
                      const active = currentFont === font.id;
                      return (
                        <button key={font.id} onClick={() => updateTypography({ font: font.id })} className={`w-[104px] shrink-0 rounded-2xl border-2 px-2 py-2.5 text-center transition-all ${active ? 'border-[#0a84ff] bg-[#0a84ff]/5' : 'border-transparent bg-[#f2f2f7]'}`}>
                          {/* the entity's own name, so they see their name in each font */}
                          <span className="block truncate text-lg font-bold text-[#1d1d1f]" style={{ fontFamily: font.family }}>{pageData.name.trim() || 'اسم الجهة'}</span>
                          <span className="block text-[10px] text-[#8e8e93]" dir="ltr">{font.name}</span>
                        </button>
                      );
                    })}
                  </Scroller>
                </div>
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
                </div>
              </div>
            </>
          )}

          {tab === 'colors' && (
            <>
              <div><ToolLabel>الاسم والوصف معًا</ToolLabel><ColorDots value={colors.nameColor === colors.bioColor ? colors.nameColor : undefined} onChange={(color) => setColors({ nameColor: color, bioColor: color })} /></div>
              <div><ToolLabel>الاسم</ToolLabel><ColorDots value={colors.nameColor} onChange={(color) => setColors({ nameColor: color })} /></div>
              <div><ToolLabel>الوصف</ToolLabel><ColorDots value={colors.bioColor} onChange={(color) => setColors({ bioColor: color })} /></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
