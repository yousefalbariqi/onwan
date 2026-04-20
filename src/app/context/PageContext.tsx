import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { fetchMyPage, saveMyPage } from '../lib/api';
import { clearSessionToken, getSessionToken } from '../lib/session';

export interface Link {
  id: string;
  title: string;
  url: string;
  platform?: 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin' | 'github' | 'facebook' | 'snapchat' | 'whatsapp' | 'telegram' | 'website' | 'email' | 'custom' | 'file';
  linkType?: 'url' | 'file';
  fileCategory?: 'cv' | 'menu' | 'other';
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  iconStyle?: 'color' | 'mono';
  textPosition?: 'center' | 'right';
}

export interface Theme {
  id: string;
  name: string;
  background: string;
  buttonColor: string;
  buttonTextColor: string;
  textColor: string;
}

export interface PageData {
  username: string;
  profileImage: string;
  name: string;
  bio: string;
  links: Link[];
  theme: Theme;
  wallpaper: {
    type: 'color' | 'gradient' | 'image';
    value: string;
  };
  buttonStyle: {
    shape: 'rounded' | 'square' | 'pill';
    border: boolean;
    shadow: boolean;
    customColor?: string;
    useCustomColor?: boolean;
  };
  profileStyle: {
    type: 'circle' | 'rounded' | 'hero' | 'hero_safe' | 'premium';
  };
  customColors?: {
    nameColor?: string;
    bioColor?: string;
  };
  extractedColors?: string[]; // ألوان مستخرجة من الصورة الشخصية
}

interface PageContextType {
  pageData: PageData;
  replacePageData: (nextPageData: PageData) => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  loadingPage: boolean;
  updatePageData: (updates: Partial<PageData>) => void;
  updateTheme: (theme: Theme) => void;
  updateWallpaper: (wallpaper: PageData['wallpaper']) => void;
  updateButtonStyle: (style: Partial<PageData['buttonStyle']>) => void;
  updateProfileStyle: (style: Partial<PageData['profileStyle']>) => void;
  addLink: (link: Omit<Link, 'id'>) => void;
  removeLink: (id: string) => void;
  updateLink: (id: string, updates: Partial<Link>) => void;
  moveLink: (id: string, direction: 'up' | 'down') => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

const defaultThemes: Theme[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    background: '#ffffff',
    buttonColor: '#000000',
    buttonTextColor: '#ffffff',
    textColor: '#000000',
  },
  {
    id: 'dark',
    name: 'Dark',
    background: '#1a1a1a',
    buttonColor: '#ffffff',
    buttonTextColor: '#000000',
    textColor: '#ffffff',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#e0f7ff',
    buttonColor: '#0066cc',
    buttonTextColor: '#ffffff',
    textColor: '#003366',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#fff5eb',
    buttonColor: '#ff6b35',
    buttonTextColor: '#ffffff',
    textColor: '#8b4513',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#f0f9f0',
    buttonColor: '#2d5016',
    buttonTextColor: '#ffffff',
    textColor: '#1a3409',
  },
  {
    id: 'neon',
    name: 'Neon',
    background: '#0a0a0a',
    buttonColor: '#39ff14',
    buttonTextColor: '#000000',
    textColor: '#39ff14',
  },
  {
    id: 'rose',
    name: 'Rose',
    background: '#fff0f5',
    buttonColor: '#e91e63',
    buttonTextColor: '#ffffff',
    textColor: '#880e4f',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    background: '#f3e5f5',
    buttonColor: '#9c27b0',
    buttonTextColor: '#ffffff',
    textColor: '#4a148c',
  },
  {
    id: 'peach',
    name: 'Peach',
    background: '#ffeaa7',
    buttonColor: '#fd79a8',
    buttonTextColor: '#ffffff',
    textColor: '#6c5ce7',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0f0f23',
    buttonColor: '#00d4ff',
    buttonTextColor: '#000000',
    textColor: '#00d4ff',
  },
  {
    id: 'sand',
    name: 'Sand',
    background: '#f5deb3',
    buttonColor: '#8b6914',
    buttonTextColor: '#ffffff',
    textColor: '#5c4a1a',
  },
  {
    id: 'candy',
    name: 'Candy',
    background: '#ffb3d9',
    buttonColor: '#ff1493',
    buttonTextColor: '#ffffff',
    textColor: '#8b008b',
  },
  {
    id: 'mint',
    name: 'Mint',
    background: '#e0fff4',
    buttonColor: '#00b894',
    buttonTextColor: '#ffffff',
    textColor: '#00603d',
  },
  {
    id: 'royal',
    name: 'Royal',
    background: '#e6e6fa',
    buttonColor: '#4b0082',
    buttonTextColor: '#ffffff',
    textColor: '#2e0854',
  },
  {
    id: 'coral',
    name: 'Coral',
    background: '#fff5ee',
    buttonColor: '#ff7f50',
    buttonTextColor: '#ffffff',
    textColor: '#8b4726',
  },
  {
    id: 'sky',
    name: 'Sky',
    background: '#e8f4f8',
    buttonColor: '#00bfff',
    buttonTextColor: '#ffffff',
    textColor: '#1e3a8a',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    background: '#faf0e6',
    buttonColor: '#8b4513',
    buttonTextColor: '#ffffff',
    textColor: '#654321',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    background: '#d1f2eb',
    buttonColor: '#059669',
    buttonTextColor: '#ffffff',
    textColor: '#064e3b',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    background: '#fef3c7',
    buttonColor: '#d97706',
    buttonTextColor: '#ffffff',
    textColor: '#92400e',
  },
  {
    id: 'berry',
    name: 'Berry',
    background: '#fce7f3',
    buttonColor: '#be185d',
    buttonTextColor: '#ffffff',
    textColor: '#831843',
  },
];

