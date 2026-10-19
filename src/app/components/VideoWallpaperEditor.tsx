import { useEffect, useRef, useState } from 'react';
import { backgroundVideoFileError, parseVideoSource } from '../../../shared/videoSources';
import { uploadBackgroundVideo } from '../lib/videoUpload';
import { usePageContext } from '../context/PageContext';
import { Group, Row, Segmented } from './ios';

export function VideoWallpaperEditor() {
  const { pageData, updateWallpaper } = usePageContext();
  const current = pageData.wallpaper;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadRequest = useRef<AbortController | null>(null);
  useEffect(() => () => uploadRequest.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const url = preview || (current.type === 'video' ? current.value : '');
  const [poster, setPoster] = useState(current.type === 'video' ? current.poster : current.type === 'image' ? current.value : undefined);
  const [error, setError] = useState('');
  const valid = file || parseVideoSource(url, true);
  const [position, setPosition] = useState(current.position ?? 'center');
  const [dim, setDim] = useState(current.dim ?? 20);
  const apply = async () => {
    if (!valid || uploading) return;
    setError('');
    if (!file) { updateWallpaper({ ...current, type: 'video', value: url, poster, position, dim }); return; }
    const controller = new AbortController();
    uploadRequest.current = controller;
    setUploading(true); setProgress(0);
    try {
      const value = await uploadBackgroundVideo(file, setProgress, controller.signal);
      if (!controller.signal.aborted) {
        updateWallpaper({ type: 'video', value, poster, position, dim, uploaded: true, fileName: file.name, fileSize: file.size });
        setFile(null); setPreview('');
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'تعذّر رفع الفيديو.');
    } finally { if (!controller.signal.aborted) setUploading(false); }
  };
  return <>
    <Group title="فيديو خلفية" footer="ارفع ملف MP4 أو WebM حتى 20 MB. الخلفية تعمل بدون صوت وتتكرر، والزائر يستطيع إيقافها.">
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold text-[#0a84ff] focus-within:ring-2 focus-within:ring-blue-500">
        {file || current.type === 'video' ? 'تغيير فيديو الخلفية' : 'إرفاق فيديو الخلفية'}
        <input type="file" aria-label="إرفاق فيديو الخلفية" accept="video/mp4,video/webm" disabled={uploading} className="sr-only" onChange={event => {
          const selected = event.target.files?.[0]; event.target.value = '';
          if (!selected) return;
          const error = backgroundVideoFileError(selected);
          if (error) { setError(error); return; }
          setError(''); setFile(selected); setPreview(URL.createObjectURL(selected));
        }} />
      </label>
      {(file || current.fileName) && <p className="px-4 pb-2 text-xs text-[#6e6e73]">{file?.name || current.fileName}{(file?.size || current.fileSize) ? ` · ${((file?.size || current.fileSize || 0) / 1024 / 1024).toFixed(1)} MB` : ''}</p>}
      {!!url && <video key={url} src={url} poster={poster} controls muted playsInline preload="metadata" aria-label="تجربة فيديو الخلفية" onError={() => { setError('تعذّر تشغيل الفيديو. جرّب ملف MP4 متوافقًا مع المتصفح.'); if (file) { setFile(null); setPreview(''); } }} className="mx-auto aspect-video w-full bg-black object-contain" />}
      {uploading && <div className="space-y-2 px-4 py-3"><progress aria-label="تقدم رفع الفيديو" max={100} value={progress} className="w-full" /><p className="text-xs text-[#6e6e73]">جارٍ رفع الفيديو… {progress}%</p></div>}
    </Group>
    {!!error && <p role="alert" className="px-4 py-2 text-xs text-[#ff3b30]">{error}</p>}
    <Group title="صورة بديلة" footer="تظهر عند تعذّر تشغيل الفيديو أو عند تفعيل تقليل الحركة، قبل أن يختار الزائر التشغيل.">
      {poster && <img src={poster} alt="الصورة البديلة" className="mx-auto h-24 w-40 object-cover" />}
      <label className="flex min-h-11 cursor-pointer items-center justify-center px-4 text-sm text-[#0a84ff] focus-within:ring-2 focus-within:ring-blue-500">
        {poster ? 'تغيير الصورة البديلة' : 'إرفاق صورة بديلة'}
        <input type="file" aria-label="صورة بديلة للفيديو" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('اختر صورة PNG أو JPG أو WebP بحجم أقل من 2MB.'); return; }
          setError('');
          const reader = new FileReader();
          reader.onload = () => setPoster(String(reader.result));
          reader.onerror = () => setError('تعذّر قراءة الصورة. حاول مجددًا.');
          reader.readAsDataURL(file);
        }} />
      </label>
      {poster && <button type="button" onClick={() => setPoster(undefined)} className="min-h-10 px-4 text-xs text-[#ff3b30]">إزالة الصورة البديلة</button>}
    </Group>
    <Group title="ضبط الخلفية">
      <Row label="الموضع" stacked><Segmented options={[{ id: 'top', label: 'أعلى' }, { id: 'center', label: 'وسط' }, { id: 'bottom', label: 'أسفل' }]} value={position} onChange={next => setPosition(next as typeof position)} /></Row>
      <Row label="التعتيم" stacked><input type="range" aria-label="تعتيم فيديو الخلفية" min={0} max={80} step={5} value={dim} onChange={event => setDim(Number(event.target.value))} className="w-full accent-[#0a84ff]" /><span className="text-xs text-[#6e6e73]">{dim}%</span></Row>
    </Group>
    <button type="button" disabled={!valid || uploading} onClick={() => void apply()} className="min-h-11 w-full rounded-xl bg-[#0a84ff] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{uploading ? 'جارٍ رفع الفيديو…' : file ? 'رفع واستخدام الفيديو كخلفية' : 'استخدام الفيديو كخلفية'}</button>
    {current.type === 'video' && <button type="button" disabled={uploading} onClick={() => updateWallpaper(poster ? { type: 'image', value: poster, position, dim } : { type: 'color', value: pageData.theme.background })} className="min-h-11 w-full text-sm text-[#ff3b30]">إزالة فيديو الخلفية</button>}
  </>;
}
