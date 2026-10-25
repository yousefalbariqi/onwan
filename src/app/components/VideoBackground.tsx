import { useEffect, useRef, useState } from 'react';

// Silent looping background video. Note 36: no on-page pause control; it
// plays only while visible and the tab is shown, and never for visitors who
// asked their system to reduce motion — they see the poster instead.
export function VideoBackground({ src, poster, position = 'center' }: { src: string; poster?: string; position?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    setFailed(false);
    const document = element.ownerDocument;
    const motion = document.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const sync = () => {
      if (document.hidden || !visible || motion.matches) element.pause();
      else { element.muted = true; void element.play().catch(() => undefined); }
    };
    const observer = new document.defaultView!.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(element);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); element.pause(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [src]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: position } : undefined}>
      <video ref={video} key={src} src={src} poster={poster} muted loop playsInline preload="none" tabIndex={-1} onError={() => setFailed(true)} className={`h-full w-full object-cover ${failed ? 'invisible' : ''}`} style={{ objectPosition: position }} />
    </div>
  );
}
