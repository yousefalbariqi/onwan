export type VideoSource = { kind: 'youtube' | 'vimeo' | 'file'; src: string; url: string };

// Only known providers become iframes. User-supplied HTML is never embedded.
export function parseVideoSource(raw: string, background = false): VideoSource | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', src: url.href, url: url.href };
    if (background) return null;
    let id: string | undefined;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') ?? undefined : /^\/(embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[2];
    }
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`, url: `https://www.youtube.com/watch?v=${id}` };
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const match = /^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/.exec(url.pathname);
      if (!match) return null;
      const hash = url.searchParams.get('h') || match[2];
      if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) return null;
      return { kind: 'vimeo', src: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${hash}` : ''}`, url: url.href };
    }
    return null;
  } catch { return null; }
}

// The content player is intentionally YouTube-only; background files are separate.
export function parseYouTubeVideoSource(raw: string) {
  const source = parseVideoSource(raw);
  return source?.kind === 'youtube' ? source : null;
}

export const MAX_BACKGROUND_VIDEO_BYTES = 20 * 1024 * 1024;
export const BACKGROUND_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export function backgroundVideoFileError(file: { size: number; type: string }) {
  if (!BACKGROUND_VIDEO_TYPES.includes(file.type)) return 'اختر ملف فيديو MP4 أو WebM.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'ملف الفيديو فارغ أو غير صالح.';
  if (file.size > MAX_BACKGROUND_VIDEO_BYTES) return 'حجم الفيديو يتجاوز الحد المعتمد: 20 MB.';
  return '';
}