export const themes = defaultThemes;

const LOCAL_STORAGE_KEY = 'bio_page_data';

const defaultPageData: PageData = {
  username: '',
  profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  name: 'أحمد محمد',
  bio: 'مصمم جرافيك ومطور مواقع 🎨💻',
  links: [
    { id: '1', title: 'إنستقرام', url: 'https://instagram.com', platform: 'instagram', iconStyle: 'color', textPosition: 'center' },
    { id: '2', title: 'تويتر X', url: 'https://twitter.com', platform: 'twitter', iconStyle: 'color', textPosition: 'center' },
    { id: '3', title: 'موقعي الشخصي', url: 'https://example.com', platform: 'website', iconStyle: 'color', textPosition: 'center' },
  ],
  theme: defaultThemes[0],
  wallpaper: {
    type: 'color',
    value: '#ffffff',
  },
  buttonStyle: {
    shape: 'rounded',
    border: false,
    shadow: true,
  },
  profileStyle: {
    type: 'circle',
  },
};

function mergeWithDefaults(candidate?: Partial<PageData> | null): PageData {
  return {
    ...defaultPageData,
    ...(candidate || {}),
    links: Array.isArray(candidate?.links) ? candidate.links : defaultPageData.links,
    theme: {
      ...defaultPageData.theme,
      ...(candidate?.theme || {}),
    },
    wallpaper: {
      ...defaultPageData.wallpaper,
      ...(candidate?.wallpaper || {}),
    },
    buttonStyle: {
      ...defaultPageData.buttonStyle,
      ...(candidate?.buttonStyle || {}),
    },
    profileStyle: {
      ...defaultPageData.profileStyle,
      ...(candidate?.profileStyle || {}),
    },
    customColors: candidate?.customColors || undefined,
    extractedColors: candidate?.extractedColors || [],
  };
}

