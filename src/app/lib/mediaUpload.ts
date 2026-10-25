import { getSessionToken } from './session';
import type { PageData } from '../context/PageContext';

// Note 53: before a save, every image or PDF still inline in the draft
// (data URL) is stored once in R2 and replaced by its link. Later saves send
// only the link, and pages load the file from the CDN cache. Where storage is
// unavailable, saving fails; inline files must never reach the database.

const isInline = (value: unknown): value is string => typeof value === 'string' && /^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/i.test(value);

// Preserve small originals (including animated GIFs); compress oversized stills.
async function prepareImage(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith('image/') || blob.size <= 1_000_000) return blob;
  if (blob.type === 'image/gif') throw new Error('صورة GIF أكبر من 1,000KB. اختر نسخة أصغر للحفاظ على الحركة.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر ضغط الصورة.');
    let scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    for (let step = 0; step < 8; step++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.7, 0.5]) {
        const result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (result && result.size <= 1_000_000) return result;
      }
      scale *= 0.75;
    }
    throw new Error('تعذر ضغط الصورة إلى 1,000KB. اختر صورة أصغر.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Keep successful uploads across retries: a later file may hit a rate limit.
// Do not charge another upload for files already stored in the same session.
const uploadedMedia = new Map<string, Map<string, { url: string; expires: number }>>();
async function store(dataUrl: string, token: string) {
  const cached = uploadedMedia.get(token)?.get(dataUrl);
  if (cached && cached.expires > Date.now()) return cached.url;
  const blob = await prepareImage(await (await fetch(dataUrl)).blob());
  const response = await fetch('/api/media-upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type }, body: blob });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'تعذر رفع الملف إلى Cloudflare. أعد المحاولة؛ لم يتم حفظ التعديلات.');
  }
  const data = await response.json().catch(() => ({}));
  if (typeof data.url !== 'string' || !/^\/media\/files\//.test(data.url)) throw new Error('لم يكتمل رفع الملف. أعد المحاولة.');
  let cache = uploadedMedia.get(token);
  if (!cache) { uploadedMedia.clear(); cache = new Map(); uploadedMedia.set(token, cache); }
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(dataUrl, { url: data.url, expires: Date.now() + 3600000 });
  return data.url as string;
}

export async function moveInlineMedia(page: PageData, token = getSessionToken()): Promise<PageData> {
  const values = new Set<string>();
  const collect = (value: unknown) => { if (isInline(value)) values.add(value); };
  collect(page.profileImage);
  collect(page.profileStyle?.bannerImage);
  if (page.wallpaper.type === 'image') collect(page.wallpaper.value);
  if (page.wallpaper.type === 'video') collect(page.wallpaper.poster);
  for (const link of page.links) { collect(link.url); collect(link.customIcon); collect(link.display?.image); }
  if (!values.size) return page;
  if (!token) throw new Error('سجّل الدخول لرفع الصور والملفات قبل الحفظ.');

  const stored = new Map<string, string>();
  await Promise.all([...values].map(async (value) => {
    const url = await store(value, token).catch((error) => {
      throw new Error(error instanceof Error ? error.message : 'تعذر رفع الملف. أعد المحاولة.');
    });
    stored.set(value, url);
  }));
  if (!stored.size) return page;
  const swap = <T,>(value: T): T => (typeof value === 'string' && stored.has(value) ? (stored.get(value) as T) : value);

  return {
    ...page,
    profileImage: swap(page.profileImage),
    profileStyle: page.profileStyle?.bannerImage ? { ...page.profileStyle, bannerImage: swap(page.profileStyle.bannerImage) } : page.profileStyle,
    wallpaper: { ...page.wallpaper, value: page.wallpaper.type === 'image' ? swap(page.wallpaper.value) : page.wallpaper.value, poster: swap(page.wallpaper.poster) },
    links: page.links.map((link) => ({ ...link, url: swap(link.url), customIcon: swap(link.customIcon), display: link.display ? { ...link.display, image: swap(link.display.image) } : link.display })),
  };
}
