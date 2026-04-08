import { usePageContext } from '../context/PageContext';
import { Upload, Image, Info, Palette } from 'lucide-react';
import { ProfileStyleSelector } from './ProfileStyleSelector';
import { extractColorsFromImage } from '../utils/colorExtractor';

const textColorPresets = [
  { name: 'أسود', value: '#000000' },
  { name: 'أبيض', value: '#ffffff' },
  { name: 'رمادي', value: '#6b7280' },
  { name: 'أزرق', value: '#3b82f6' },
  { name: 'أخضر', value: '#10b981' },
  { name: 'برتقالي', value: '#f59e0b' },
  { name: 'وردي', value: '#ec4899' },
  { name: 'بنفسجي', value: '#8b5cf6' },
];

export function HeaderEditor() {
  const { pageData, updatePageData } = usePageContext();

  const sampleImages = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
  ];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 mb-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
        معلومات البروفايل
      </h3>

      <div className="p-3 bg-purple-50 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            أضف معلوماتك الشخصية - التحديثات تظهر فوراً! 🎨
          </p>
        </div>
      </div>

      {/* Profile Image */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          صورة البروفايل
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = async () => {
                const imageUrl = reader.result as string;
                updatePageData({ profileImage: imageUrl });
                
                // استخراج الألوان من الصورة
                const colors = await extractColorsFromImage(imageUrl, 8);
                if (colors.length > 0) {
                  updatePageData({ extractedColors: colors });
                }
              };
              reader.readAsDataURL(file);
            }
          }}
          className="hidden"
          id="profile-image-upload"
        />
        <label
          htmlFor="profile-image-upload"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-all cursor-pointer"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        >
          <Upload className="w-5 h-5" />
          اختر صورة من جهازك
        </label>
        <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          أو اختر صورة سريعة من الأسفل 👇
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          الاسم
        </label>
        <input
          type="text"
          value={pageData.name}
          onChange={(e) => updatePageData({ name: e.target.value })}
          placeholder="مثال: أحمد محمد"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 text-right focus:outline-none focus:border-emerald-500 transition-all"
          style={{ fontFamily: 'Cairo, sans-serif' }}
        />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          الوصف
        </label>
        <textarea
          value={pageData.bio}
          onChange={(e) => updatePageData({ bio: e.target.value })}
          placeholder="اكتب نبذة عنك..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 text-right focus:outline-none focus:border-emerald-500 transition-all resize-none"
          style={{ fontFamily: 'Tajawal, sans-serif' }}
        />
        <div className="text-xs text-gray-500 text-left mt-1">
          {pageData.bio.length}/150
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-4"></div>

      {/* Text Colors Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          <Palette className="w-4 h-4" />
          ألوان النصوص
        </h3>

        {/* Name Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            لون الاسم
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {textColorPresets.map((color) => {
              const isActive = pageData.customColors?.nameColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => updatePageData({ customColors: { ...pageData.customColors, nameColor: color.value } })}
                  className={`relative h-10 rounded-lg transition-all hover:scale-105 border-2 ${
                    isActive
                      ? 'border-emerald-500 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={pageData.customColors?.nameColor || pageData.theme.textColor}
              onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, nameColor: e.target.value } })}
              className="w-full h-10 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            {pageData.customColors?.nameColor && (
              <button
                onClick={() => updatePageData({ customColors: { ...pageData.customColors, nameColor: undefined } })}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all whitespace-nowrap"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                إعادة تعيين
              </button>
            )}
          </div>
        </div>

        {/* Bio Color */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
            لون الوصف
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {textColorPresets.map((color) => {
              const isActive = pageData.customColors?.bioColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => updatePageData({ customColors: { ...pageData.customColors, bioColor: color.value } })}
                  className={`relative h-10 rounded-lg transition-all hover:scale-105 border-2 ${
                    isActive
                      ? 'border-emerald-500 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={pageData.customColors?.bioColor || pageData.theme.textColor}
              onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, bioColor: e.target.value } })}
              className="w-full h-10 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            {pageData.customColors?.bioColor && (
              <button
                onClick={() => updatePageData({ customColors: { ...pageData.customColors, bioColor: undefined } })}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all whitespace-nowrap"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                إعادة تعيين
              </button>
            )}
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            💡 اترك الألوان فارغة لاستخدام لون الثيم الافتراضي
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-4"></div>

      {/* Quick Images */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Cairo, sans-serif' }}>
          اختر صورة سريعة
        </label>
        <div className="grid grid-cols-4 gap-2">
          {sampleImages.map((url, index) => (
            <button
              key={index}
              onClick={async () => {
                updatePageData({ profileImage: url });
                // استخراج الألوان من الصورة
                const colors = await extractColorsFromImage(url, 8);
                if (colors.length > 0) {
                  updatePageData({ extractedColors: colors });
                }
              }}
              className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-emerald-500 transition-all"
            >
              <img src={url} alt={`Profile ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-4"></div>

      {/* Profile Style Selector */}
      <div>
        <ProfileStyleSelector />
      </div>

      <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-emerald-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          ✨ كل التغييرات تحفظ تلقائياً
        </p>
      </div>
    </div>
  );
}