function loadLocalPageData() {
  if (typeof window === 'undefined') {
    return defaultPageData;
  }

  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!saved) {
    return defaultPageData;
  }

  try {
    return mergeWithDefaults(JSON.parse(saved));
  } catch (error) {
    console.error('Error parsing saved data:', error);
    return defaultPageData;
  }
}

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageData, setPageData] = useState<PageData>(() => loadLocalPageData());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getSessionToken()));
  const [loadingPage, setLoadingPage] = useState(true);
  const skipNextRemoteSave = useRef(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pageData));
    }
  }, [pageData]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromApi() {
      const token = getSessionToken();

      if (!token) {
        setLoadingPage(false);
        return;
      }

      try {
        const response = await fetchMyPage();

        if (!cancelled && response.pageData) {
          skipNextRemoteSave.current = true;
          setPageData(mergeWithDefaults(response.pageData));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to hydrate page data:', error);
        clearSessionToken();

        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false);
        }
      }
    }

    hydrateFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingPage || !isAuthenticated) {
      return;
    }

    if (skipNextRemoteSave.current) {
      skipNextRemoteSave.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      saveMyPage(pageData).catch((error) => {
        console.error('Failed to save page data:', error);
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [pageData, isAuthenticated, loadingPage]);

  const replacePageData = useCallback((nextPageData: PageData) => {
    skipNextRemoteSave.current = true;
    setPageData(mergeWithDefaults(nextPageData));
  }, []);

  const updatePageData = useCallback((updates: Partial<PageData>) => {
    setPageData((prev) => mergeWithDefaults({ ...prev, ...updates }));
  }, []);

  const updateTheme = useCallback((theme: Theme) => {
    setPageData((prev) => ({
      ...prev,
      theme,
      wallpaper: { type: 'color', value: theme.background },
      customColors: undefined, // إعادة تعيين الألوان المخصصة عند تغيير الثيم
      buttonStyle: {
        ...prev.buttonStyle,
        useCustomColor: false, // إعادة تعيين اللون المخصص للأزرار
        customColor: undefined,
      },
    }));
  }, []);

  const updateWallpaper = useCallback((wallpaper: PageData['wallpaper']) => {
    setPageData((prev) => ({ ...prev, wallpaper }));
  }, []);

  const updateButtonStyle = useCallback((style: Partial<PageData['buttonStyle']>) => {
    setPageData((prev) => ({
      ...prev,
      buttonStyle: { ...prev.buttonStyle, ...style },
    }));
  }, []);

  const updateProfileStyle = useCallback((style: Partial<PageData['profileStyle']>) => {
    setPageData((prev) => ({
      ...prev,
      profileStyle: { ...prev.profileStyle, ...style },
    }));
  }, []);

  const addLink = useCallback((link: Omit<Link, 'id'>) => {
    const newLink = { ...link, id: Date.now().toString() };
    setPageData((prev) => ({ ...prev, links: [...prev.links, newLink] }));
  }, []);

  const removeLink = useCallback((id: string) => {
    setPageData((prev) => ({
      ...prev,
      links: prev.links.filter((link) => link.id !== id),
    }));
  }, []);

  const updateLink = useCallback((id: string, updates: Partial<Link>) => {
    setPageData((prev) => ({
      ...prev,
      links: prev.links.map((link) =>
        link.id === id ? { ...link, ...updates } : link
      ),
    }));
  }, []);

  const moveLink = useCallback((id: string, direction: 'up' | 'down') => {
    setPageData((prev) => {
      const links = [...prev.links];
      const index = links.findIndex((link) => link.id === id);
      
      if (index === -1) return prev;

      if (direction === 'up' && index > 0) {
        // Swap with previous
        const temp = links[index - 1];
        links[index - 1] = links[index];
        links[index] = temp;
      } else if (direction === 'down' && index < links.length - 1) {
        // Swap with next
        const temp = links[index + 1];
        links[index + 1] = links[index];
        links[index] = temp;
      }

      return { ...prev, links };
    });
  }, []);

  return (
    <PageContext.Provider
      value={{
        pageData,
        replacePageData,
        isAuthenticated,
        setAuthenticated: setIsAuthenticated,
        loadingPage,
        updatePageData,
        updateTheme,
        updateWallpaper,
        updateButtonStyle,
        updateProfileStyle,
        addLink,
        removeLink,
        updateLink,
        moveLink,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within PageProvider');
  }
  return context;
}
