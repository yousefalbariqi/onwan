import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Play, RefreshCw, Trash2, Video, X } from 'lucide-react';
import { backgroundVideoFileError } from '../../../shared/videoSources';
import { uploadBackgroundVideo } from '../lib/videoUpload';
import { PageData, usePageContext } from '../context/PageContext';
import { Group, Row, Segmented } from './ios';

const POSTER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_POSTER_SIZE = 2 * 1024 * 1024;

const formatSize = (bytes?: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '');

// The first frame of a chosen video, as the poster shown before it plays.
export function captureFirstFrame(src: string, seconds = .1) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    let settled = false;
    const timeout = window.setTimeout(() => done(), 8000);
    const done = (value?: string) => { if (settled) return; settled = true; window.clearTimeout(timeout); video.onerror = null; video.onloadeddata = null; video.onseeked = null; video.removeAttribute('src'); video.load(); resolve(value); };
    video.onerror = () => done();
    video.onloadeddata = () => { video.currentTime = Math.max(.01, Math.min(seconds, Math.max(.01, (video.duration || 1) - .01))); };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        done();
      }
    };
    video.src = src;
  });
}

// Note 30: the background video in a phone frame — the poster first, then the
// silent looping video over it; if the video cannot play, the poster stays.
function VideoPreview({ src, poster, position, dim, compact = false, playing = true, onDuration }: { src: string; poster?: string; position: string; dim: number; compact?: boolean; playing?: boolean; onDuration?: (duration: number) => void }) {
  const [failed, setFailed] = useState(false);
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (playing) void element.current?.play().catch(() => undefined); else element.current?.pause(); }, [playing, src]);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="relative block aspect-[9/19] w-36 overflow-hidden rounded-[26px] bg-[#111111] shadow-[0_10px_24px_rgba(15,23,42,0.2)]" style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: position } : undefined}>
      {!failed && <video ref={element} key={src} onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) onDuration?.(event.currentTarget.duration); }} src={src} poster={poster} muted loop autoPlay={playing} playsInline preload="metadata" aria-label="معاينة فيديو الخلفية" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />}
      {!!dim && <span className="absolute inset-0 bg-black" style={{ opacity: Math.min(dim, 80) / 100 }} />}
      {!compact && <span className="absolute inset-x-0 top-3 text-center text-sm font-bold text-white/90 drop-shadow" dir="ltr">9:41</span>}
      {failed && <span className="absolute inset-x-2 bottom-3 rounded-lg bg-black/60 px-2 py-1 text-center text-[11px] text-white">{poster ? 'تظهر الصورة البديلة' : 'تعذّر تشغيل الفيديو'}</span>}
    </span>
  );
}

