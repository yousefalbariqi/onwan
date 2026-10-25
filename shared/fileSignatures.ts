// REQ-017: a file is judged by its first bytes, not by the name or the type
// it claims — a renamed script or page never passes as an image, PDF or video.
export function sniffFileType(bytes: Uint8Array): string | null {
  const at = (offset: number, ...values: number[]) => values.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, text: string) => at(offset, ...Array.from(text, (char) => char.charCodeAt(0)));
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  if (ascii(0, '%PDF-')) return 'application/pdf';
  if (ascii(4, 'ftyp')) return 'video/mp4';
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  return null;
}

export function contentMatchesType(bytes: Uint8Array, declared: string) {
  return sniffFileType(bytes) === declared.toLowerCase();
}

// The first bytes of a base64 data URL (enough for every signature above).
export function dataUrlHead(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(comma + 1, comma + 1 + 24);
  try {
    return Uint8Array.from(atob(head.slice(0, head.length - (head.length % 4))), (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}
