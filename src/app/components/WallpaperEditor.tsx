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

const gradients = [
  { name: 'غروب', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'محيط', value: 'linear-gradient(135deg, #667eea 0%, #48c6ef 100%)' },
  { name: 'ليموني', value: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)' },
  { name: 'ناري', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { name: 'شفق', value: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
  { name: 'خوخي', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
];

export function WallpaperEditor() {
  const { pageData, updateWallpaper } = usePageContext();

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

      {/* Gradients */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          تدرجات لونية
        </label>
        <div className="grid grid-cols-2 gap-2">
          {gradients.map((gradient) => {
            const isActive = pageData.wallpaper.type === 'gradient' && pageData.wallpaper.value === gradient.value;
            return (
              <button
                key={gradient.name}
                onClick={() => updateWallpaper({ type: 'gradient', value: gradient.value })}
                className={`relative h-20 rounded-lg border-2 transition-all hover:scale-105 ${
                  isActive ? 'border-emerald-500 shadow-lg' : 'border-gray-200'
                }`}
                style={{ background: gradient.value }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="text-xs font-semibold text-white drop-shadow-lg" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    {gradient.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
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