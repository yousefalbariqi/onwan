import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Account, fetchMyPage, saveMyPage } from '../lib/api';
import { clearSessionToken, getSessionToken } from '../lib/session';
import { MAX_LINKS } from '../lib/site';

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
  hidden?: boolean; // مخفي عن الجمهور دون حذف
}

export interface Theme {
  id: string;
  name: string;
  background: string;
  buttonColor: string;
  buttonTextColor: string;
  textColor: string;
}

export const FONT_OPTIONS = [
  { id: 'cairo', name: 'Cairo', family: 'Cairo, sans-serif' },
  { id: 'tajawal', name: 'Tajawal', family: 'Tajawal, sans-serif' },
  { id: 'almarai', name: 'Almarai', family: 'Almarai, sans-serif' },
  { id: 'plex', name: 'IBM Plex Sans Arabic', family: "'IBM Plex Sans Arabic', sans-serif" },
  { id: 'kufi', name: 'Noto Kufi Arabic', family: "'Noto Kufi Arabic', sans-serif" },
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]['id'];

export interface PageData {
  username: string;
  profileImage: string;
  name: string;
  bio: string;
  contactPhone?: string; // يظهران في بطاقة جهة الاتصال VCF
  contactEmail?: string;
  links: Link[];
  theme: Theme;
  wallpaper: {
    type: 'color' | 'gradient' | 'image';
    value: string;
    position?: 'top' | 'center' | 'bottom';
    dim?: number; // تعتيم الخلفية 0-80
  };
  buttonStyle: {
    shape: 'rounded' | 'square' | 'pill';
    border: boolean;
    shadow: boolean;
    size?: 'small' | 'medium' | 'large';
    opacity?: number; // 30-100
    customColor?: string;
    useCustomColor?: boolean;
  };
  profileStyle: {
    type: 'circle' | 'rounded' | 'square' | 'hero' | 'hero_safe' | 'premium';
  };
  typography?: {
    font?: FontId;
    size?: 'small' | 'medium' | 'large';
  };
  customColors?: {
    nameColor?: string;
    bioColor?: string;
    usernameColor?: string;
  };
  extractedColors?: string[]; // ألوان مستخرجة من الصورة الشخصية
}

