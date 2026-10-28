import { parseYouTubeVideoSource } from '../../../shared/videoSources';

// The video in its frame. Note 37: optionally one compact row — the item's own
// title (two lines at most) and a small «يوتيوب» link to the same video —
// above or below it; when hidden nothing is drawn, so no space is left.
export function VideoBlock({ url, title, caption, textColor, radiusClass = 'rounded-xl' }: { url: string; title: string; caption?: 'above' | 'below'; textColor?: string; radiusClass?: string }) {
  const source = parseYouTubeVideoSource(url);
  if (!source) return null;
  const row = caption && (
    <div className="flex items-start justify-between gap-3 px-1" style={{ color: textColor }}>
      <p className="line-clamp-2 min-w-0 flex-1 text-start text-sm font-bold leading-6">{title}</p>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold opacity-85 transition-opacity hover:opacity-100">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z" /><path fill="#fff" d="M9.6 15.6 15.8 12 9.6 8.4z" /></svg>
        يوتيوب
      </a>
    </div>
  );
  return <section aria-label={title} className="w-full space-y-2">
    {caption === 'above' && row}
    <div className={`relative aspect-video min-h-[200px] w-full overflow-hidden ${radiusClass} bg-black`}>
      <iframe src={source.src} title={title} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
    </div>
    {caption === 'below' && row}
  </section>;
}
