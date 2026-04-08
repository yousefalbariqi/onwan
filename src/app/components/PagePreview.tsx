import { usePageContext } from '../context/PageContext';
import { User } from 'lucide-react';
import { ProfileImageDisplay } from './ProfileImageDisplay';
import { SocialIcon } from './SocialIcons';

export function PagePreview() {
  const { pageData } = usePageContext();

  const getBackgroundStyle = () => {
    switch (pageData.wallpaper.type) {
      case 'gradient':
        return { background: pageData.wallpaper.value };
      case 'image':
        return { backgroundImage: `url(${pageData.wallpaper.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      default:
        return { backgroundColor: pageData.wallpaper.value };
    }
  };

  const getBackgroundColor = () => {
    // إرجاع قيمة الخلفية للاستخدام في Gradient Overlay
    return pageData.wallpaper.value;
  };

  const getButtonClassName = () => {
    const shapes = {
      rounded: 'rounded-xl',
      square: 'rounded-none',
      pill: 'rounded-full',
    };
    
    const border = pageData.buttonStyle.border ? 'border-2' : '';
    const shadow = pageData.buttonStyle.shadow ? 'shadow-lg' : '';
    
    return `${shapes[pageData.buttonStyle.shape]} ${border} ${shadow}`;
  };

  return (
    <div 
      className={`w-full rounded-3xl shadow-2xl transition-all duration-300 ${pageData.profileStyle.type === 'hero' ? 'min-h-[700px] overflow-hidden' : 'min-h-[600px] overflow-hidden'}`}
      style={{
        ...getBackgroundStyle(),
        color: pageData.theme.textColor,
      }}
    >
      {/* Profile Image - خارج padding إذا كان Hero */}
      {pageData.profileStyle.type === 'hero' && (
        <div className="relative -mt-0">
          <ProfileImageDisplay
            profileImage={pageData.profileImage}
            name={pageData.name}
            profileStyle={pageData.profileStyle}
            textColor={pageData.theme.textColor}
            size="medium"
            backgroundColor={getBackgroundColor()}
          />
        </div>
      )}

      <div className={pageData.profileStyle.type === 'hero' ? 'p-8 pt-6 flex flex-col items-center' : 'p-8 flex flex-col items-center'}>
        {/* Profile Image - داخل padding إذا لم يكن Hero */}
        {pageData.profileStyle.type !== 'hero' && (
          <ProfileImageDisplay
            profileImage={pageData.profileImage}
            name={pageData.name}
            profileStyle={pageData.profileStyle}
            textColor={pageData.theme.textColor}
            size="medium"
          />
        )}

        {/* Name */}
        <h1 
          className={`text-2xl font-bold mb-2 text-center ${pageData.profileStyle.type === 'hero' ? 'mt-0 drop-shadow-md' : 'mt-4'}`}
          style={{ 
            fontFamily: 'Cairo, sans-serif',
            color: pageData.customColors?.nameColor || pageData.theme.textColor
          }}
        >
          {pageData.name || 'اسمك هنا'}
        </h1>

        {/* Bio */}
        <p 
          className="text-sm opacity-80 mb-6 text-center max-w-xs"
          style={{ 
            fontFamily: 'Tajawal, sans-serif',
            color: pageData.customColors?.bioColor || pageData.theme.textColor
          }}
        >
          {pageData.bio || 'أضف وصف قصير عنك أو عن نشاطك'}
        </p>

        {/* Username */}
        <div className="text-xs opacity-60 mb-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
          bio.sa/{pageData.username || 'username'}
        </div>

        {/* Links */}
        <div className="w-full max-w-sm space-y-3">
          {pageData.links.map((link) => {
            const textPosition = link.textPosition || 'center';
            
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full px-6 py-4 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 ${getButtonClassName()}`}
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
                {textPosition === 'center' ? (
                  // تخطيط مركز: نص في الوسط وأيقونة على اليمين
                  <>
                    <span className="flex-1 font-semibold text-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
                      {link.title}
                    </span>
                    {link.platform && (
                      <div className="flex-shrink-0">
                        <SocialIcon 
                          platform={link.platform} 
                          iconStyle={link.iconStyle || 'color'} 
                          className="w-5 h-5"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  // تخطيط يمين: أيقونة ونص على اليمين
                  <>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        {link.title}
                      </span>
                      {link.platform && (
                        <div className="flex-shrink-0">
                          <SocialIcon 
                            platform={link.platform} 
                            iconStyle={link.iconStyle || 'color'} 
                            className="w-5 h-5"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}