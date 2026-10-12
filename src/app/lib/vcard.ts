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

export function downloadVCard(page: PageData) {
  const blob = new Blob([buildVCard(page)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${page.username || 'contact'}.vcf`;
  link.click();
  URL.revokeObjectURL(url);
}
