import type { WalletRgb } from './walletPalette.js';

// Fixed artwork geometry in 358 × 448 points. Both the browser and signed-pass
// fallback rasterize the same pattern, with no embedded text or barcode.
const cards = [
  [-32, 120, 130, 82, .28], [336, 112, 122, 78, -.28],
  [-12, 300, 112, 72, -.2], [368, 318, 146, 92, .2],
].map(([x, y, width, height, angle]) => ({ x, y, width, height, cos: Math.cos(angle), sin: Math.sin(angle) }));

export function walletPosterPixel(x: number, y: number, accent: WalletRgb, body: WalletRgb): WalletRgb {
  let ink = 0;
  for (const card of cards) {
    const dx = x - card.x, dy = y - card.y;
    const px = dx * card.cos + dy * card.sin;
    const py = -dx * card.sin + dy * card.cos;
    const radius = 13;
    const qx = Math.abs(px) - card.width / 2 + radius;
    const qy = Math.abs(py) - card.height / 2 + radius;
    const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
    ink = Math.max(ink, Math.max(0, 1 - Math.abs(distance) / 1.25) * .65);
    if (distance < -2) ink = Math.max(ink, .12);
    // A short inset line suggests the face of a card without adding symbols.
    if (Math.abs(py - 15) < .6 && px > -card.width / 2 + 20 && px < card.width / 2 - 20) ink = Math.max(ink, .35);
  }
  // Fade toward the native QR and the system footer, preserving readability.
  const edge = Math.min(1, Math.abs(x - 179) / 125);
  ink *= (.15 + edge * .85) * (y > 360 ? Math.max(0, (448 - y) / 88) : 1);
  return body.map((channel, i) => Math.round(channel * (1 - ink) + accent[i] * ink)) as WalletRgb;
}
