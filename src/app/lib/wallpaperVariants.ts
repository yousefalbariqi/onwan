// Prepare both versions from one decode, with exactly the same crop and ratio.
export async function createWallpaperVariants(source: string) {
  const image = new Image();
  image.src = source;
  try { await image.decode(); }
  catch { throw new Error('تعذّر فتح الصورة. جرّب صورة أخرى.'); }
  const render = (edge: number, quality: number) => {
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذّر تجهيز الصورة. حاول مجددًا.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
  };
  return { value: render(1600, .86), preview: render(64, .25) };
}
