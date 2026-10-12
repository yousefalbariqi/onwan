import { usePageContext } from '../context/PageContext';
import { useState } from 'react';
import { Check, Info, Upload } from 'lucide-react';

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
  { name: 'فجر', value: 'linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)' },
  { name: 'بحر', value: 'linear-gradient(135deg, #a5f3fc 0%, #6366f1 100%)' },
  { name: 'غابة', value: 'linear-gradient(135deg, #d9f99d 0%, #10b981 100%)' },
  { name: 'ليل', value: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { name: 'ورد', value: 'linear-gradient(135deg, #fbcfe8 0%, #c084fc 100%)' },
  { name: 'رمل', value: 'linear-gradient(135deg, #fef3c7 0%, #d6d3d1 100%)' },
];

const positions = [
  { id: 'top', label: 'أعلى' },
  { id: 'center', label: 'وسط' },
  { id: 'bottom', label: 'أسفل' },
] as const;

// Stored inline for now; final storage limits are pending (P-02).
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export function WallpaperEditor() {
  const { pageData, updateWallpaper } = usePageContext();
  const [imageError, setImageError] = useState('');
  const isImage = pageData.wallpaper.type === 'image';
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

      {/* Gradients */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          تدرجات
        </label>
        <div className="grid grid-cols-3 gap-2">
          {gradients.map((gradient) => {
            const isActive = pageData.wallpaper.type === 'gradient' && pageData.wallpaper.value === gradient.value;
            return (
              <button
                key={gradient.value}
                onClick={() => updateWallpaper({ type: 'gradient', value: gradient.value })}
                className={`relative h-14 rounded-lg border-2 transition-all hover:scale-105 ${
                  isActive ? 'border-emerald-500 shadow-lg' : 'border-gray-200'
                }`}
                style={{ background: gradient.value }}
                title={gradient.name}
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

      {/* Image */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
          صورة خلفية
        </label>
        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-semibold text-gray-600 transition-colors hover:border-emerald-500 hover:text-emerald-600">
          <Upload className="h-4 w-4" />
          {isImage ? 'تغيير الصورة' : 'رفع صورة'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_IMAGE_SIZE) {
                setImageError('حجم الصورة كبير. الحد الأقصى 2MB.');
                return;
              }
              setImageError('');
              const reader = new FileReader();
              reader.onloadend = () =>
                updateWallpaper({
                  type: 'image',
                  value: String(reader.result || ''),
                  position: pageData.wallpaper.position ?? 'center',
                  dim: pageData.wallpaper.dim ?? 0,
                });
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {!!imageError && (
          <p className="text-xs text-red-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>{imageError}</p>
        )}

        {isImage && (
          <>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
                موضع الصورة
              </div>
              <div className="grid grid-cols-3 gap-2">
                {positions.map((position) => {
                  const isActive = (pageData.wallpaper.position ?? 'center') === position.id;
                  return (
                    <button
                      key={position.id}
                      onClick={() => updateWallpaper({ ...pageData.wallpaper, position: position.id })}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all ${
                        isActive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      {position.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <span>تعتيم الخلفية</span>
                <span dir="ltr">{pageData.wallpaper.dim ?? 0}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={pageData.wallpaper.dim ?? 0}
                onChange={(e) => updateWallpaper({ ...pageData.wallpaper, dim: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}