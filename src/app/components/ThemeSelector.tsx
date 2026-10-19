import { usePageContext, themes } from '../context/PageContext';
import { Check, Info } from 'lucide-react';

export function ThemeSelector({ onThemeSelected }: { onThemeSelected?: (themeName: string) => void }) {
  const { pageData, updateTheme } = usePageContext();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Cairo, sans-serif' }}>
          اختر الثيم
        </h3>
        <div className="text-xs text-gray-500" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {themes.length} ثيم متاح
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg mb-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            التغييرات تُطبق مباشرة على المعاينة في الأعلى ✨
          </p>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto -mx-4 px-4" style={{ scrollbarWidth: 'thin' }}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pb-2">
          {themes.map((theme) => {
            const isActive = pageData.theme.id === theme.id;
            
            return (
              <button
                key={theme.id}
                onClick={() => {
                  onThemeSelected?.(theme.name);
                  updateTheme(theme);
                }}
                className={`relative p-2 sm:p-3 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${
                  isActive
                    ? 'border-emerald-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Theme Preview */}
                <div className="aspect-square rounded-lg mb-1.5 overflow-hidden shadow-sm" style={{ backgroundColor: theme.background }}>
                  <div className="h-full flex flex-col items-center justify-center p-2 space-y-1">
                    <div 
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                      style={{ backgroundColor: theme.textColor, opacity: 0.3 }}
                    ></div>
                    <div 
                      className="w-full h-1 sm:h-1.5 rounded"
                      style={{ backgroundColor: theme.buttonColor }}
                    ></div>
                    <div 
                      className="w-full h-1 sm:h-1.5 rounded"
                      style={{ backgroundColor: theme.buttonColor }}
                    ></div>
                  </div>
                </div>

                {/* Theme Name */}
                <div className="text-[9px] sm:text-[10px] font-semibold text-gray-700 text-center truncate px-1" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {theme.name}
                </div>

                {/* Check Mark */}
                {isActive && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
