import { usePageContext } from '../context/PageContext';
import { Circle, Square, Pill, Check, Info, Palette } from 'lucide-react';

const shapeOptions = [
  { id: 'rounded', label: 'دائري', icon: Circle, preview: 'rounded-xl' },
  { id: 'square', label: 'مربع', icon: Square, preview: 'rounded-none' },
  { id: 'pill', label: 'بيضاوي', icon: Pill, preview: 'rounded-full' },
];

const colorPresets = [
  { name: 'أسود', value: '#000000' },
  { name: 'أزرق', value: '#0066cc' },
  { name: 'أخضر', value: '#059669' },
  { name: 'أحمر', value: '#dc2626' },
  { name: 'برتقالي', value: '#ff6b35' },
  { name: 'وردي', value: '#e91e63' },
  { name: 'بنفسجي', value: '#9c27b0' },
  { name: 'ذهبي', value: '#d97706' },
];

export function StyleEditor() {
  const { pageData, updateButtonStyle } = usePageContext();

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
        تصميم الأزرار
      </h3>

      <div className="p-3 bg-amber-50 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            خصص شكل الأزرار حسب ذوقك - جرب الخيارات! ✨
          </p>
        </div>
      </div>

      {/* Shape */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
          الشكل
        </label>
        <div className="grid grid-cols-3 gap-2">
          {shapeOptions.map((option) => {
            const isActive = pageData.buttonStyle.shape === option.id;
            return (
              <button
                key={option.id}
                onClick={() => updateButtonStyle({ shape: option.id as any })}
                className={`relative py-3 border-2 transition-all hover:scale-105 ${
                  option.preview
                } ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {option.label}
                </span>
                {isActive && (
                  <div className="absolute top-1 right-1">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                <option.icon className="absolute top-1 left-1 w-4 h-4 text-gray-400" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            لون الأزرار
          </label>
          <button
            onClick={() => updateButtonStyle({ useCustomColor: !pageData.buttonStyle.useCustomColor })}
            className={`relative w-14 h-7 rounded-full transition-all ${
              pageData.buttonStyle.useCustomColor ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                pageData.buttonStyle.useCustomColor ? 'left-1' : 'right-1'
              }`}
            ></div>
          </button>
        </div>
        
        {pageData.buttonStyle.useCustomColor ? (
          <div className="space-y-3">
            {/* Preset Colors */}
            <div className="grid grid-cols-4 gap-2">
              {colorPresets.map((color) => {
                const isActive = pageData.buttonStyle.customColor === color.value;
                return (
                  <button
                    key={color.value}
                    onClick={() => updateButtonStyle({ customColor: color.value })}
                    className={`relative h-12 rounded-lg transition-all hover:scale-105 border-2 ${
                      isActive
                        ? 'border-emerald-500 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Picker */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <input
                  type="color"
                  value={pageData.buttonStyle.customColor || '#000000'}
                  onChange={(e) => updateButtonStyle({ customColor: e.target.value })}
                  className="w-full h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div className="flex-1 bg-gray-100 rounded-lg px-3 py-3 text-center">
                <div className="text-xs font-mono text-gray-700" dir="ltr">
                  {pageData.buttonStyle.customColor || '#000000'}
                </div>
              </div>
            </div>

            <p className="text-xs text-emerald-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              🎨 اختر اللون المفضل لديك
            </p>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-600 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              اللون من الثيم المختار
            </p>
          </div>
        )}
      </div>

      {/* Border Toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>خلفية شفافة</label>
          <button
            onClick={() => updateButtonStyle({ border: !pageData.buttonStyle.border })}
            className={`relative w-14 h-7 rounded-full transition-all ${
              pageData.buttonStyle.border ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                pageData.buttonStyle.border ? 'left-1' : 'right-1'
              }`}
            ></div>
          </button>
        </div>
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {pageData.buttonStyle.border ? 'الأزرار بدون خلفية' : 'الأزرار مع خلفية'}
        </p>
      </div>

      {/* Shadow Toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
            ظل الأزرار
          </label>
          <button
            onClick={() => updateButtonStyle({ shadow: !pageData.buttonStyle.shadow })}
            className={`relative w-14 h-7 rounded-full transition-all ${
              pageData.buttonStyle.shadow ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                pageData.buttonStyle.shadow ? 'left-1' : 'right-1'
              }`}
            ></div>
          </button>
        </div>
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {pageData.buttonStyle.shadow ? 'ظل مفعّل' : 'ظل معطّل'}
        </p>
      </div>

      {/* Preview */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
          معاينة الزر
        </label>
        <div className="bg-gray-100 p-4 rounded-xl">
          <button
            className={`w-full px-6 py-4 transition-all ${
              pageData.buttonStyle.shape === 'rounded'
                ? 'rounded-xl'
                : pageData.buttonStyle.shape === 'square'
                ? 'rounded-none'
                : 'rounded-full'
            } ${pageData.buttonStyle.border ? 'border-2' : ''} ${
              pageData.buttonStyle.shadow ? 'shadow-lg' : ''
            }`}
            style={{
              backgroundColor: pageData.buttonStyle.border
                ? 'transparent'
                : (pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor)
                  ? pageData.buttonStyle.customColor
                  : pageData.theme.buttonColor,
              color: pageData.buttonStyle.border
                ? (pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor)
                  ? pageData.buttonStyle.customColor
                  : pageData.theme.buttonColor
                : pageData.theme.buttonTextColor,
              borderColor: (pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor)
                ? pageData.buttonStyle.customColor
                : pageData.theme.buttonColor,
            }}
          >
            <span className="font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
              زر تجريبي
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 bg-pink-50 rounded-lg">
        <p className="text-xs text-pink-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          ✨ جرب الأشكال المختلفة واختر الأنسب لك
        </p>
      </div>
    </div>
  );
}
