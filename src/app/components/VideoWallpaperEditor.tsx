import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, RefreshCw, Video, X } from 'lucide-react';
import { backgroundVideoFileError } from '../../../shared/videoSources';
import { uploadBackgroundVideo } from '../lib/videoUpload';
import { PageData, usePageContext } from '../context/PageContext';
import { Group, Row, Segmented } from './ios';

const POSTER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_POSTER_SIZE = 2 * 1024 * 1024;

const formatSize = (bytes?: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '');

// The first frame of a chosen video, as the poster shown before it plays.
function captureFirstFrame(src: string) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const done = (value?: string) => { video.removeAttribute('src'); video.load(); resolve(value); };
    video.onerror = () => done();
    video.onloadeddata = () => { video.currentTime = Math.min(0.1, video.duration || 0); };
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
function VideoPreview({ src, poster, position, dim }: { src: string; poster?: string; position: string; dim: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="relative block aspect-[9/19] w-36 overflow-hidden rounded-[26px] bg-[#1d1d1f] shadow-[0_10px_24px_rgba(15,23,42,0.2)]" style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: position } : undefined}>
      {!failed && <video key={src} src={src} poster={poster} muted loop autoPlay playsInline preload="metadata" aria-label="معاينة فيديو الخلفية" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />}
      {!!dim && <span className="absolute inset-0 bg-black" style={{ opacity: Math.min(dim, 80) / 100 }} />}
      <span className="absolute inset-x-0 top-3 text-center text-sm font-bold text-white/90 drop-shadow" dir="ltr">9:41</span>
      {failed && <span className="absolute inset-x-2 bottom-3 rounded-lg bg-black/60 px-2 py-1 text-center text-[11px] text-white">{poster ? 'تظهر الصورة البديلة' : 'تعذّر تشغيل الفيديو'}</span>}
    </span>
  );
}

export function VideoWallpaperEditor() {
  const { pageData, updateWallpaper } = usePageContext();
  const current = pageData.wallpaper;
  const isVideo = current.type === 'video';
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const upload = useRef<AbortController | null>(null);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const position = current.position ?? 'center';
  const dim = isVideo ? current.dim ?? 20 : 20;
  // Every setting applies straight to the page, like the rest of the editor,
  // so «احفظ تعديلاتي» saves exactly what the preview shows.
  const setVideo = (changes: Partial<PageData['wallpaper']>) => updateWallpaper({ ...current, ...changes });

  // The upload runs on even if this panel closes, and the video lands in the
  // draft when it finishes; only «إلغاء» stops it.
  const start = async (selected: File, preview: string) => {
    const controller = new AbortController();
    upload.current = controller;
    setUploading(true);
    setProgress(0);
    setError('');
    const posterPromise = isVideo && current.poster ? Promise.resolve(current.poster) : captureFirstFrame(preview);
    try {
      const value = await uploadBackgroundVideo(selected, setProgress, controller.signal);
      const poster = await posterPromise;
      updateWallpaper({ type: 'video', value, poster, position, dim, uploaded: true, fileName: selected.name, fileSize: selected.size });
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
    reader.onload = () => setVideo({ poster: String(reader.result) });
    reader.onerror = () => setError('تعذّر قراءة الصورة. حاول مجددًا.');
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

  if (!src) {
    return (
      <>
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#c7c7cc] bg-white px-4 py-10 text-center focus-within:border-[#0a84ff]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a84ff]/10 text-[#0a84ff]"><Video className="h-6 w-6" /></span>
          <span className="text-[15px] font-bold text-[#1d1d1f]" style={{ fontFamily: 'Cairo, sans-serif' }}>اختيار فيديو الخلفية</span>
          <span className="text-xs text-[#8e8e93]">MP4 أو WebM حتى 20 MB · بدون صوت ويتكرر تلقائيًا</span>
          {videoInput}
        </label>
        {!!error && <p role="alert" className="px-4 text-xs text-[#ff3b30]">{error}</p>}
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-2xl bg-white px-4 pb-5 pt-4">
        <label className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${uploading ? 'pointer-events-none text-[#c7c7cc]' : 'cursor-pointer bg-[#0a84ff]/10 text-[#0a84ff] focus-within:ring-2 focus-within:ring-[#0a84ff]'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
          <RefreshCw className="h-4 w-4" />
          تغيير فيديو الخلفية
          {!uploading && videoInput}
        </label>

        <div className="relative">
          <VideoPreview src={src} poster={isVideo ? current.poster : undefined} position={position} dim={dim} />
          {uploading && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[26px] bg-black/55 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm font-bold" dir="ltr">{progress}%</span>
              <button type="button" onClick={cancel} className="mt-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">إلغاء</button>
            </span>
          )}
        </div>

        {(name || size) && (
          <p className="flex max-w-full items-center gap-1.5 text-xs text-[#8e8e93]">
            <span className="min-w-0 truncate" dir="ltr">{name}</span>
            {name && size && <span aria-hidden="true">·</span>}
            <span className="shrink-0" dir="ltr">{size}</span>
          </p>
        )}
        {uploading && <p className="text-center text-xs text-[#6e6e73]">يكتمل الرفع ولو أغلقت النافذة، ثم احفظ تعديلاتك.</p>}
        {!!error && (
          <div role="alert" className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff3b30]">
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
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f2f2f7] text-[#aeaeb2]">
                {current.poster ? <img src={current.poster} alt="الصورة البديلة" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1 text-sm text-[#1d1d1f]">{current.poster ? 'مضافة' : 'بدون صورة بديلة'}</span>
              <label className="cursor-pointer text-sm font-bold text-[#0a84ff] focus-within:underline">
                {current.poster ? 'تغيير' : 'إضافة'}
                <input type="file" aria-label="الصورة البديلة للفيديو" accept={POSTER_TYPES.join(',')} className="sr-only" onChange={(event) => {
                  const selected = event.target.files?.[0];
                  event.target.value = '';
                  if (selected) pickPoster(selected);
                }} />
              </label>
              {current.poster && <button type="button" onClick={() => setVideo({ poster: undefined })} className="text-sm text-[#ff3b30]">إزالة</button>}
            </div>
          </Group>

          <Group title="ضبط الخلفية">
            <Row label="الموضع" stacked>
              <Segmented options={[{ id: 'top', label: 'أعلى' }, { id: 'center', label: 'وسط' }, { id: 'bottom', label: 'أسفل' }] as const} value={position} onChange={(next) => setVideo({ position: next })} />
            </Row>
            <Row label="التعتيم" stacked>
              <div className="flex items-center gap-3">
                <input type="range" aria-label="تعتيم فيديو الخلفية" min={0} max={80} step={5} value={dim} onChange={(event) => setVideo({ dim: Number(event.target.value) })} className="flex-1 accent-[#0a84ff]" />
                <span className="w-10 text-left text-sm text-[#8e8e93]" dir="ltr">{dim}%</span>
              </div>
            </Row>
          </Group>

          <button type="button" onClick={() => updateWallpaper(current.poster ? { type: 'image', value: current.poster, dim } : { type: 'color', value: pageData.theme.background })} className="min-h-11 w-full rounded-2xl bg-white text-[15px] text-[#ff3b30]">
            إزالة فيديو الخلفية
          </button>
        </>
      )}
    </>
  );
}
