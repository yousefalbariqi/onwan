import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export function VideoBackground({ src, poster, position = 'center' }: { src: string; poster?: string; position?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const wanted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    setFailed(false);
    const document = element.ownerDocument;
    const motion = document.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
    wanted.current = !motion.matches;
    let visible = false;
    const sync = () => {
      if (document.hidden || !visible || !wanted.current) element.pause();
      else { element.muted = true; void element.play().catch(() => setPlaying(false)); }
    };
    const preferenceChanged = () => { wanted.current = !motion.matches; sync(); };
    const observer = new document.defaultView!.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    motion.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); element.pause(); motion.removeEventListener('change', preferenceChanged); document.removeEventListener('visibilitychange', sync); };
  }, [src]);
  return <>
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: position } : undefined}>
      <video ref={video} key={src} src={src} poster={poster} muted loop playsInline preload="none" tabIndex={-1} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} className={`h-full w-full object-cover ${failed ? 'invisible' : ''}`} style={{ objectPosition: position }} />
    </div>
    {/* A video that cannot play leaves the poster in its place, without a broken control. */}
    {!failed && <button type="button" aria-label={playing ? 'إيقاف فيديو الخلفية' : 'تشغيل فيديو الخلفية'} aria-pressed={playing} onClick={() => {
      const element = video.current;
      if (!element) return;
      wanted.current = !playing;
      if (playing) element.pause(); else void element.play().catch(() => setPlaying(false));
    }} className="absolute left-3 top-3 z-20 flex min-h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-xs text-white shadow-sm ">
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{playing ? 'إيقاف الخلفية' : 'تشغيل الخلفية'}
    </button>}
  </>;
}
