// Note 22: a photo fills its frame; a logo with a transparent background stays whole.
export function hasTransparency(src: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(false);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 48;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return resolve(false);
      context.drawImage(image, 0, 0, 48, 48);
      const { data } = context.getImageData(0, 0, 48, 48);
      for (let i = 3; i < data.length; i += 4) if (data[i] < 245) return resolve(true);
      resolve(false);
    };
    image.src = src;
  });
}