interface PageContextType {
  pageData: PageData;
  account: Account | null;
  setAccount: (account: Account | null) => void;
  replacePageData: (nextPageData: PageData) => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  loadingPage: boolean;
  isDirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  logout: () => void;
  resetDesign: () => void;
  updatePageData: (updates: Partial<PageData>) => void;
  updateTheme: (theme: Theme) => void;
  updateWallpaper: (wallpaper: PageData['wallpaper']) => void;
  updateButtonStyle: (style: Partial<PageData['buttonStyle']>) => void;
  updateProfileStyle: (style: Partial<PageData['profileStyle']>) => void;
  updateTypography: (typography: Partial<NonNullable<PageData['typography']>>) => void;
  addLink: (link: Omit<Link, 'id'>) => void;
  removeLink: (id: string) => void;
  updateLink: (id: string, updates: Partial<Link>) => void;
  moveLink: (id: string, direction: 'up' | 'down') => void;
  reorderLink: (id: string, targetId: string) => void;
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

const defaultDesign = {
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
  typography: {},
} satisfies Partial<PageData>;

const defaultPageData: PageData = {
  username: '',
  profileImage: '',
  name: '',
  bio: '',
  contactPhone: '',
  contactEmail: '',
  links: [],
  ...defaultDesign,
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
    typography: candidate?.typography || {},
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
  const [account, setAccount] = useState<Account | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getSessionToken()));
  const [loadingPage, setLoadingPage] = useState(true);
  // PAGE-07: edits stay a local draft (live preview only) until «حفظ».
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pageData));
    } catch (error) {
      // Uploaded images can exceed the localStorage quota; the draft still
      // lives in memory until it is saved.
      console.warn('Draft too large for local storage:', error);
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
          setPageData(mergeWithDefaults(response.pageData));
          setAccount(response.account);
          setIsDirty(false);
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
    if (!isDirty) {
      return;
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [isDirty]);

  // Every editor change goes through here so the draft is marked unsaved.
  const edit = useCallback((updater: (prev: PageData) => PageData) => {
    setPageData(updater);
    setIsDirty(true);
  }, []);

  const replacePageData = useCallback((nextPageData: PageData) => {
    setPageData(mergeWithDefaults(nextPageData));
    setIsDirty(false);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);

    try {
      const response = await saveMyPage(pageData);
      setPageData(mergeWithDefaults(response.pageData));
      setAccount(response.account);
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  }, [pageData]);

  const logout = useCallback(() => {
    clearSessionToken();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setIsAuthenticated(false);
    setAccount(null);
    setPageData(defaultPageData);
    setIsDirty(false);
  }, []);

  // PAGE-08: restores the default look only. Content (name, description,
  // logo, contact details, buttons and files) is left untouched.
  const resetDesign = useCallback(() => {
    edit((prev) => ({ ...prev, ...defaultDesign, customColors: undefined }));
  }, [edit]);

  const updatePageData = useCallback((updates: Partial<PageData>) => {
    edit((prev) => mergeWithDefaults({ ...prev, ...updates }));
  }, [edit]);

  const updateTheme = useCallback((theme: Theme) => {
    edit((prev) => ({
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
  }, [edit]);

  const updateWallpaper = useCallback((wallpaper: PageData['wallpaper']) => {
    edit((prev) => ({ ...prev, wallpaper }));
  }, [edit]);

  const updateButtonStyle = useCallback((style: Partial<PageData['buttonStyle']>) => {
    edit((prev) => ({
      ...prev,
      buttonStyle: { ...prev.buttonStyle, ...style },
    }));
  }, [edit]);

  const updateProfileStyle = useCallback((style: Partial<PageData['profileStyle']>) => {
    edit((prev) => ({
      ...prev,
      profileStyle: { ...prev.profileStyle, ...style },
    }));
  }, [edit]);

  const updateTypography = useCallback((typography: Partial<NonNullable<PageData['typography']>>) => {
    edit((prev) => ({
      ...prev,
      typography: { ...prev.typography, ...typography },
    }));
  }, [edit]);

  const addLink = useCallback((link: Omit<Link, 'id'>) => {
    const newLink = { ...link, id: Date.now().toString() };
    edit((prev) => (prev.links.length >= MAX_LINKS ? prev : { ...prev, links: [...prev.links, newLink] }));
  }, [edit]);

  const removeLink = useCallback((id: string) => {
    edit((prev) => ({
      ...prev,
      links: prev.links.filter((link) => link.id !== id),
    }));
  }, [edit]);

  const updateLink = useCallback((id: string, updates: Partial<Link>) => {
    edit((prev) => ({
      ...prev,
      links: prev.links.map((link) =>
        link.id === id ? { ...link, ...updates } : link
      ),
    }));
  }, [edit]);

  const moveLink = useCallback((id: string, direction: 'up' | 'down') => {
    edit((prev) => {
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
  }, [edit]);

  // Drag and drop: put the dragged button in the dropped-on button's place.
  const reorderLink = useCallback((id: string, targetId: string) => {
    edit((prev) => {
      const from = prev.links.findIndex((link) => link.id === id);
      const to = prev.links.findIndex((link) => link.id === targetId);

      if (from === -1 || to === -1 || from === to) return prev;

      const links = [...prev.links];
      const [moved] = links.splice(from, 1);
      links.splice(to, 0, moved);

      return { ...prev, links };
    });
  }, [edit]);

  return (
    <PageContext.Provider
      value={{
        pageData,
        account,
        setAccount,
        replacePageData,
        isAuthenticated,
        setAuthenticated: setIsAuthenticated,
        loadingPage,
        isDirty,
        saving,
        save,
        logout,
        resetDesign,
        updatePageData,
        updateTheme,
        updateWallpaper,
        updateButtonStyle,
        updateProfileStyle,
        updateTypography,
        addLink,
        removeLink,
        updateLink,
        moveLink,
        reorderLink,
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
