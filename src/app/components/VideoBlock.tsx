import { parseYouTubeVideoSource } from '../../../shared/videoSources';

export function VideoBlock({ url, title, textColor, surfaceColor }: { url: string; title: string; textColor: string; surfaceColor: string }) {
  const source = parseYouTubeVideoSource(url);
  if (!source) return null;
  return <section aria-label={title} className="w-full overflow-hidden rounded-xl border border-current/10" style={{ color: textColor, backgroundColor: surfaceColor }}>
    <div className="relative aspect-video min-h-[200px] overflow-hidden bg-black">
      <iframe src={source.src} title={title} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
    </div>
    <div className="space-y-1 px-4 py-3">
      <h3 className="break-words text-sm font-semibold">{title}</h3>
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs underline opacity-80">فتح الفيديو في نافذة مستقلة</a>
    </div>
  </section>;
}
