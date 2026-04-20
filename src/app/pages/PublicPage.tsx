import { useEffect, useState } from 'react';
import { usePageContext } from '../context/PageContext';
import { User, ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { ProfileImageDisplay } from '../components/ProfileImageDisplay';
import { SocialIcon } from '../components/SocialIcons';
import { fetchPublicPage } from '../lib/api';

export default function PublicPage() {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams();
  const { pageData } = usePageContext();
  const [remotePageData, setRemotePageData] = useState(pageData);
  const [loading, setLoading] = useState(Boolean(routeUsername));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicPage() {
      if (!routeUsername) {
        setRemotePageData(pageData);
        setLoading(false);
        setNotFound(false);
        return;
      }

      try {
        setLoading(true);
        setNotFound(false);
        const response = await fetchPublicPage(routeUsername);

        if (!cancelled) {
          setRemotePageData(response.pageData);
        }
      } catch (error) {
        if (!cancelled) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPublicPage();

    return () => {
      cancelled = true;
    };
  }, [pageData, routeUsername]);

  const currentPageData = routeUsername ? remotePageData : pageData;
  const isHeroLayout = currentPageData.profileStyle.type === 'hero' || currentPageData.profileStyle.type === 'hero_safe';

  const getBackgroundStyle = () => {
    switch (currentPageData.wallpaper.type) {
      case 'gradient':
        return { background: currentPageData.wallpaper.value };
      case 'image':
        return { backgroundImage: `url(${currentPageData.wallpaper.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
      default:
        return { backgroundColor: currentPageData.wallpaper.value };
    }
  };

  const getBackgroundColor = () => {
    return currentPageData.wallpaper.value;
  };

  const getButtonClassName = () => {
    const shapes = {
      rounded: 'rounded-xl',
      square: 'rounded-none',
      pill: 'rounded-full',
    };
    
    const border = currentPageData.buttonStyle.border ? 'border-2' : '';
    const shadow = currentPageData.buttonStyle.shadow ? 'shadow-lg' : '';
    
    return `${shapes[currentPageData.buttonStyle.shape]} ${border} ${shadow}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            جاري تحميل الصفحة...
          </p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="mb-3 text-2xl font-bold text-gray-900" style={{ fontFamily: 'Cairo, sans-serif' }}>
            الصفحة غير موجودة
          </h1>
          <p className="mb-6 text-gray-600" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            هذا الرابط غير مرتبط بصفحة منشورة حاليًا.
          </p>
          <button
            onClick={() => navigate('/')}
            className="rounded-full bg-emerald-600 px-6 py-3 font-bold text-white transition-all hover:bg-emerald-700"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

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
        onClick={() => navigate(routeUsername ? '/' : '/builder')}
        className="fixed top-4 right-4 p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all shadow-lg z-10"
        title={routeUsername ? 'العودة للرئيسية' : 'العودة للتحرير'}
      >
        <ArrowRight className="w-5 h-5" style={{ color: currentPageData.theme.textColor }} />
      </button>

      <div className="w-full max-w-md">
        {/* Profile Image - خارج الحاوية إذا كان Hero */}
        {isHeroLayout && (
          <div className="overflow-hidden rounded-t-3xl relative">
            <ProfileImageDisplay
              profileImage={currentPageData.profileImage}
              name={currentPageData.name}
              profileStyle={currentPageData.profileStyle}
              textColor={currentPageData.theme.textColor}
              size="large"
              backgroundColor={getBackgroundColor()}
            />
          </div>
        )}

        <div className={isHeroLayout ? 'px-4 pt-6' : 'flex flex-col items-center px-4'}>
          {/* Profile Image - داخل الحاوية إذا لم يكن Hero */}
          {!isHeroLayout && (
            <ProfileImageDisplay
              profileImage={currentPageData.profileImage}
              name={currentPageData.name}
              profileStyle={currentPageData.profileStyle}
              textColor={currentPageData.theme.textColor}
              size="large"
            />
          )}

          {/* Name */}
          <h1 
            className={`text-3xl font-black mb-3 text-center ${isHeroLayout ? 'mt-0 drop-shadow-lg' : 'mt-6'}`}
            style={{ 
              fontFamily: 'Cairo, sans-serif',
              color: currentPageData.customColors?.nameColor || currentPageData.theme.textColor,
            }}
          >
            {currentPageData.name || 'اسمك هنا'}
          </h1>

          {/* Bio */}
          {currentPageData.bio && (
            <p 
              className="text-base opacity-90 mb-4 text-center max-w-sm"
              style={{ 
                fontFamily: 'Tajawal, sans-serif',
                color: currentPageData.customColors?.bioColor || currentPageData.theme.textColor,
              }}
            >
              {currentPageData.bio}
            </p>
          )}

          {/* Username */}
          <div 
            className="text-sm opacity-70 mb-10 text-center"
            style={{ fontFamily: 'Cairo, sans-serif', color: currentPageData.customColors?.usernameColor || currentPageData.theme.textColor }}
          >
            @{currentPageData.username}
          </div>

          {/* Links */}
          <div className="w-full space-y-4">
            {currentPageData.links.map((link) => {
              const textPosition = link.textPosition || 'center';
              
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={link.linkType === 'file' ? (link.fileName || true) : undefined}
                  className={`w-full px-6 py-4 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 ${getButtonClassName()}`}
                  style={{
                    backgroundColor: currentPageData.buttonStyle.border 
                      ? 'transparent' 
                      : (currentPageData.buttonStyle.useCustomColor && currentPageData.buttonStyle.customColor)
                        ? currentPageData.buttonStyle.customColor
                        : currentPageData.theme.buttonColor,
                    color: currentPageData.buttonStyle.border 
                      ? (currentPageData.buttonStyle.useCustomColor && currentPageData.buttonStyle.customColor)
                        ? currentPageData.buttonStyle.customColor
                        : currentPageData.theme.buttonColor
                      : currentPageData.theme.buttonTextColor,
                    borderColor: (currentPageData.buttonStyle.useCustomColor && currentPageData.buttonStyle.customColor)
                      ? currentPageData.buttonStyle.customColor
                      : currentPageData.theme.buttonColor,
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
                        buttonColor={currentPageData.buttonStyle.border 
                          ? 'transparent' 
                          : (currentPageData.buttonStyle.useCustomColor && currentPageData.buttonStyle.customColor)
                            ? currentPageData.buttonStyle.customColor
                            : currentPageData.theme.buttonColor}
                        className="w-6 h-6 flex-shrink-0"
                      />
                    </>
                  ) : (
                    // تخطيط يمين: أيقونة ونص على اليمين
                    <>
                      <SocialIcon 
                        platform={link.platform || 'website'}
                        iconStyle={link.iconStyle || 'color'}
                        buttonColor={currentPageData.buttonStyle.border 
                          ? 'transparent' 
                          : (currentPageData.buttonStyle.useCustomColor && currentPageData.buttonStyle.customColor)
                            ? currentPageData.buttonStyle.customColor
                            : currentPageData.theme.buttonColor}
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
              style={{ fontFamily: 'Tajawal, sans-serif', color: currentPageData.theme.textColor }}
            >
              bio.sa ✨
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
