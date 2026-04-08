import { useState } from 'react';
import { usePageContext } from '../context/PageContext';
import { Plus, Trash2, Pencil, Check, X, Info, ChevronUp, ChevronDown, Palette } from 'lucide-react';
import { SOCIAL_PLATFORMS, SocialIcon } from './SocialIcons';

export function LinkEditor() {
  const { pageData, addLink, removeLink, updateLink, moveLink } = usePageContext();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });
  const [editLink, setEditLink] = useState({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });

  const handleAddLink = () => {
    if (newLink.title.trim() && newLink.url.trim()) {
      addLink(newLink);
      setNewLink({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });
      setIsAdding(false);
    }
  };

  const handleEditLink = (id: string) => {
    if (editLink.title.trim() && editLink.url.trim()) {
      updateLink(id, editLink);
      setEditingId(null);
      setEditLink({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });
    }
  };

  const startEdit = (id: string, title: string, url: string, platform: any, iconStyle?: 'color' | 'mono', textPosition?: 'center' | 'right') => {
    setEditingId(id);
    setEditLink({ 
      title, 
      url, 
      platform: platform || 'custom', 
      iconStyle: iconStyle || 'color',
      textPosition: textPosition || 'center'
    });
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
          إدارة الروابط
        </h3>
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {pageData.links.length} روابط
        </div>
      </div>

      <div className="p-3 bg-indigo-50 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            أضف روابط حساباتك أو مواقعك - يمكنك الترتيب والتعديل 🔗
          </p>
        </div>
      </div>

      {/* Add New Link - في الأعلى */}
      {isAdding ? (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-3 space-y-2">
          {/* اختيار المنصة */}
          <div>
            <label className="block text-xs font-semibold text-emerald-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              نوع الرابط
            </label>
            <select
              value={newLink.platform}
              onChange={(e) => {
                const platform = SOCIAL_PLATFORMS.find(p => p.id === e.target.value);
                setNewLink({ 
                  ...newLink, 
                  platform: e.target.value as any,
                  title: platform?.name || '',
                  url: platform?.placeholder || ''
                });
              }}
              className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm text-right focus:outline-none focus:border-emerald-500"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          {/* نوع الأيقونة */}
          <div>
            <label className="block text-xs font-semibold text-emerald-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              نمط الأيقونة
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewLink({ ...newLink, iconStyle: 'color' })}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  newLink.iconStyle === 'color'
                    ? 'border-emerald-500 bg-white text-emerald-700'
                    : 'border-emerald-200 bg-emerald-50/50 text-gray-600 hover:border-emerald-300'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <SocialIcon platform={newLink.platform} iconStyle="color" className="w-4 h-4" />
                ملون
              </button>
              <button
                type="button"
                onClick={() => setNewLink({ ...newLink, iconStyle: 'mono' })}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  newLink.iconStyle === 'mono'
                    ? 'border-emerald-500 bg-white text-emerald-700'
                    : 'border-emerald-200 bg-emerald-50/50 text-gray-600 hover:border-emerald-300'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                <SocialIcon platform={newLink.platform} iconStyle="mono" className="w-4 h-4" />
                أبيض وأسود
              </button>
            </div>
          </div>

          {/* موقع النص */}
          <div>
            <label className="block text-xs font-semibold text-emerald-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
              موقع النص
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewLink({ ...newLink, textPosition: 'center' })}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  newLink.textPosition === 'center'
                    ? 'border-emerald-500 bg-white text-emerald-700'
                    : 'border-emerald-200 bg-emerald-50/50 text-gray-600 hover:border-emerald-300'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                مركز
              </button>
              <button
                type="button"
                onClick={() => setNewLink({ ...newLink, textPosition: 'right' })}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  newLink.textPosition === 'right'
                    ? 'border-emerald-500 bg-white text-emerald-700'
                    : 'border-emerald-200 bg-emerald-50/50 text-gray-600 hover:border-emerald-300'
                }`}
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                يمين
              </button>
            </div>
          </div>

          <input
            type="text"
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            placeholder="العنوان (مثال: إنستقرام)"
            className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm text-right focus:outline-none focus:border-emerald-500"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          />
          <input
            type="url"
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            placeholder="https://instagram.com/username"
            className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-sm text-left focus:outline-none focus:border-emerald-500"
            dir="ltr"
            style={{ fontFamily: 'monospace' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddLink}
              className="flex-1 bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewLink({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });
              }}
              className="flex-1 bg-white text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full border-2 border-dashed border-gray-300 text-gray-600 py-3 rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
            إضافة رابط جديد
          </span>
        </button>
      )}

      {/* Existing Links */}
      <div className="space-y-2">
        {pageData.links.map((link, index) => (
          <div key={link.id}>
            {editingId === link.id ? (
              // Edit Mode
              <div className="bg-white border-2 border-emerald-500 rounded-lg p-3 space-y-2">
                {/* اختيار المنصة */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    نوع الرابط
                  </label>
                  <select
                    value={editLink.platform}
                    onChange={(e) => {
                      const platform = SOCIAL_PLATFORMS.find(p => p.id === e.target.value);
                      setEditLink({ 
                        ...editLink, 
                        platform: e.target.value as any,
                        title: editLink.title || platform?.name || '',
                        url: editLink.url || platform?.placeholder || ''
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:border-emerald-500"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* نوع الأيقونة */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    نمط الأيقونة
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditLink({ ...editLink, iconStyle: 'color' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        editLink.iconStyle === 'color'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <SocialIcon platform={editLink.platform} iconStyle="color" className="w-4 h-4" />
                      ملون
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLink({ ...editLink, iconStyle: 'mono' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        editLink.iconStyle === 'mono'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      <SocialIcon platform={editLink.platform} iconStyle="mono" className="w-4 h-4" />
                      أبيض وأسود
                    </button>
                  </div>
                </div>

                {/* موقع النص */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    موقع النص
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditLink({ ...editLink, textPosition: 'center' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        editLink.textPosition === 'center'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      مركز
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLink({ ...editLink, textPosition: 'right' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        editLink.textPosition === 'right'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                      style={{ fontFamily: 'Cairo, sans-serif' }}
                    >
                      يمين
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={editLink.title}
                  onChange={(e) => setEditLink({ ...editLink, title: e.target.value })}
                  placeholder="العنوان"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:border-emerald-500"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                />
                <input
                  type="url"
                  value={editLink.url}
                  onChange={(e) => setEditLink({ ...editLink, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-left focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                  style={{ fontFamily: 'monospace' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLink(link.id)}
                    className="flex-1 bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-all flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    حفظ
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditLink({ title: '', url: '', platform: 'custom' as any, iconStyle: 'color' as 'color' | 'mono', textPosition: 'center' as 'center' | 'right' });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-all flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2 hover:border-gray-300 transition-all">
                {/* أزرار الترتيب */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveLink(link.id, 'up')}
                    disabled={index === 0}
                    className={`p-1 rounded transition-all ${
                      index === 0
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title="تحريك لأعلى"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveLink(link.id, 'down')}
                    disabled={index === pageData.links.length - 1}
                    className={`p-1 rounded transition-all ${
                      index === pageData.links.length - 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title="تحريك لأسفل"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* محتوى الرابط */}
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
                    {link.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate" dir="ltr" style={{ fontFamily: 'monospace' }}>
                    {link.url}
                  </div>
                </div>

                {/* أزرار التعديل والحذف */}
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(link.id, link.title, link.url, link.platform, link.iconStyle, link.textPosition)}
                    className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeLink(link.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}