export function VideoWallpaperEditor({ onBusyChange, modern = false, active = true }: { onBusyChange?: (busy: boolean) => void; modern?: boolean; active?: boolean } = {}) {
  const { pageData, updateWallpaper, videoUploadToken } = usePageContext();
  const current = pageData.wallpaper;
  const latestWallpaper = useRef(current); latestWallpaper.current = current;
  const isVideo = current.type === 'video';
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [frameOpen, setFrameOpen] = useState(false);
  const [frameTime, setFrameTime] = useState(.1);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const posterRequest = useRef(0);
  useEffect(() => () => { posterRequest.current++; }, []);
  useEffect(() => { onBusyChange?.(uploading || posterBusy); }, [uploading, posterBusy, onBusyChange]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'uploading' | 'processing'>('uploading');
  const [error, setError] = useState('');
  const upload = useRef<AbortController | null>(null);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const position = current.position ?? 'center';
  const dim = isVideo ? current.dim ?? 20 : 20;
  // Every setting applies straight to the page, like the rest of the editor,
  // so «احفظ تعديلاتي» saves exactly what the preview shows.
  const setVideo = (changes: Partial<PageData['wallpaper']>) => updateWallpaper({ ...latestWallpaper.current, ...changes });

  // The upload runs on even if this panel closes, and the video lands in the
  // draft when it finishes; only «إلغاء» stops it.
  const start = async (selected: File, preview: string) => {
    const controller = new AbortController();
    upload.current = controller;
    setUploading(true);
    setProgress(0);
    setError('');
    const posterPromise = captureFirstFrame(preview);
    try {
      setPhase('uploading');
      const value = await uploadBackgroundVideo(selected, setProgress, controller.signal, videoUploadToken, setPhase);
      const poster = await posterPromise;
      if (controller.signal.aborted) return;
      updateWallpaper({ type: 'video', value, poster, posterFromVideo: Boolean(poster), position, dim, uploaded: true, fileName: selected.name, fileSize: selected.size });
      setFile(null);
      setLocalPreview('');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'تعذّر رفع الفيديو.');
    } finally {
      if (upload.current === controller) {
        upload.current = null;
        setUploading(false);
      }
    }
  };

  const choose = (selected: File) => {
    const problem = backgroundVideoFileError(selected);
    if (problem) { setError(problem); return; }
    upload.current?.abort();
    posterRequest.current++; setDuration(0); setPlaying(false); setFrameTime(.1); setFrameOpen(false);
    const preview = URL.createObjectURL(selected);
    setFile(selected);
    setLocalPreview(preview);
    void start(selected, preview);
  };

  const cancel = () => {
    upload.current?.abort();
    upload.current = null;
    setUploading(false);
    setFile(null);
    setLocalPreview('');
  };

  const pickPoster = (selected: File) => {
    if (!POSTER_TYPES.includes(selected.type) || selected.size > MAX_POSTER_SIZE) {
      setError('اختر صورة PNG أو JPG أو WebP بحجم أقل من 2MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    const id = ++posterRequest.current; setPosterBusy(true);
    reader.onload = () => { if (id !== posterRequest.current) return; setVideo({ poster: String(reader.result), posterFromVideo: false }); setPosterBusy(false); };
    reader.onerror = () => { if (id !== posterRequest.current) return; setError('تعذّر قراءة الصورة. حاول مجددًا.'); setPosterBusy(false); };
    reader.readAsDataURL(selected);
  };

  const videoInput = (
    <input type="file" aria-label="اختيار فيديو الخلفية" accept="video/mp4,video/webm" className="sr-only" onChange={(event) => {
      const selected = event.target.files?.[0];
      event.target.value = '';
      if (selected) choose(selected);
    }} />
  );

  const src = localPreview || (isVideo ? current.value : '');
  const name = file?.name || (isVideo ? current.fileName : '');
  const size = formatSize(file?.size || (isVideo ? current.fileSize : undefined));

  const extractPoster = async () => {
    const id = ++posterRequest.current;
    setPosterBusy(true); setError('');
    const poster = await captureFirstFrame(src, frameTime);
    if (id !== posterRequest.current) return;
    if (poster) { setVideo({ poster, posterFromVideo: true }); setFrameOpen(false); }
    else setError('تعذّر استخراج الإطار. جرّب لحظة أخرى أو اختر صورة بديلة.');
    setPosterBusy(false);
  };
  if (modern) return <div className="background-settings__video">
    <div className="background-settings__card">
      <h3>فيديو الخلفية {src && <span className={uploading ? '' : 'background-settings__ready'}>{uploading ? phase === 'processing' ? 'جارٍ التجهيز' : 'جارٍ الرفع' : file ? 'بانتظار إعادة المحاولة' : 'جاهز'}</span>}</h3>
      {src ? <>
        <div className="background-settings__media-summary">
          <div className="background-settings__video-preview"><VideoPreview src={src} poster={isVideo ? current.poster : undefined} position={position} dim={dim} compact playing={active && playing} onDuration={setDuration} /><button type="button" aria-label={playing ? 'إيقاف معاينة الفيديو' : 'تشغيل معاينة الفيديو'} aria-pressed={playing} onClick={() => setPlaying(!playing)}><Play size={18} /></button></div>
          <div><p className="background-settings__filename" dir="auto">{name || 'فيديو الخلفية الحالي'}</p><p>{size}{duration ? ` · ${Math.round(duration)} ثانية` : ''}</p><p>صامت · يتكرر تلقائيًا</p></div>
          {!uploading && <button type="button" className="background-settings__delete" aria-label="إزالة فيديو الخلفية" disabled={posterBusy} onClick={() => { cancel(); updateWallpaper(current.poster ? { type: 'image', value: current.poster, dim } : { type: 'color', value: pageData.theme.background }); }}><Trash2 size={19} /></button>}
        </div>
      </> : <p>اختر فيديو MP4 أو WebM حتى 20 MB. يُستخرج له غلاف تلقائيًا من بدايته.</p>}
      <div className="background-settings__actions"><label className={uploading || posterBusy ? 'is-disabled' : ''}><RefreshCw size={18} />{src ? 'استبدال الفيديو' : 'اختيار فيديو'}{!uploading && !posterBusy && videoInput}</label></div>
      {uploading && <div role="status"><p>{phase === 'processing' ? 'جارٍ تجهيز الفيديو للعرض…' : `جارٍ الرفع ${progress}%`}</p><progress value={progress} max={100} /><button type="button" className="background-settings__text-button" onClick={cancel}>إلغاء الرفع</button></div>}
      {error && <div className="background-settings__error" role="alert">{error}{file && !uploading && <button type="button" onClick={() => void start(file, localPreview)}>إعادة المحاولة</button>}</div>}
    </div>
    {isVideo && !file && <>
      <div className="background-settings__card"><h3>صورة البداية / البديلة {current.posterFromVideo && <span>مستخرجة تلقائيًا</span>}</h3>
        <div className="background-settings__media-summary">{current.poster ? <img src={current.poster} alt="صورة البداية المستخرجة من الفيديو" /> : <ImageIcon size={36} />}<p>تظهر قبل تشغيل الفيديو، وعند تعذّر تحميله أو تفعيل «تقليل الحركة».</p></div>
        <div className="background-settings__actions"><button type="button" disabled={posterBusy} aria-expanded={frameOpen} onClick={() => setFrameOpen(!frameOpen)}>{current.poster ? 'تغيير الإطار' : 'استخراج صورة البداية'}</button>{current.poster && <button type="button" disabled={posterBusy} className="background-settings__danger" onClick={() => setVideo({ poster: undefined, posterFromVideo: undefined })}>إزالة البديل</button>}</div>
        {frameOpen && <div className="background-settings__frame-picker"><label>الإطار عند {frameTime.toFixed(1)} ثانية<input type="range" min={0} max={Math.max(.1, duration || 60)} step={.1} value={frameTime} disabled={posterBusy} onChange={event => setFrameTime(Number(event.target.value))} /></label><button type="button" disabled={posterBusy} onClick={() => void extractPoster()}>{posterBusy ? 'جارٍ استخراج الإطار…' : 'استخدام هذا الإطار'}</button><label className="background-settings__text-button">اختيار صورة بديلة من الجهاز<input type="file" accept={POSTER_TYPES.join(',')} className="sr-only" disabled={posterBusy} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (selected) pickPoster(selected); }} /></label></div>}
      </div>
      <div className="background-settings__card"><h3>ضبط موضع الفيديو والظهور</h3><p>محاذاة إطار المشهد</p><div className="background-settings__choices" role="group" aria-label="محاذاة فيديو الخلفية">{[{ id: 'top', label: 'أعلى' }, { id: 'center', label: 'وسط' }, { id: 'bottom', label: 'أسفل' }].map(item => <button key={item.id} type="button" aria-pressed={position === item.id} onClick={() => setVideo({ position: item.id as 'top' | 'center' | 'bottom' })}>{item.label}</button>)}</div><h3 className="background-settings__dim-label">تعتيم الخلفية لمقروئية النصوص <span>{dim}%</span></h3><input type="range" aria-label="تعتيم فيديو الخلفية" min={0} max={80} step={5} value={dim} onChange={event => setVideo({ dim: Number(event.target.value) })} /></div>
    </>}
  </div>;

  if (!src) {
    return (
      <>
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#D4D4D4] bg-white px-4 py-10 text-center focus-within:border-[#111111]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111111]/5 text-[#C2410C]"><Video className="h-6 w-6" /></span>
          <span className="text-[15px] font-bold text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختيار فيديو الخلفية</span>
          <span className="text-xs text-[#737373]">MP4 أو WebM حتى 20 MB · بدون صوت ويتكرر تلقائيًا</span>
          {videoInput}
        </label>
        {!!error && <p role="alert" className="px-4 text-xs text-[#DC2626]">{error}</p>}
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-2xl bg-white px-4 pb-5 pt-4">
        <label className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${uploading ? 'pointer-events-none text-[#D4D4D4]' : 'cursor-pointer bg-[#111111]/5 text-[#C2410C] focus-within:ring-2 focus-within:ring-[#111111]'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
          <RefreshCw className="h-4 w-4" />
          تغيير فيديو الخلفية
          {!uploading && videoInput}
        </label>

        <div className="relative">
          <VideoPreview src={src} poster={isVideo ? current.poster : undefined} position={position} dim={dim} />
          {uploading && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[26px] bg-black/55 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              {/* REQ-023: after the upload, Stream compresses the video. */}
              {phase === 'processing' ? <span className="px-2 text-center text-xs font-bold">جارٍ تجهيز الفيديو…</span> : <span className="text-sm font-bold" dir="ltr">{progress}%</span>}
              <button type="button" onClick={cancel} className="mt-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">إلغاء</button>
            </span>
          )}
        </div>

        {(name || size) && (
          <p className="flex max-w-full items-center gap-1.5 text-xs text-[#737373]">
            <span className="min-w-0 truncate" dir="ltr">{name}</span>
            {name && size && <span aria-hidden="true">·</span>}
            <span className="shrink-0" dir="ltr">{size}</span>
          </p>
        )}
        {uploading && <p className="text-center text-xs text-[#737373]">يكتمل الرفع ولو أغلقت النافذة، ثم احفظ تعديلاتك.</p>}
        {!!error && (
          <div role="alert" className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#DC2626]/10 px-3 py-2 text-xs text-[#DC2626]">
            <span>{error}</span>
            {file && !uploading && <button type="button" onClick={() => void start(file, localPreview)} className="shrink-0 font-bold">إعادة المحاولة</button>}
            {!file && <button type="button" onClick={() => setError('')} aria-label="إغلاق التنبيه"><X className="h-4 w-4" /></button>}
          </div>
        )}
      </section>

      {isVideo && !file && (
        <>
          {/* The poster belongs to the video: shown before it plays and whenever it cannot. */}
          <Group title="الصورة البديلة" footer="تظهر قبل بدء تشغيل الفيديو، وعند تعذّر تحميله أو إذا فضّل الزائر تقليل الحركة.">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F5F5F3] text-[#aeaeb2]">
                {current.poster ? <img src={current.poster} alt="الصورة البديلة" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1 text-sm text-[#111111]">{current.poster ? 'مضافة' : 'بدون صورة بديلة'}</span>
              <label className="cursor-pointer text-sm font-bold text-[#C2410C] focus-within:underline">
                {current.poster ? 'تغيير' : 'إضافة'}
                <input type="file" aria-label="الصورة البديلة للفيديو" accept={POSTER_TYPES.join(',')} className="sr-only" onChange={(event) => {
                  const selected = event.target.files?.[0];
                  event.target.value = '';
                  if (selected) pickPoster(selected);
                }} />
              </label>
              {current.poster && <button type="button" onClick={() => setVideo({ poster: undefined })} className="text-sm text-[#DC2626]">إزالة</button>}
            </div>
          </Group>

          <Group title="ضبط الخلفية">
            <Row label="الموضع" stacked>
              <Segmented options={[{ id: 'top', label: 'أعلى' }, { id: 'center', label: 'وسط' }, { id: 'bottom', label: 'أسفل' }] as const} value={position} onChange={(next) => setVideo({ position: next })} />
            </Row>
            <Row label="التعتيم" stacked>
              <div className="flex items-center gap-3">
                <input type="range" aria-label="تعتيم فيديو الخلفية" min={0} max={80} step={5} value={dim} onChange={(event) => setVideo({ dim: Number(event.target.value) })} className="flex-1 accent-[#FF6B2C]" />
                <span className="w-10 text-left text-sm text-[#737373]" dir="ltr">{dim}%</span>
              </div>
            </Row>
          </Group>

          <button type="button" onClick={() => updateWallpaper(current.poster ? { type: 'image', value: current.poster, dim } : { type: 'color', value: pageData.theme.background })} className="min-h-11 w-full rounded-2xl bg-white text-[15px] text-[#DC2626]">
            إزالة فيديو الخلفية
          </button>
        </>
      )}
    </>
  );
}
