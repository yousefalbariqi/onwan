import { usePageContext } from '../context/PageContext';
import { Upload, Info, Palette } from 'lucide-react';
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
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لون الاسم
            </label>
            <button
              onClick={() => updatePageData({ customColors: { ...pageData.customColors, nameColor: pageData.customColors?.nameColor ? undefined : pageData.theme.textColor } })}
              className={`relative w-14 h-7 rounded-full transition-all ${
                pageData.customColors?.nameColor ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                  pageData.customColors?.nameColor ? 'left-1' : 'right-1'
                }`}
              ></div>
            </button>
          </div>
          {pageData.customColors?.nameColor ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {textColorPresets.map((color) => {
                  const isActive = pageData.customColors?.nameColor === color.value;
                  return (
                    <button
                      key={color.value}
                      onClick={() => updatePageData({ customColors: { ...pageData.customColors, nameColor: color.value } })}
                      className={`relative h-10 rounded-lg transition-all hover:scale-105 border-2 ${
                        isActive ? 'border-emerald-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
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
                  className="w-12 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={pageData.customColors?.nameColor || pageData.theme.textColor}
                  onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, nameColor: e.target.value } })}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-600 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                استخدام لون الثيم
              </p>
            </div>
          )}
        </div>

        {/* Bio Color */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لون الوصف
            </label>
            <button
              onClick={() => updatePageData({ customColors: { ...pageData.customColors, bioColor: pageData.customColors?.bioColor ? undefined : pageData.theme.textColor } })}
              className={`relative w-14 h-7 rounded-full transition-all ${
                pageData.customColors?.bioColor ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                  pageData.customColors?.bioColor ? 'left-1' : 'right-1'
                }`}
              ></div>
            </button>
          </div>
          {pageData.customColors?.bioColor ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {textColorPresets.map((color) => {
                  const isActive = pageData.customColors?.bioColor === color.value;
                  return (
                    <button
                      key={color.value}
                      onClick={() => updatePageData({ customColors: { ...pageData.customColors, bioColor: color.value } })}
                      className={`relative h-10 rounded-lg transition-all hover:scale-105 border-2 ${
                        isActive ? 'border-emerald-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
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
                  className="w-12 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={pageData.customColors?.bioColor || pageData.theme.textColor}
                  onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, bioColor: e.target.value } })}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-600 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                استخدام لون الثيم
              </p>
            </div>
          )}
        </div>

        {/* Username Color */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-600" style={{ fontFamily: 'Cairo, sans-serif' }}>
              لون الرابط
            </label>
            <button
              onClick={() => updatePageData({ customColors: { ...pageData.customColors, usernameColor: pageData.customColors?.usernameColor ? undefined : pageData.theme.textColor } })}
              className={`relative w-14 h-7 rounded-full transition-all ${
                pageData.customColors?.usernameColor ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                  pageData.customColors?.usernameColor ? 'left-1' : 'right-1'
                }`}
              ></div>
            </button>
          </div>
          {pageData.customColors?.usernameColor ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {textColorPresets.map((color) => {
                  const isActive = pageData.customColors?.usernameColor === color.value;
                  return (
                    <button
                      key={color.value}
                      onClick={() => updatePageData({ customColors: { ...pageData.customColors, usernameColor: color.value } })}
                      className={`relative h-10 rounded-lg transition-all hover:scale-105 border-2 ${
                        isActive ? 'border-emerald-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
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
                  value={pageData.customColors?.usernameColor || pageData.theme.textColor}
                  onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, usernameColor: e.target.value } })}
                  className="w-12 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={pageData.customColors?.usernameColor || pageData.theme.textColor}
                  onChange={(e) => updatePageData({ customColors: { ...pageData.customColors, usernameColor: e.target.value } })}
                  placeholder="#000000"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-all"
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-600 text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                استخدام لون الثيم
              </p>
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            💡 فعّل التبديل لاستخدام ألوان مخصصة
          </p>
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