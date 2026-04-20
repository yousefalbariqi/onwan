import { usePageContext } from '../context/PageContext';
import { Check, Info } from 'lucide-react';

const colors = [
  { name: 'أبيض', value: '#ffffff' },
  { name: 'أسود', value: '#1a1a1a' },
  { name: 'أزرق', value: '#e0f7ff' },
  { name: 'وردي', value: '#ffe0f0' },
  { name: 'أخضر', value: '#e8f5e9' },
  { name: 'أصفر', value: '#fff9c4' },
  { name: 'بنفسجي', value: '#f3e5f5' },
  { name: 'برتقالي', value: '#ffe0b2' },
];

export function WallpaperEditor() {
  const { pageData, updateWallpaper } = usePageContext();
  const extractedColors = Array.from(
    new Set((pageData.extractedColors || []).filter((color) => /^#([A-Fa-f0-9]{6})$/.test(color))),
  ).slice(0, 8);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
        تخصيص الخلفية
      </h3>

      {/* Colors */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          ألوان سادة
        </label>
        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => {
            const isActive = pageData.wallpaper.type === 'color' && pageData.wallpaper.value === color.value;
            return (
              <button
                key={color.value}
                onClick={() => updateWallpaper({ type: 'color', value: color.value })}
                className={`relative aspect-square rounded-lg border-2 transition-all hover:scale-105 ${
                  isActive ? 'border-emerald-500 shadow-lg' : 'border-gray-200'
                }`}
                style={{ backgroundColor: color.value }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Extracted Colors */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          ألوان من الصورة المرفوعة
        </label>

        {extractedColors.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {extractedColors.map((color) => {
              const isActive = pageData.wallpaper.type === 'color' && pageData.wallpaper.value === color;

              return (
                <button
                  key={color}
                  onClick={() => updateWallpaper({ type: 'color', value: color })}
                  className={`relative aspect-square rounded-lg border-2 transition-all hover:scale-105 ${
                    isActive ? 'border-emerald-500 shadow-lg' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                ارفع صورة في قسم البروفايل حتى تظهر الألوان المستخرجة تلقائيًا هنا.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Color */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          لون مخصص
        </label>
        <div className="flex gap-2">
          <input
            type="color"
            value={pageData.wallpaper.type === 'color' ? pageData.wallpaper.value : '#ffffff'}
            onChange={(e) => updateWallpaper({ type: 'color', value: e.target.value })}
            className="w-16 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={pageData.wallpaper.type === 'color' ? pageData.wallpaper.value : '#ffffff'}
            onChange={(e) => updateWallpaper({ type: 'color', value: e.target.value })}
            placeholder="#000000"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:border-emerald-500"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      </div>

      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
        <p className="text-xs text-purple-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          🎨 اختر الخلفية اللي تناسب أسلوبك
        </p>
      </div>
    </div>
  );
}