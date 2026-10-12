import { usePageContext } from '../context/PageContext';
import { Circle, Square, Image as ImageIcon, Sparkles, Check, Info } from 'lucide-react';

const profileStyles = [
  {
    id: 'circle' as const,
    name: 'دائرة',
    description: 'الشكل الأساسي',
    icon: Circle,
  },
  {
    id: 'rounded' as const,
    name: 'مربع ناعم',
    description: 'زوايا دائرية',
    icon: Square,
  },
  {
    id: 'square' as const,
    name: 'مربع',
    description: 'زوايا حادة',
    icon: Square,
  },
  {
    id: 'hero' as const,
    name: 'مشهد ممتلئ',
    description: 'أفضل للصور الفوتوغرافية',
    icon: ImageIcon,
  },
  {
    id: 'hero_safe' as const,
    name: 'مشهد متوازن',
    description: 'أفضل للشعارات والصور الشفافة',
    icon: ImageIcon,
  },
  {
    id: 'premium' as const,
    name: 'دائرة مميزة',
    description: 'مع إطار',
    icon: Sparkles,
  },
];

export function ProfileStyleSelector() {
  const { pageData, updateProfileStyle } = usePageContext();

  if (!pageData || !pageData.profileStyle) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
          تصميم الصورة
        </h3>
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {profileStyles.length} تصاميم
        </div>
      </div>

      <div className="p-3 bg-purple-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            اختر شكل عرض الشعار أو الصورة: دائرة، مربع، زوايا ناعمة، أو بإطار.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {profileStyles.map((style) => {
          const isActive = pageData.profileStyle.type === style.id;
          const Icon = style.icon;

          return (
            <button
              key={style.id}
              onClick={() => updateProfileStyle({ type: style.id })}
              className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-4 ${
                isActive
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-purple-500' : 'bg-gray-100'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-600'}`} />
              </div>

              {/* Text */}
              <div className="flex-1 text-right">
                <div className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {style.name}
                </div>
                <div className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                  {style.description}
                </div>
              </div>

              {/* Check Mark */}
              {isActive && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}