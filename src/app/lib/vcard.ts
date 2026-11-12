import { PageData } from '../context/PageContext';
import { pageUrl } from './site';

function escapeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

// Lines longer than 75 octets must be folded (RFC 2426); only the base64
// photo ever gets that long, and it is pure ASCII.
function fold(line: string) {
  const parts: string[] = [];

  for (let index = 0; index < line.length; index += 74) {
    parts.push((index === 0 ? '' : ' ') + line.slice(index, index + 74));
  }

  return parts.join('\r\n');
}

// SHARE-02: name, logo, mobile, email and page link. vCard 3.0 is the version
// both iOS and Android contacts import reliably.
export function buildVCard(page: PageData) {
  const name = page.name.trim() || page.username;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeValue(name)}`, `N:${escapeValue(name)};;;;`, `ORG:${escapeValue(name)}`];

  if (page.bio.trim()) {
    lines.push(`NOTE:${escapeValue(page.bio.trim())}`);
  }

  if (page.contactPhone) {
    lines.push(`TEL;TYPE=CELL:${page.contactPhone}`);
  }

  if (page.contactEmail) {
    lines.push(`EMAIL;TYPE=INTERNET:${page.contactEmail}`);
  }

  lines.push(`URL:${pageUrl(page.username)}`);

  const photo = /^data:image\/(png|jpeg);base64,(.+)$/i.exec(page.profileImage);

  if (photo) {
    lines.push(fold(`PHOTO;ENCODING=b;TYPE=${photo[1].toUpperCase()}:${photo[2]}`));
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

// A logo stored as a link (note 53) is read back into the card as base64.
export async function inlinePhoto(page: PageData): Promise<PageData> {
  if (!page.profileImage) return page;
  let dataUrl = page.profileImage;
  if (!dataUrl.startsWith('data:')) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('تعذر تحميل شعار جهة الاتصال.');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('ملف الشعار ليس صورة.');
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Upload compression may produce WebP. Contacts need embedded PNG/JPEG,
  // so convert other image formats locally, preserving the logo's transparency.
  if (!/^data:image\/(png|jpeg);base64,/i.test(dataUrl)) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز شعار جهة الاتصال.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/png');
  }
  if (!/^data:image\/(png|jpeg);base64,.+/i.test(dataUrl)) throw new Error('تعذر تجهيز شعار جهة الاتصال.');
  return { ...page, profileImage: dataUrl };
}

export async function downloadVCard(page: PageData) {
  const blob = new Blob([buildVCard(await inlinePhoto(page))], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${page.username || 'contact'}.vcf`;
  link.click();
  URL.revokeObjectURL(url);
}
