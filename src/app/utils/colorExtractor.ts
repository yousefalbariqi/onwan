import { getPalette } from 'colorthief';

/**
 * استخراج الألوان السائدة من صورة
 * @param imageUrl رابط الصورة
 * @param count عدد الألوان المطلوب استخراجها (افتراضياً 6)
 * @returns مصفوفة من الألوان بصيغة hex
 */
export async function extractColorsFromImage(
  imageUrl: string,
  count: number = 6
): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = async () => {
      try {
        // استخدام API الجديد من colorthief v3
        const palette = await getPalette(img, { count });
        
        // تحويل Color objects إلى HEX مباشرة
        const hexColors = palette.map((color) => color.hex());
        
        resolve(hexColors);
      } catch (error) {
        console.error('Error extracting colors:', error);
        resolve([]); // في حالة الخطأ، نرجع مصفوفة فارغة
      }
    };
    
    img.onerror = () => {
      console.error('Error loading image for color extraction');
      resolve([]); // في حالة فشل تحميل الصورة، نرجع مصفوفة فارغة
    };
    
    img.src = imageUrl;
  });
}