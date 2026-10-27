import { parseYouTubeVideoSource } from '../../../shared/videoSources';

// The video alone in its frame: no caption or link under it. The title stays
// for screen readers and as the player's own title.
export function VideoBlock({ url, title }: { url: string; title: string }) {
  const source = parseYouTubeVideoSource(url);
  if (!source) return null;
  return <section aria-label={title} className="relative aspect-video min-h-[200px] w-full overflow-hidden rounded-xl bg-black">
    <iframe src={source.src} title={title} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
  </section>;
}
