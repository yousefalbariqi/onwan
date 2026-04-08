import { usePageContext } from '../context/PageContext';
import { User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ProfileImageDisplay } from '../components/ProfileImageDisplay';
import { SocialIcon } from '../components/SocialIcons';

export default function PublicPage() {
  const navigate = useNavigate();
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
      className="min-h-screen flex items-center justify-center transition-all duration-500"
      style={{
        ...getBackgroundStyle(),
      }}
      dir="rtl"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate('/builder?username=' + pageData.username)}
        className="fixed top-4 right-4 p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all shadow-lg z-10"
        title="العودة للتحرير"
      >
        <ArrowRight className="w-5 h-5" style={{ color: pageData.theme.textColor }} />
      </button>

      <div className="w-full max-w-md">
        {/* Profile Image - خارج الحاوية إذا كان Hero */}
        {pageData.profileStyle.type === 'hero' && (
          <div className="overflow-hidden rounded-t-3xl relative">
            <ProfileImageDisplay
              profileImage={pageData.profileImage}
              name={pageData.name}
              profileStyle={pageData.profileStyle}
              textColor={pageData.theme.textColor}
              size="large"
              backgroundColor={getBackgroundColor()}
            />
          </div>
        )}

        <div className={pageData.profileStyle.type === 'hero' ? 'px-4 pt-6' : 'flex flex-col items-center px-4'}>
          {/* Profile Image - داخل الحاوية إذا لم يكن Hero */}
          {pageData.profileStyle.type !== 'hero' && (
            <ProfileImageDisplay
              profileImage={pageData.profileImage}
              name={pageData.name}
              profileStyle={pageData.profileStyle}
              textColor={pageData.theme.textColor}
              size="large"
            />
          )}

          {/* Name */}
          <h1 
            className={`text-3xl font-black mb-3 text-center ${pageData.profileStyle.type === 'hero' ? 'mt-0 drop-shadow-lg' : 'mt-6'}`}
            style={{ 
              fontFamily: 'Cairo, sans-serif', 
              color: pageData.customColors?.nameColor || pageData.theme.textColor 
            }}
          >
            {pageData.name || 'اسمك هنا'}
          </h1>

          {/* Bio */}
          {pageData.bio && (
            <p 
              className="text-base opacity-90 mb-4 text-center max-w-sm"
              style={{ 
                fontFamily: 'Tajawal, sans-serif', 
                color: pageData.customColors?.bioColor || pageData.theme.textColor 
              }}
            >
              {pageData.bio}
            </p>
          )}

          {/* Username */}
          <div 
            className="text-sm opacity-70 mb-10 text-center"
            style={{ fontFamily: 'Cairo, sans-serif', color: pageData.theme.textColor }}
          >
            @{pageData.username}
          </div>

          {/* Links */}
          <div className="w-full space-y-4">
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
                      <SocialIcon 
                        platform={link.platform || 'website'}
                        iconStyle={link.iconStyle || 'color'}
                        buttonColor={pageData.buttonStyle.border 
                          ? 'transparent' 
                          : (pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor)
                            ? pageData.buttonStyle.customColor
                            : pageData.theme.buttonColor}
                        className="w-6 h-6 flex-shrink-0"
                      />
                    </>
                  ) : (
                    // تخطيط يمين: أيقونة ونص على اليمين
                    <>
                      <SocialIcon 
                        platform={link.platform || 'website'}
                        iconStyle={link.iconStyle || 'color'}
                        buttonColor={pageData.buttonStyle.border 
                          ? 'transparent' 
                          : (pageData.buttonStyle.useCustomColor && pageData.buttonStyle.customColor)
                            ? pageData.buttonStyle.customColor
                            : pageData.theme.buttonColor}
                        className="w-6 h-6 flex-shrink-0"
                      />
                      <span className="font-semibold" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        {link.title}
                      </span>
                      <span className="flex-1"></span>
                    </>
                  )}
                </a>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <a 
              href="/"
              className="text-sm opacity-50 hover:opacity-100 transition-opacity"
              style={{ fontFamily: 'Tajawal, sans-serif', color: pageData.theme.textColor }}
            >
              أنشئ صفحتك على bio.sa ✨
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}