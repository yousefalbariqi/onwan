// Note (6), 25 Oct 2026: pictures up to 10 MB are accepted and made small
// automatically — stepping quality, then size, down until the result fits the
// server's 1,000 KB image limit — keeping transparency (WebP) when the source
// may have it. Each failure says what actually went wrong.
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const TARGET_BYTES = 950 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageProblem extends Error {}

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

export async function compressImage(file: File, maxEdge = 1600): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new ImageProblem(file.type === 'image/heic' || /\.heic$/i.test(file.name) ? 'صيغة HEIC غير مدعومة. صدّر الصورة من جوالك بصيغة JPG ثم أرفقها.' : 'اختر صورة PNG أو JPG أو WebP.');
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
