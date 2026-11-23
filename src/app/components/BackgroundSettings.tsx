import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowLeftRight, Blend, Camera, Check, Image as ImageIcon, Minus, Palette, Plus, Trash2, Upload, Video } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { colorIssues, readableFix } from '../lib/readableColors';
import { createWallpaperVariants } from '../lib/wallpaperVariants';
import { VideoWallpaperEditor } from './VideoWallpaperEditor';
import './backgroundSettings.css';

const SUGGESTED = ['#ff6b2c', '#111827', '#1f2937', '#334155', '#104b3b', '#78350f', '#ffffff'];
const GRADIENTS = ['linear-gradient(170deg, #ffb057 0%, #f2643d 52%, #c42f6b 100%)', 'linear-gradient(175deg, #38bfc2 0%, #0f6e84 55%, #0a3f5c 100%)', 'linear-gradient(165deg, #27335c 0%, #141a2e 62%, #0c1020 100%)', 'linear-gradient(180deg, #2f6a55 0%, #173a2e 100%)', 'linear-gradient(180deg, #fbf3e8 0%, #eed9bf 100%)', 'linear-gradient(180deg, #fdeef0 0%, #f6c6d0 100%)', 'linear-gradient(135deg, #a5f3fc 0%, #6366f1 100%)', 'linear-gradient(135deg, #d9f99d 0%, #10b981 100%)'];
const TABS = [{ id: 'colors', label: 'لون', Icon: Palette }, { id: 'gradient', label: 'تدرج', Icon: Blend }, { id: 'photo', label: 'صورة', Icon: ImageIcon }, { id: 'video', label: 'فيديو', Icon: Video }] as const;
type Tab = typeof TABS[number]['id'];
const DIRECTIONS = [{ angle: 180, label: 'من الأعلى', Icon: ArrowDown }, { angle: 270, label: 'من اليمين', Icon: ArrowLeft }, { angle: 225, label: 'مائل يمين', Icon: ArrowDownLeft }, { angle: 135, label: 'مائل يسار', Icon: ArrowDownRight }];
const buildGradient = (angle: number, from: string, to: string) => `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
// Reads the first and last colours of any stored gradient, so editing starts from what is showing.
function readGradient(value: string) {
  const colors = value.match(/#[0-9a-f]{6}/gi);
  const angle = Number(value.match(/(-?\d+)deg/)?.[1] ?? 180);
  return { angle: DIRECTIONS.some(item => item.angle === angle) ? angle : 180, from: colors?.[0] ?? '#ff6b2c', to: colors?.[colors.length - 1] ?? '#111111' };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function BackgroundSettings({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const { pageData, updatePageData, updateWallpaper } = usePageContext();
  const hardToRead = Object.keys(colorIssues(pageData)).length > 0;
  const wallpaper = pageData.wallpaper;
  const [tab, setTab] = useState<Tab>(() => wallpaper.type === 'image' ? 'photo' : wallpaper.type === 'video' ? 'video' : wallpaper.type === 'gradient' ? 'gradient' : 'colors');
  const [hex, setHex] = useState(wallpaper.type === 'color' ? wallpaper.value : '#ffffff');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const request = useRef(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  useEffect(() => { onBusyChange?.(busy || videoBusy); }, [busy, videoBusy, onBusyChange]);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => { if (wallpaper.type === 'color') setHex(wallpaper.value); }, [wallpaper.type, wallpaper.value]);
  const gradient = readGradient(wallpaper.type === 'gradient' ? wallpaper.value : GRADIENTS[0]);
  const setGradient = (next: Partial<typeof gradient>) => { const merged = { ...gradient, ...next }; setError(''); updateWallpaper({ type: 'gradient', value: buildGradient(merged.angle, merged.from, merged.to) }); };
  const solid = wallpaper.type === 'color' ? wallpaper.value : undefined;
  const extracted = [...new Set((pageData.extractedColors || []).filter(value => /^#[a-f0-9]{6}$/i.test(value)))].slice(0, 8);
  const selectColor = (value: string) => { setError(''); setHex(value); updateWallpaper({ type: 'color', value }); };
  const setPhoto = (changes: Partial<typeof wallpaper>) => updateWallpaper({ ...wallpaper, ...changes });
  const pickPhoto = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('اختر صورة PNG أو JPG أو WebP.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('حجم الصورة كبير جدًا. الحد الأقصى 8MB.'); return; }
    const id = ++request.current;
    setBusy(true); setError('');
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('تعذّر قراءة الصورة.')); reader.readAsDataURL(file);
      });
      const versions = await createWallpaperVariants(source);
      if (id === request.current) updateWallpaper({ type: 'image', ...versions, fit: 'cover', positionX: 50, positionY: 50, zoom: 1, dim: wallpaper.dim ?? 0, fileName: file.name, fileSize: file.size });
    } catch (problem) { if (id === request.current) setError(problem instanceof Error ? problem.message : 'تعذّر تجهيز الصورة.'); }
    finally { if (id === request.current) setBusy(false); }
  };
  const fileInput = (capture: boolean) => <input ref={capture ? camera : gallery} type="file" aria-label={capture ? 'التقاط صورة للخلفية' : 'اختيار صورة الخلفية'} accept="image/png,image/jpeg,image/webp" capture={capture ? 'environment' : undefined} hidden disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void pickPhoto(file); }} />;
  const swatches = (values: string[], square = false) => <div className={`background-settings__swatches${square ? ' is-square' : ''}`}>{values.map(value => <button key={value} type="button" aria-label={`لون ${value}`} aria-pressed={solid?.toLowerCase() === value.toLowerCase()} onClick={() => selectColor(value)}><span style={{ background: value }}>{solid?.toLowerCase() === value.toLowerCase() && <Check size={19} aria-hidden="true" style={{ color: value.toLowerCase() === '#ffffff' ? '#111111' : '#fff' }} />}</span></button>)}</div>;
  return <div className="background-settings">
    {hardToRead && <div className="background-settings__readable" role="status"><span>بعض الألوان اللي اخترتها صعبة القراءة على هذه الخلفية</span><button type="button" onClick={() => updatePageData(readableFix(pageData))}>اجعلها مقروءة</button></div>}
    <p className="background-settings__intro">خصّص خلفيتك وشاهد النتيجة مباشرة</p>
    <div className="background-settings__tabs" role="tablist" aria-label="نوع الخلفية">{TABS.map(({ id, label, Icon }, index) => <button ref={node => { tabs.current[index] = node; }} key={id} id={`background-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`background-panel-${id}`} tabIndex={tab === id ? 0 : -1} disabled={busy || videoBusy} onClick={() => setTab(id)} onKeyDown={event => {
      const next = event.key === 'ArrowLeft' ? (index + 1) % TABS.length : event.key === 'ArrowRight' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
      if (next !== null) { event.preventDefault(); setTab(TABS[next].id); tabs.current[next]?.focus(); }
    }}><Icon size={19} aria-hidden="true" />{label}</button>)}</div>
    <section id="background-panel-colors" role="tabpanel" aria-labelledby="background-tab-colors" hidden={tab !== 'colors'}>
      <div className="background-settings__section"><h3>ألوان مقترحة</h3>{swatches(SUGGESTED)}</div>
      <div className="background-settings__card"><h3>ألوان مستخرجة من شعارك</h3>{extracted.length ? swatches(extracted, true) : <p>أضف صورتك أو شعارك من «الصورة والاسم» لتظهر ألوانه هنا.</p>}</div>
      <div className="background-settings__section"><h3>لون مخصص</h3><div className="background-settings__custom-color"><input type="color" aria-label="اختيار لون مخصص" value={solid && /^#[a-f0-9]{6}$/i.test(solid) ? solid : '#ffffff'} onChange={event => selectColor(event.target.value)} /><label dir="ltr"><span>HEX</span><input aria-label="رمز لون الخلفية HEX" value={hex} maxLength={7} spellCheck={false} onChange={event => { setHex(event.target.value); if (/^#[a-f0-9]{6}$/i.test(event.target.value)) selectColor(event.target.value); }} onBlur={() => { if (!/^#[a-f0-9]{6}$/i.test(hex)) { setHex(solid || '#ffffff'); setError('اكتب لونًا بصيغة #RRGGBB.'); } }} /></label></div></div>
    </section>
    <section id="background-panel-gradient" role="tabpanel" aria-labelledby="background-tab-gradient" hidden={tab !== 'gradient'}>
      <div className="background-settings__builder">
        <h3>صمّم تدرجك</h3>
        <div className="background-settings__builder-preview" style={{ background: buildGradient(gradient.angle, gradient.from, gradient.to) }} aria-hidden="true" />
        <div className="background-settings__builder-colors">
          <label><input type="color" value={gradient.from} onChange={event => setGradient({ from: event.target.value })} aria-label="اللون الأول" /><span><b>اللون الأول</b><small dir="ltr">{gradient.from.toUpperCase()}</small></span></label>
          <button type="button" aria-label="تبديل اللونين" onClick={() => setGradient({ from: gradient.to, to: gradient.from })}><ArrowLeftRight size={18} /></button>
          <label><input type="color" value={gradient.to} onChange={event => setGradient({ to: event.target.value })} aria-label="اللون الثاني" /><span><b>اللون الثاني</b><small dir="ltr">{gradient.to.toUpperCase()}</small></span></label>
        </div>
        <div className="background-settings__directions" role="group" aria-label="اتجاه التدرج">{DIRECTIONS.map(({ angle, label, Icon }) => <button type="button" key={angle} aria-pressed={gradient.angle === angle} onClick={() => setGradient({ angle })}><Icon size={18} aria-hidden="true" />{label}</button>)}</div>
      </div>
      <h3 className="background-settings__presets-title">أو اختر تدرجًا جاهزًا</h3>
      <div className="background-settings__gradients">{GRADIENTS.map((value, index) => <button key={value} type="button" aria-label={`تدرج ${index + 1}`} aria-pressed={wallpaper.type === 'gradient' && wallpaper.value === value} style={{ background: value }} onClick={() => { setError(''); updateWallpaper({ type: 'gradient', value }); }}>{wallpaper.type === 'gradient' && wallpaper.value === value && <Check size={18} aria-hidden="true" />}</button>)}</div>
    </section>
    <section id="background-panel-photo" role="tabpanel" aria-labelledby="background-tab-photo" hidden={tab !== 'photo'}>
      {fileInput(false)}{fileInput(true)}
      <div className="background-settings__card">
        {wallpaper.type === 'image' ? <div className="background-settings__media-summary"><img src={wallpaper.preview || wallpaper.value} alt="صورة الخلفية الحالية" /><div><h3 dir="auto">{wallpaper.fileName || 'صورة الخلفية الحالية'}</h3><p>{wallpaper.fileSize ? `${(wallpaper.fileSize / 1024 / 1024).toFixed(1)} MB · ` : ''}معاينة محسّنة للجوال</p></div><button type="button" className="background-settings__delete" aria-label="إزالة صورة الخلفية" disabled={busy} onClick={() => updateWallpaper({ type: 'color', value: pageData.theme.background })}><Trash2 size={19} /></button></div> : <p>اختر صورة من جهازك لتجربتها كخلفية.</p>}
        <div className="background-settings__actions"><button type="button" disabled={busy} onClick={() => gallery.current?.click()}><Upload size={18} />{busy ? 'جارٍ التجهيز…' : wallpaper.type === 'image' ? 'استبدال من المعرض' : 'اختيار من المعرض'}</button><button type="button" disabled={busy} onClick={() => camera.current?.click()}><Camera size={18} />التقاط صورة</button></div>
      </div>
      {wallpaper.type === 'image' && <>
        <div className="background-settings__section"><h3>ملاءمة الصورة</h3><div className="background-settings__choices" role="group" aria-label="ملاءمة صورة الخلفية">{[{ id: 'cover', label: 'ملء الشاشة' }, { id: 'contain', label: 'احتواء كامل' }, { id: 'tile', label: 'تكرار' }].map(item => <button key={item.id} type="button" aria-pressed={(wallpaper.fit || 'cover') === item.id} onClick={() => setPhoto({ fit: item.id as 'cover' | 'contain' | 'tile' })}>{item.label}</button>)}</div></div>
        <div className="background-settings__card"><h3>نسبة التقريب <span dir="ltr">{Math.round((wallpaper.zoom || 1) * 100)}%</span></h3><div className="background-settings__zoom"><button type="button" aria-label="تصغير خلفية الصورة" onClick={() => setPhoto({ zoom: clamp((wallpaper.zoom || 1) - .1, 1, 3) })}><Minus size={18} /></button><input type="range" aria-label="تقريب خلفية الصورة" min={1} max={3} step={.05} value={wallpaper.zoom || 1} onChange={event => setPhoto({ zoom: Number(event.target.value) })} /><button type="button" aria-label="تكبير خلفية الصورة" onClick={() => setPhoto({ zoom: clamp((wallpaper.zoom || 1) + .1, 1, 3) })}><Plus size={18} /></button></div></div>
        <div className="background-settings__section"><h3>نقطة التركيز والمحاذاة</h3><div className="background-settings__choices" role="group" aria-label="محاذاة خلفية الصورة">{[{ id: 'top', label: 'أعلى', y: 0 }, { id: 'center', label: 'وسط', y: 50 }, { id: 'bottom', label: 'أسفل', y: 100 }].map(item => <button key={item.id} type="button" aria-pressed={(wallpaper.positionY ?? 50) === item.y} onClick={() => setPhoto({ position: item.id as 'top' | 'center' | 'bottom', positionY: item.y })}>{item.label}</button>)}</div></div>
        <div className="background-settings__card"><h3>تعتيم الخلفية لقراءة أوضح <span>{wallpaper.dim || 0}%</span></h3><input type="range" aria-label="تعتيم خلفية الصورة" min={0} max={80} step={5} value={wallpaper.dim || 0} onChange={event => setPhoto({ dim: Number(event.target.value) })} /></div>
      </>}
    </section>
    <section id="background-panel-video" role="tabpanel" aria-labelledby="background-tab-video" hidden={tab !== 'video'}><VideoWallpaperEditor modern active={tab === 'video'} onBusyChange={setVideoBusy} /></section>
    {error && <p className="background-settings__error" role="alert">{error}</p>}
  </div>;
}
