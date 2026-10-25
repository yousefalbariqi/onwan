import { getSessionToken } from './session';

// Note (9): TTF / OTF / WOFF / WOFF2 up to 2 MB, stored like the page's other
// files. Browsers often give fonts no type, so it comes from the extension;
// the server still checks the file's first bytes.
const TYPES: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2', woff: 'font/woff' };
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

export async function uploadFont(file: File): Promise<{ url: string; name: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const type = TYPES[extension];
  if (!type) throw new Error('اختر ملف خط بصيغة TTF أو OTF أو WOFF2.');
  if (file.size > MAX_FONT_BYTES) throw new Error('ملف الخط أكبر من 2MB.');
  const token = getSessionToken();
  if (!token) throw new Error('سجّل دخولك لرفع خط مخصص.');
  const response = await fetch('/api/media-upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body: file });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'تعذّر رفع الخط. حاول مجددًا.');
  return { url: data.url, name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) };
}
