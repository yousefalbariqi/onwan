import { zlibSync } from 'fflate';
// The core encoder only: the package entry pulls in Node canvas/PNG code.
import QR from 'qrcode/lib/core/qrcode.js';

// The QR drawn as the store card's strip image (owner decision, 3 Nov 2026):
// Wallet did not show the pass's own barcode on the owner's iPhone, an image
// always shows. Apple's strip is 375×123 pt; the QR takes the full height, in
// a white box on the card's colour, with a quiet zone so scanners read it.

const STRIP = { width: 375, height: 123 };
type Rgb = [number, number, number];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function png(width: number, height: number, pixel: (x: number, y: number) => Rgb) {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0, i = 0; y < height; y += 1) {
    raw[i++] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[i++] = r; raw[i++] = g; raw[i++] = b;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function qrStripImages(message: string, background: Rgb) {
  const modules = QR.create(message, { errorCorrectionLevel: 'M' }).modules;
  const size: number = modules.size;
  const cells = size + 4; // two-module quiet zone inside the white box
  const images: Record<string, Uint8Array> = {};
  for (const scale of [1, 2, 3]) {
    const width = STRIP.width * scale, height = STRIP.height * scale;
    const cell = Math.floor(height / cells);
    const box = cell * cells;
    const left = Math.floor((width - box) / 2), top = Math.floor((height - box) / 2);
    images[scale === 1 ? 'strip.png' : `strip@${scale}x.png`] = png(width, height, (x, y) => {
      const bx = x - left, by = y - top;
      if (bx < 0 || by < 0 || bx >= box || by >= box) return background;
      const mx = Math.floor(bx / cell) - 2, my = Math.floor(by / cell) - 2;
      const dark = mx >= 0 && my >= 0 && mx < size && my < size && modules.get(my, mx);
      return dark ? [0, 0, 0] : [255, 255, 255];
    });
  }
  return images;
}
