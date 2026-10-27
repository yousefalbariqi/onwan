// Note (6), 25 Oct 2026: pictures up to 10 MB are accepted and made small
// automatically — stepping quality, then size, down until the result fits the
// server's 1,000 KB image limit — keeping transparency (WebP) when the source
// may have it. Each failure says what actually went wrong.
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const TARGET_BYTES = 950 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageProblem extends Error {}

// An SVG logo is drawn into a PNG here, so the file never leaves the browser:
// a stored SVG can carry script that would run on our domain when its link is
// opened. Inside <img> no script runs, so drawing it is safe.
const SVG_EDGE = 1024;
const isSvg = (file: File) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

export async function compressImage(file: File, maxEdge = 1600, { allowSvg = false } = {}): Promise<string> {
  if (allowSvg && isSvg(file)) return rasterizeSvg(file);
  if (!ACCEPTED.includes(file.type)) throw new ImageProblem(file.type === 'image/heic' || /\.heic$/i.test(file.name) ? 'صيغة HEIC غير مدعومة. صدّر الصورة من جوالك بصيغة JPG ثم أرفقها.' : allowSvg ? 'اختر صورة PNG أو JPG أو WebP أو SVG.' : 'اختر صورة PNG أو JPG أو WebP.');
  if (file.size > MAX_SOURCE_BYTES) throw new ImageProblem('الصورة أكبر من 10MB. اختر صورة أصغر.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new ImageProblem('تعذّر فتح الصورة؛ قد تكون تالفة. جرّب صورة أخرى.');
    }
    const keepAlpha = file.type !== 'image/jpeg';
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new ImageProblem('المتصفح لم يستطع تجهيز الصورة. حدّث الصفحة وحاول مجددًا.');
    for (const edge of [maxEdge, 1200, 900, 700]) {
      const factor = Math.min(1, edge / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * factor));
      canvas.height = Math.max(1, Math.round(image.height * factor));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.75, 0.65, 0.55]) {
        const result = canvas.toDataURL(keepAlpha ? 'image/webp' : 'image/jpeg', quality);
        // Browsers without WebP output fall back to PNG; then try JPEG.
        const usable = result.startsWith('data:image/webp') || result.startsWith('data:image/jpeg') ? result : canvas.toDataURL('image/jpeg', quality);
        if (bytesOf(usable) <= TARGET_BYTES) return usable;
      }
    }
    throw new ImageProblem('تعذّر تصغير الصورة بما يكفي. جرّب صورة أبسط أو أصغر أبعادًا.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizeSvg(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new ImageProblem('ملف SVG أكبر من 2MB. اختر ملفًا أصغر.');
  const url = URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new ImageProblem('تعذّر فتح ملف SVG. صدّره من برنامج التصميم مرة أخرى، أو ارفع الشعار PNG.');
    }
    // An SVG without width/height reports 0 (or 300×150); a square is the safe default.
    const width = image.naturalWidth || SVG_EDGE;
    const height = image.naturalHeight || SVG_EDGE;
    const factor = SVG_EDGE / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const context = canvas.getContext('2d');
    if (!context) throw new ImageProblem('المتصفح لم يستطع تجهيز الصورة. حدّث الصفحة وحاول مجددًا.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // PNG keeps a logo's sharp edges and transparency; WebP only if PNG is too big.
    const png = canvas.toDataURL('image/png');
    if (bytesOf(png) <= TARGET_BYTES) return png;
    const webp = canvas.toDataURL('image/webp', 0.9);
    if (webp.startsWith('data:image/webp') && bytesOf(webp) <= TARGET_BYTES) return webp;
    throw new ImageProblem('الشعار معقّد جدًا بعد تحويله إلى صورة. ارفعه PNG بدلًا من SVG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
